# Control · 流程控制

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Logic/Controls.html)。

| 语法 / 接口 | 用途 |
| --- | --- |
| `wait(time[, units])` | 暂停当前执行，默认毫秒 MSEC，可显式指定 SECONDS |
| `for ... in range(...)` | 按次数重复，结束值不包含在内 |
| `if / elif / else` | 按条件选择分支 |
| `while condition` | 条件成立时重复 |
| `break` | 退出所在的最内层循环 |
| `robot.stop_program()` | 结束机器人程序 |
| `pass` | 空语句，占位 |

循环体使用一致缩进。持续传感器循环加入短暂等待，避免忙循环；`pass` 不会暂停或停止。区分停止运动、退出循环与结束程序。

以下片段放在机器人初始化后：
```python
for _ in range(4):
    robot.move_for(100, 0, 20, PERCENT)
    robot.turn_for(RIGHT, 90, 20, PERCENT)
robot.stop_all_movement()
```

运动有空间要求，下载和实测由学生单独操作。视觉追踪另设丢失目标处理与超时。

