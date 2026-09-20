# Inertial · 惯性传感器

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Inertial.html)。

以下接口属于 `robot.inertial`。

| 接口 | 读数或用途 |
| --- | --- |
| `get_rotation()` | 累计转角，可超过一周 |
| `get_heading()` | 0～359.99°航向 |
| `get_yaw()`、`get_roll()` | −180～180° |
| `get_pitch()` | −90～90° |
| `reset_rotation()`、`reset_heading()` | 归零读数 |
| `set_heading(heading)` | 设置航向读数 |
| `crashed(callback[, arg])` | 碰撞回调 |
| `set_crash_sensitivity(sensitivity)` | 碰撞灵敏度 |
| `get_acceleration(type)` | 指定方向加速度，单位 G |
| `get_turn_rate(axis)` | 指定轴转速，单位 DPS |
| `calibrate()`、`is_calibrating()` | 校准与完成状态 |

加速度方向 `FORWARD`、`RIGHTWARD`、`DOWNWARD`；转轴 `ROLL`、`PITCH`、`YAW`。灵敏度常量按当前 SDK 核对。校准期间保持静止，等待完成后开始动作。

`set_heading` 只改参考读数，`robot.turn_to` 才执行转向。航向跨越 0° 时用环绕角差控制，不能直接把 359°到1°当作−358°。

