# Macro · 组合动作

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Macro.html)。

宏是拖入编辑器的多条 Python 语句，不是可直接调用的单个 API。不要生成不存在的 `robot.macro.*` 方法。

官网全部宏索引：

- 情绪：`act happy`、`act sad`、`act silly`、`act angry`、`act excited`。
- 足球：`turn right until sports ball`、`turn left until sports ball`、`get sports ball`。
- 橙桶：`turn right until orange barrel`、`turn left until orange barrel`、`get orange barrel`。
- 蓝桶：`turn right until blue barrel`、`turn left until blue barrel`、`get blue barrel`。
- AIM 机器人：`turn right until AIM robot`、`turn left until AIM robot`、`move to AIM robot`。
- AprilTag：`turn right until AprilTag`、`turn left until AprilTag`、`move to AprilTag`。

用官网对应宏查看完整展开代码；修改时结合 Motion、AI Vision、Inertial 等参考。课堂搜索动作增加超时与停止；目标丢失时先停止推进。

