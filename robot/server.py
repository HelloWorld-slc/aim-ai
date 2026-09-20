"""Local stdio MCP entry point. The plugin exposes only selected tools to AI."""
from __future__ import annotations

import argparse
import functools
import ipaddress
import os
from pathlib import Path
import secrets
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "vendor"))

from mcp.server.fastmcp import FastMCP
import vex.aim
from backend import RobotBackend

# Official SDK prints diagnostics from its receive threads. Keep them off the
# MCP protocol's stdout without changing the vendored upstream source files.
vex.aim.print = functools.partial(print, file=sys.stderr)


def create_server(host, simulate=False, token=""):
    backend = RobotBackend(host, simulate)
    server = FastMCP("aim-ai-robot")

    @server.tool()
    async def robot_connect() -> dict:
        """Open an explicit remote debug session. Official SDK initializes the program and heading."""
        return await backend.connect()

    @server.tool()
    async def robot_snapshot(include_vision: bool = False) -> dict:
        """Read a bounded snapshot; rejects missing, disconnected or stale status."""
        return backend.snapshot(include_vision)

    @server.tool()
    async def robot_test(kind: str, amount: float, speed: float, approval: str) -> dict:
        """Run one user-approved bounded test. Approval token is held by the plugin, never the model."""
        if not token or not secrets.compare_digest(approval, token):
            raise ValueError("动作测试必须由插件中的用户按钮启动。")
        return await backend.run_test(kind, amount, speed)

    @server.tool()
    async def robot_stop() -> dict:
        """Attempt to stop; success only means a stop request was sent."""
        return backend.stop()

    @server.tool()
    async def robot_disconnect() -> dict:
        """Close all channels. Reconnect by starting a fresh server process."""
        backend.close()
        return {"disconnected": True}

    return server, backend


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="")
    parser.add_argument("--simulate", action="store_true")
    args = parser.parse_args()
    if not args.simulate:
        ipaddress.IPv4Address(args.host)
    server, backend = create_server(args.host, args.simulate, os.environ.get("AIM_AI_MOTION_TOKEN", ""))
    try:
        server.run(transport="stdio")
    finally:
        backend.close()
