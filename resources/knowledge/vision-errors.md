# 图像识别 · 漏检、误识别与目标丢失

AIM AI 中文整理，2026-09-21。来源：VEX Robotics [视觉探究](https://education.vex.com/stemlabs/aim/aim-intro-course/exploring-ai-vision/exploring-the-ai-vision-sensor)、[足球挑战](https://education.vex.com/stemlabs/aim/aim-intro-course/finding-and-transporting-cargo/unit-challenge)、[视觉决策](https://education.vex.com/stemlabs/aim/aim-intro-course/controlling-decisions/lesson-1-making-decisions-with-code)。

## 官方要点

视觉探究包含用日常物品或物体图案测试误分类的活动，说明检测标签需要核对。足球挑战建议在检测不稳定时降低移动或转向速度。决策课强调取得的数据类别应与后续判断一致。

## 本项目排查顺序

| 现象 | 优先检查 | 建议处理 |
| --- | --- | --- |
| 完全看不到球 | 官方查看器是否显示球；目标是否在视野内 | 静止放置单个球，核对类别过滤和读取时机 |
| 偶尔能看到 | 距离、视野边缘、光照、遮挡 | 固定位置对照实验，再单独比较运动速度 |
| 把别的物体认成球 | 背景干扰、目标类别与分数 | 同时测真球和干扰物，不仅验证正例 |
| 显示能看到，代码没响应 | 空结果处理、过滤条件、旧采样 | 先打印实际字段，再修改判断分支 |
| 已移走物体仍继续追 | 没重新采样、没有丢失分支 | 丢失后停止推进，再进入有限搜索 |
| 多个球之间来回切换 | 每次都把第一个当同一目标 | 明确选球策略，保留短期目标连续性 |
| 连续踢球或反复执行动作 | 对同一检测每轮触发 | 区分等待、执行中、完成状态 |

过滤、连续观测确认和状态切换是本项目建议，需在现场验证。AI 分类的分数阈值不能只凭一个示例确定；提高阈值可能减少误检也增加漏检。AprilTag 和颜色对象不要照套分类分数判断。

把故障描述拆成：观察方式、目标位置、返回数据、预期动作、实际动作。没有数据时先提出最小实验，不能编造实时画面或一次“校准成功”的结论。

相关：`vision-observe`、`vision-environment`、`vision-data`、`vision-decisions`。
