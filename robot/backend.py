"""AIM AI adapter around the pinned VEX-AIM-MCP tools. No student code execution."""
from __future__ import annotations

import asyncio
import math
import threading
import time
from datetime import datetime, timezone
from types import SimpleNamespace

from aim_mcp.connection import robot_manager
from aim_mcp.tools import motion, sensors, vision


def number(value, low, high, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f"{label}必须在 {low}–{high} 之间。")
    return value


def validate_test(kind, amount, speed):
    if kind not in ("move", "turn"):
        raise ValueError("只支持直行和右转的有限动作测试。")
    number(amount, 1, 200 if kind == "move" else 90, "距离（mm）" if kind == "move" else "角度（°）")
    number(speed, 10, 30, "速度（%）")


FIELDS = ("batteryPercent", "positionMm", "headingDeg", "stopped", "vision")
BATCH_TIMEOUT_SECONDS = 45


def selected_fields(fields=None, include_vision=False):
    if fields is None: return list(FIELDS if include_vision else FIELDS[:-1])
    if fields == "all": return list(FIELDS)
    if (not isinstance(fields, list) or not 1 <= len(fields) <= len(FIELDS)
            or any(not isinstance(f, str) or f not in FIELDS for f in fields)
            or len(set(fields)) != len(fields)):
        raise ValueError("fields 必须为 all 或合法且不重复的字段列表。")
    return fields


def project_snapshot(snapshot, fields):
    return {key: value for key, value in snapshot.items()
            if key in ("mode", "capturedAt", "scope") or key in fields}


def validate_batch(steps, distance_tolerance, heading_tolerance):
    number(distance_tolerance, 1, 50, "位置容差（mm）")
    number(heading_tolerance, 1, 15, "朝向容差（°）")
    if not isinstance(steps, list) or not 1 <= len(steps) <= 8:
        raise ValueError("批量测试需要 1–8 步。")
    result, distance, angle, duration = [], 0, 0, 0
    for item in steps:
        if not isinstance(item, dict): raise ValueError("动作参数无效。")
        kind, amount, speed = item.get("kind"), item.get("amount"), item.get("speed")
        validate_test(kind, amount, speed)
        direction = item.get("direction", "forward" if kind == "move" else "right")
        if direction not in (("forward", "backward") if kind == "move" else ("left", "right")):
            raise ValueError("动作方向无效。")
        if kind == "move": distance += amount
        else: angle += amount
        duration += amount / (speed * (2 if kind == "move" else 1.8)) + 1
        result.append(dict(kind=kind, amount=amount, speed=speed, direction=direction))
    if distance > 800 or angle > 360 or duration > 45:
        raise ValueError("整批超过 800 mm / 360° / 45 秒预计用时上限。")
    return result


class SimRobot:
    """Explicit hardware-free simulation; does not import or open a network socket."""
    def __init__(self):
        self.x = self.y = self.heading = 0.0
        self.until = 0.0
        self.connected = True
        self.inertial = SimpleNamespace(get_heading=lambda: self.heading, get_rotation=lambda: self.heading)
        self.vision = SimpleNamespace(get_data=lambda desc, count: [])
    def move_for(self, distance, direction, **kwargs):
        self.x += distance * math.sin(math.radians(self.heading + direction))
        self.y += distance * math.cos(math.radians(self.heading + direction))
        self.until = time.monotonic() + 0.2
    def turn_for(self, direction, angle, **kwargs):
        self.heading = (self.heading + (-angle if getattr(direction, 'name', '') == 'LEFT' else angle)) % 360
        self.until = time.monotonic() + 0.2
    def get_x_position(self): return self.x
    def get_y_position(self): return self.y
    def get_battery_capacity(self): return 80
    def is_stopped(self): return time.monotonic() >= self.until
    def stop_all_movement(self): self.until = 0.0
    def exit_handler(self): self.connected = False


