# 图像识别 · 找球、持球与射门流程

AIM AI 中文整理，2026-09-21。来源：VEX Robotics [Collecting Cargo](https://education.vex.com/stemlabs/aim/aim-intro-course/finding-and-transporting-cargo/lesson-1-collecting-cargo)、[Unit 6 足球挑战](https://education.vex.com/stemlabs/aim/aim-intro-course/finding-and-transporting-cargo/unit-challenge)、[Python Macro](https://api.vex.com/aim/home/python/Macro.html)。

## 官方任务

课程先练习转向、收集和踢出物体，再挑战把两颗球踢进由橙桶界定的球门。学生先遥控规划，再编码、重复试验并比较完成时间。场地图含球门处的 AprilTag ID 0。官方建议检测不稳定时降低移动或转向速度。

## 本项目流程建议

| 阶段 | 判断依据 | 未满足时 |
| --- | --- | --- |
| 搜索 | 当前采样中有目标球 | 有限范围或限时搜索；超时停止 |
| 对准 | 球位于选定方向容差内 | 小幅纠偏后重新采样 |
| 接近 | 目标持续有效且尚未持球 | 短距离接近；丢失则停止推进 |
| 持球确认 | 持球接口返回真 | 不以“看见球”代替持球 |
| 瞄准 | 目标球门方向已确认 | 查指定标记；找不到时不盲踢 |
| 踢球 | 持球与朝向条件同时满足 | 停留在对应检查阶段 |
| 复位 | 本次动作完成 | 更新任务状态，再寻找下一球 |

这是建议的程序结构，不是官方完整足球解答。偏角容差、接近距离、速度、射门力度与超时都需要现场确定。球门标记可辅助方向判断，但不能仅凭图像中心就保证进球。

官方 Python Macro 是组合语句模板，不能编造 `robot.macro.*` 调用。生成程序前读取 `macro`、`vision`、`motion` 和 `kicker`。机器人端 API 与电脑端 MCP / WebSocket 调试接口不能混写。

先分别验证“检测球”“对准”“持球”“识别球门”，再组合动作。增加第二颗球时明确目标选择和完成计数；不把两次检测当作两颗不同的球。课程包含手动重置和特定场地条件，不能直接外推成完整 2v2 对抗策略。

相关：`vision-data`、`vision-apriltags`、`vision-decisions`、`vision-tests`。
