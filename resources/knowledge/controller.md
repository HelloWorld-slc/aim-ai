# Controller · 遥控器

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Controller.html)。

使用模板中的 `controller`；需要时按 SDK 创建 `Onestick()`，不要混用 V5 Controller。

| 接口 | 说明 |
| --- | --- |
| `controller.button_up.pressing()` | 当前按键状态 |
| `controller.button_up.pressed(callback[, arg])` | 按下回调 |
| `controller.button_up.released(callback[, arg])` | 松开回调 |
| `controller.axis1.position()` | 摇杆数值 −100～100 |
| `controller.axis1.changed(callback[, arg])` | 摇杆变化回调 |
| `controller.is_connected()` | 连接状态 |
| `controller.get_battery_level()` | 电量百分比 |

按钮对象：`button_up`、`button_down`、`button_left`、`button_right`、`button_stick`，三种按钮方法均适用。摇杆 `axis1` 是纵向，`axis2` 是横向，两种轴方法均适用。回调传函数名，带参数使用元组。

课堂遥控加入摇杆死区、断连停止与速度上限。自动足球程序和人工遥控的动作控制应互斥。