class RobotBackend:
    def __init__(self, host: str, simulate: bool = False):
        self.host = host
        self.simulate = simulate
        self.robot = None
        self.last_status = 0.0
        self._cancel = threading.Event()
        self.busy = False
        self.motion_failed = False

    async def connect(self):
        if self.robot:
            return self.snapshot()
        if self.simulate:
            self.robot = SimRobot()
            robot_manager._robot = self.robot
        else:
            # Async MCP tool executes this on the main thread: the upstream SDK
            # installs process signal handlers. Never run Robot() in a worker.
            robot_manager.connect(self.host)
            self.robot = robot_manager.get_robot()
            self.robot._ws_status_thread.callback = self._received
            for _ in range(40):
                if self.last_status:
                    break
                await asyncio.sleep(0.05)
        return self.snapshot()

    def _received(self):
        self.last_status = time.monotonic()

    def healthy(self):
        if not self.robot:
            raise RuntimeError("尚未连接机器人。")
        if self.simulate:
            if not self.robot.connected:
                raise RuntimeError("模拟连接已断开。")
        else:
            status = self.robot._ws_status_thread
            if (not status.ws.connected or not self.robot._ws_cmd_thread.ws.connected
                    or status.is_current_status_empty() or time.monotonic() - self.last_status > 2):
                raise RuntimeError("机器人状态已过期或连接中断，请停止操作并重新连接。")

    def snapshot(self, include_vision=False, fields=None):
        selection = selected_fields(fields, include_vision)
        self.healthy()
        result = {
            "mode": "simulation" if self.simulate else "hardware",
            "capturedAt": datetime.now(timezone.utc).isoformat(),
            "batteryPercent": sensors.aim_get_battery_capacity(),
            "positionMm": motion.aim_get_position(),
            "headingDeg": motion.aim_get_heading(),
            "stopped": bool(self.robot.is_stopped()),
            "scope": "remote-debug-session; not verification of the saved student program",
        }
        if "vision" in selection:
            result["vision"] = {kind: vision.aim_get_vision_objects(kind, 3)
                                for kind in ("SPORTS_BALL", "BLUE_BARREL", "ORANGE_BARREL")}
        return project_snapshot(result, selection)

    def stop(self):
        self._cancel.set()
        if not self.robot:
            raise RuntimeError("尚未连接，无法发送停止指令。")
        # Attempt the command even when status is stale; never claim that a
        # transmitted command proves the wheels have physically stopped.
        self.robot.stop_all_movement()
        return {"requested": True, "confirmed": False, "mode": "simulation" if self.simulate else "hardware"}

    def _begin_motion(self):
        self.healthy()
        if self.busy:
            raise RuntimeError("另一项动作测试仍在执行。")
        if self.motion_failed:
            raise RuntimeError("上次动作未正常完成，请重新连接后再测试。")
        if not self.robot.is_stopped():
            raise RuntimeError("机器人正在运动，请先停止再开始测试。")
        self.busy = True
        self._cancel.clear()

    async def _step(self, kind, amount, speed, direction="right", deadline=None):
        if self._cancel.is_set(): raise RuntimeError("测试已中止。")
        before = self.snapshot()
        start = time.monotonic()
        if kind == "move":
            motion.aim_move_for(amount, 180 if direction == "backward" else 0, velocity=speed, wait=False)
        else:
            motion.aim_turn_for("LEFT" if direction == "left" else "RIGHT", amount, velocity=speed, wait=False)
        await asyncio.sleep(0.25)
        while True:
            if self._cancel.is_set(): raise RuntimeError("动作测试已中止，结果不表示测试成功。")
            self.healthy()
            if deadline is not None and time.monotonic() > deadline: raise RuntimeError("整批测试超过 45 秒。")
            if self.robot.is_stopped(): break
            if time.monotonic() - start > 10: raise RuntimeError("动作测试超时，已尝试发送停止指令。")
            await asyncio.sleep(0.1)
        after = self.snapshot()
        delta_heading = (after["headingDeg"] - before["headingDeg"] + 180) % 360 - 180
        dx = after["positionMm"]["x"] - before["positionMm"]["x"]
        dy = after["positionMm"]["y"] - before["positionMm"]["y"]
        return {"mode": before["mode"], "kind": kind, "requested": amount, "speedPercent": speed,
                "elapsedSeconds": round(time.monotonic() - start, 2), "before": before, "after": after,
                "measured": {"headingChangeDeg": round(delta_heading, 2), "positionDeltaMm": round(math.hypot(dx, dy), 2)},
                "verdict": "observed; physical accuracy and student program correctness are not certified"}

    async def run_test(self, kind, amount, speed):
        validate_test(kind, amount, speed)
        self._begin_motion()
        watchdog = threading.Timer(12.0, self._watchdog_stop)
        watchdog.daemon = True
        try:
            watchdog.start()
            return await self._step(kind, amount, speed)
        except BaseException:
            self.motion_failed = True
            try: self.stop()
            except Exception: pass
            raise
        finally:
            watchdog.cancel()
            self.busy = False

    async def run_batch(self, steps, fields=None, distance_tolerance=10, heading_tolerance=5):
        plans = validate_batch(steps, distance_tolerance, heading_tolerance)
        selection = selected_fields(fields if fields is not None else ["positionMm", "headingDeg", "stopped"])
        self._begin_motion()
        started = time.monotonic()
        watchdog = threading.Timer(BATCH_TIMEOUT_SECONDS + 3, self._watchdog_stop)
        watchdog.daemon = True
        report = {"mode": "simulation" if self.simulate else "hardware", "status": "failed",
                  "requestedSteps": len(plans), "completedSteps": 0, "steps": [],
                  "tolerances": {"distanceMm": distance_tolerance, "headingDeg": heading_tolerance},
                  "verdict": "telemetry comparison only; not physical certification or execution of the saved student program"}
        try:
            first = self.snapshot("vision" in selection)
            report["before"] = project_snapshot(first, selection)
            watchdog.start()
            for index, plan in enumerate(plans):
                if time.monotonic() - started > BATCH_TIMEOUT_SECONDS: raise RuntimeError("整批测试超过 45 秒。")
                report["activeStep"] = index + 1
                observed = await self._step(**plan, deadline=started + BATCH_TIMEOUT_SECONDS)
                before, after = observed["before"], observed["after"]
                dx = after["positionMm"]["x"] - before["positionMm"]["x"]
                dy = after["positionMm"]["y"] - before["positionMm"]["y"]
                radians = math.radians(before["headingDeg"])
                sign = -1 if plan["direction"] in ("backward", "left") else 1
                expected = sign * plan["amount"]
                heading_change = observed["measured"]["headingChangeDeg"]
                expected_heading = expected if plan["kind"] == "turn" else 0
                heading_error = abs((heading_change - expected_heading + 180) % 360 - 180)
                position_error = math.hypot(dx - (expected * math.sin(radians) if plan["kind"] == "move" else 0),
                                           dy - (expected * math.cos(radians) if plan["kind"] == "move" else 0))
                within = position_error <= distance_tolerance and heading_error <= heading_tolerance
                report["steps"].append({"index": index + 1, "command": plan, "measured": observed["measured"],
                    "positionErrorMm": round(position_error, 2), "headingErrorDeg": round(heading_error, 2),
                    "withinTolerance": within})
                report["completedSteps"] += 1
                report.pop("activeStep", None)
                report["status"] = "completed" if within else "deviation"
                if not within:
                    self.motion_failed = True
                    self.stop()
                    break
            last = self.snapshot("vision" in selection)
            report["after"] = project_snapshot(last, selection)
            report["net"] = {"displacementMm": round(math.hypot(last["positionMm"]["x"] - first["positionMm"]["x"], last["positionMm"]["y"] - first["positionMm"]["y"]), 2),
                             "headingChangeDeg": round((last["headingDeg"] - first["headingDeg"] + 180) % 360 - 180, 2)}
        except BaseException as error:
            report["status"] = "cancelled" if self._cancel.is_set() or isinstance(error, asyncio.CancelledError) else "failed"
            report["error"] = str(error)[:500] or "测试已取消。"
            active = report.pop("activeStep", None)
            if active is not None: report["failedStepIndex"] = active
            self.motion_failed = True
            try: self.stop()
            except Exception: pass
            if isinstance(error, asyncio.CancelledError): raise
            try: report["after"] = self.snapshot(fields=selection)
            except Exception: pass
        finally:
            watchdog.cancel()
            self.busy = False
            report["elapsedSeconds"] = round(time.monotonic() - started, 2)
        return report

    def _watchdog_stop(self):
        self.motion_failed = True
        try: self.stop()
        except Exception: pass

    def close(self):
        if self.busy:
            try: self.stop()
            except Exception: pass
        if self.robot and not self.simulate:
            self.robot._ws_status_thread.callback = None
            self.robot.exit_handler()
            for name in ("_ws_status_thread", "_ws_img_thread", "_ws_cmd_thread", "_ws_audio_thread"):
                channel = getattr(self.robot, name, None)
                if channel:
                    channel.running = False
                    try: channel.ws_close()
                    except Exception: pass
        if self.robot and self.simulate:
            self.robot.exit_handler()
        robot_manager._robot = None
        self.robot = None
