"""Checks safety/freshness in the adapter without running student programs or sockets."""
import asyncio
from pathlib import Path
import sys
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path[:0] = [str(Path(__file__).resolve().parents[1] / 'robot'), str(Path(__file__).resolve().parents[1] / 'robot/vendor')]
from backend import RobotBackend, validate_test, validate_batch


class BackendTests(unittest.IsolatedAsyncioTestCase):
    async def test_bounds(self):
        for params in [('move', float('inf'), 20), ('turn', 91, 20), ('move', 1, True), ('move', 0, 20), ('kick', 1, 20)]:
            with self.assertRaises(ValueError): validate_test(*params)

    async def test_stale_status(self):
        b = RobotBackend('127.0.0.1')
        b.robot = SimpleNamespace(_ws_status_thread=SimpleNamespace(ws=SimpleNamespace(connected=True), is_current_status_empty=lambda: False), _ws_cmd_thread=SimpleNamespace(ws=SimpleNamespace(connected=True)))
        b.last_status = time.monotonic() - 3
        with self.assertRaisesRegex(RuntimeError, '过期'): b.healthy()
        b.last_status = time.monotonic()
        b.healthy()
        b.robot._ws_cmd_thread.ws.connected = False
        with self.assertRaises(RuntimeError): b.healthy()

    async def test_cancellation_stops_and_latches_failure(self):
        b = RobotBackend('', True)
        await b.connect()
        try:
            task = asyncio.create_task(b.run_test('move', 50, 20))
            await asyncio.sleep(0.03)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError): await task
            self.assertTrue(b.robot.is_stopped())
            with self.assertRaises(RuntimeError): await b.run_test('move', 50, 20)
        finally: b.close()

    async def test_busy_motion_rejected(self):
        b = RobotBackend('', True)
        await b.connect()
        try:
            task = asyncio.create_task(b.run_test('move', 50, 20))
            await asyncio.sleep(0.03)
            with self.assertRaisesRegex(RuntimeError, '另一项'): await b.run_test('turn', 20, 20)
            await task
        finally: b.close()

    async def test_snapshot_failure_releases_busy_state(self):
        b = RobotBackend('', True)
        await b.connect()
        try:
            def fail(): raise RuntimeError('lost status before movement')
            b.snapshot = fail
            with self.assertRaisesRegex(RuntimeError, 'lost status'): await b.run_test('move', 50, 20)
            self.assertFalse(b.busy)
            self.assertTrue(b.motion_failed)
            self.assertEqual(b.robot.y, 0)
        finally: b.close()

    async def test_batch_square_and_projection(self):
        b = RobotBackend('', True)
        await b.connect()
        try:
            steps = [dict(kind='move', amount=50, speed=20), dict(kind='turn', amount=90, speed=20)] * 4
            report = await b.run_batch(steps, ['headingDeg'])
            self.assertEqual(report['status'], 'completed')
            self.assertEqual(report['completedSteps'], 8)
            self.assertEqual(report['net']['displacementMm'], 0)
            self.assertEqual(report['net']['headingChangeDeg'], 0)
            self.assertNotIn('positionMm', report['after'])
            self.assertTrue(all(s['withinTolerance'] for s in report['steps']))
            self.assertEqual(b.snapshot(fields=['batteryPercent'])['batteryPercent'], 80)
            self.assertIn('vision', b.snapshot(fields='all'))
        finally: b.close()

    async def test_reverse_and_left_turn(self):
        b = RobotBackend('', True)
        await b.connect()
        try:
            report = await b.run_batch([dict(kind='turn', amount=90, speed=20, direction='left'), dict(kind='move', amount=50, speed=20, direction='backward')])
            self.assertEqual(report['status'], 'completed')
            self.assertEqual(report['steps'][0]['measured']['headingChangeDeg'], -90)
            self.assertAlmostEqual(report['after']['positionMm']['x'], 50)
        finally: b.close()

    async def test_deviation_stops_later_steps(self):
        b = RobotBackend('', True)
        await b.connect()
        try:
            original = b.robot.move_for
            b.robot.move_for = lambda distance, angle, **kw: original(distance / 2, angle, **kw)
            report = await b.run_batch([dict(kind='move', amount=100, speed=20), dict(kind='turn', amount=90, speed=20)])
            self.assertEqual(report['status'], 'deviation')
            self.assertEqual(report['completedSteps'], 1)
            self.assertEqual(b.robot.heading, 0)
            self.assertTrue(b.motion_failed)
        finally: b.close()

    async def test_batch_stop_preserves_partial_report(self):
        b = RobotBackend('', True)
        await b.connect()
        try:
            task = asyncio.create_task(b.run_batch([dict(kind='move', amount=20, speed=20)] * 3))
            await asyncio.sleep(0.30)
            b.stop()
            report = await task
            self.assertEqual(report['status'], 'cancelled')
            self.assertEqual(report['completedSteps'], 1)
            self.assertTrue(b.robot.is_stopped())
            self.assertLess(b.robot.y, 60)
            self.assertFalse(b.busy)
        finally: b.close()

    async def test_batch_validates_all_before_motion(self):
        b = RobotBackend('', True)
        await b.connect()
        try:
            with self.assertRaises(ValueError):
                await b.run_batch([dict(kind='move', amount=50, speed=20), dict(kind='turn', amount=91, speed=20)])
            self.assertEqual(b.robot.y, 0)
            with self.assertRaises(ValueError): validate_batch([dict(kind='move', amount=200, speed=20)] * 5, 10, 5)
            with self.assertRaises(ValueError): await b.run_batch([dict(kind='move', amount=50, speed=20)], ['unknown'])
            self.assertFalse(b.busy)
        finally: b.close()


    async def test_batch_timeout_stops_and_identifies_partial_step(self):
        b = RobotBackend('', True)
        await b.connect()
        try:
            with patch('backend.BATCH_TIMEOUT_SECONDS', 0.05):
                report = await b.run_batch([dict(kind='move', amount=20, speed=20)] * 2)
            self.assertEqual(report['status'], 'failed')
            self.assertEqual(report['failedStepIndex'], 1)
            self.assertEqual(report['completedSteps'], 0)
            self.assertEqual(b.robot.y, 20)
            self.assertTrue(b.robot.is_stopped())
        finally: b.close()


if __name__ == '__main__': unittest.main()
