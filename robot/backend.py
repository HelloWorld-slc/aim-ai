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


class SimRobot:
    """Explicit hardware-free simulation; does not import or open a network socket."""
    def __init__(self):
        self.x = self.y = self.heading = 0.0
        self.until = 0.0
        self.connected = True
        self.inertial = SimpleNamespace(get_heading=lambda: self.heading, get_rotation=lambda: self.heading)
        self.vision = SimpleNamespace(get_data=lambda desc, count: [])
    def move_for(self, distance, direction, **kwargs):
        self.x += distance * math.sin(math.radians(self.heading))
        self.y += distance * math.cos(math.radians(self.heading))
        self.until = time.monotonic() + 0.2
    def turn_for(self, direction, angle, **kwargs):
        self.heading = (self.heading + angle) % 360
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

    def snapshot(self, include_vision=False):
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
        if include_vision:
            result["vision"] = {kind: vision.aim_get_vision_objects(kind, 3)
                                for kind in ("SPORTS_BALL", "BLUE_BARREL", "ORANGE_BARREL")}
        return result

    def stop(self):
        self._cancel.set()
        if not self.robot:
            raise RuntimeError("尚未连接，无法发送停止指令。")
        # Attempt the command even when status is stale; never claim that a
        # transmitted command proves the wheels have physically stopped.
        self.robot.stop_all_movement()
        return {"requested": True, "confirmed": False, "mode": "simulation" if self.simulate else "hardware"}

    async def run_test(self, kind, amount, speed):
        validate_test(kind, amount, speed)
        self.healthy()
        if self.busy:
            raise RuntimeError("另一项动作测试仍在执行。")
        if self.motion_failed:
            raise RuntimeError("上次动作未正常完成，请重新连接后再测试。")
        if not self.robot.is_stopped():
            raise RuntimeError("机器人正在运动，请先停止再开始测试。")
        self.busy = True
        self._cancel.clear()
        start = time.monotonic()
        watchdog = threading.Timer(12.0, self._watchdog_stop)
        watchdog.daemon = True
        try:
            before = self.snapshot()
            watchdog.start()
            if kind == "move":
                motion.aim_move_for(amount, 0, velocity=speed, wait=False)
            else:
                motion.aim_turn_for("RIGHT", amount, velocity=speed, wait=False)
            await asyncio.sleep(0.25)
            while True:
                if self._cancel.is_set():
                    raise RuntimeError("动作测试已中止，结果不表示测试成功。")
                self.healthy()
                if self.robot.is_stopped():
                    break
                if time.monotonic() - start > 10:
                    raise RuntimeError("动作测试超时，已尝试发送停止指令。")
                await asyncio.sleep(0.1)
            after = self.snapshot()
            delta_heading = (after["headingDeg"] - before["headingDeg"] + 180) % 360 - 180
            dx = after["positionMm"]["x"] - before["positionMm"]["x"]
            dy = after["positionMm"]["y"] - before["positionMm"]["y"]
            return {"mode": before["mode"], "kind": kind, "requested": amount, "speedPercent": speed,
                    "elapsedSeconds": round(time.monotonic() - start, 2), "before": before, "after": after,
                    "measured": {"headingChangeDeg": round(delta_heading, 2), "positionDeltaMm": round(math.hypot(dx, dy), 2)},
                    "verdict": "observed; physical accuracy and student program correctness are not certified"}
        except BaseException:
            self.motion_failed = True
            try: self.stop()
            except Exception: pass
            raise
        finally:
            watchdog.cancel()
            self.busy = False

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
