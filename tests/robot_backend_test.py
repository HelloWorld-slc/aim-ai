"""Checks safety/freshness in the adapter without running student programs or sockets."""
import asyncio
from pathlib import Path
import sys
import time
from types import SimpleNamespace
import unittest

sys.path[:0] = [str(Path(__file__).resolve().parents[1] / 'robot'), str(Path(__file__).resolve().parents[1] / 'robot/vendor')]
from backend import RobotBackend, validate_test


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


if __name__ == '__main__': unittest.main()
