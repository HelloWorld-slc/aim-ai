# Motion · 运动

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Motion.html)。

以下接口均以 `robot.` 开头；方括号表示可选参数，填写代码时去掉方括号。

| 接口 | 作用 |
| --- | --- |
| `move_at(angle[, velocity, units])` | 持续平移 |
| `move_for(distance, angle[, velocity, units, wait])` | 按毫米移动指定距离 |
| `move_with_vectors(forward, rightward, rotation)` | 合成前进、右移、转向分量 |
| `turn(direction[, velocity, units])` | 持续旋转 |
| `turn_for(direction, angle[, velocity, units, wait])` | 相对转向 |
| `turn_to(heading[, velocity, units, wait])` | 转向指定航向 |
| `stop_all_movement()` | 停止平移与转向 |
| `set_move_velocity(velocity[, units])` | 设置平移速度 |
| `set_turn_velocity(velocity[, units])` | 设置转向速度 |
| `set_xy_position(x, y)` | 重设位置读数 |
| `get_x_position()`、`get_y_position()` | 读取毫米坐标 |
| `is_move_active()`、`is_turn_active()`、`is_stopped()` | 查询运动状态 |

平移方向：0°向前，90°向右。方向常量 `LEFT`、`RIGHT`。速度单位 `PERCENT`、`MMPS`，转速单位 `PERCENT`、`DPS`；向量分量范围 −100～100%。有限动作默认等待，`wait=False` 后需检查完成状态。

在线文档与本机 AIM_20250901_10_00_00 stub 对部分默认速度/单位的说明不同：生成代码显式传单位和速度，实机核对。设置坐标不会把机器人移动到该位置。

