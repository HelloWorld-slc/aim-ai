# Robot · 机器人信息

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Robot.html)。

`robot.get_battery_level()` 返回 0～100 的电量百分比；`robot.get_name()` 返回名称字符串。

这两个读数可用于开课设备核对、日志前缀和低电量提醒。电量阈值由课堂实测决定；不能把软件读数当作电池剩余运行时间的精确估计。

Robot 页的公开项目是上述两个信息接口。运动看 Motion，持球看 AI Vision，结束项目看 Logic → Control。

