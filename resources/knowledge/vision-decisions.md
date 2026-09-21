# 图像识别 · 条件判断、循环与动作状态

AIM AI 中文整理，2026-09-21。来源：VEX Robotics [Putting It All Together](https://education.vex.com/stemlabs/aim/aim-intro-course/exploring-ai-vision/putting-it-all-together)、[Making Decisions with Code](https://education.vex.com/stemlabs/aim/aim-intro-course/controlling-decisions/lesson-1-making-decisions-with-code)、[Repeating Behaviors](https://education.vex.com/stemlabs/aim/aim-intro-course/controlling-decisions/lesson-2-repeating-behaviors)。

## 官方要点

综合活动让机器人对球、不同颜色桶产生不同反应；决策课进一步按 AprilTag 编号分支。先检查对象存在，再判断对象类别或编号。取数据时所选的过滤类型应与后续问题相符。重复课比较有限次数重复与持续循环，并练习对多种物体和标记作出响应。

## 转成 Python 的建议

每次循环按“读取新数据 → 检查非空和有效性 → 确定目标 → 判断当前状态 → 执行一次动作 → 等待”组织。Python 空元组没有第 0 项，不要直接索引。比较混合对象的编号前先核对类型。完整读取示例见 `vision-data`。

同一个目标在连续采样中出现，不代表多个新事件。若检测到球就触发一次踢球，应设置“等待球、已持球、已踢出”等状态，避免每轮重复触发。显示用的表情或灯光可以指示状态，但它们不是新的传感器证据。

| 控制目的 | 建议结构 |
| --- | --- |
| 读取固定数量样本 | 有限循环，结束后返回结果 |
| 持续观察 | 循环内采样、等待，并提供结束条件 |
| 等待目标出现 | 超时判断与未发现分支 |
| 接近过程中跟踪 | 短动作、重新采样、丢失处理 |
| 多条件决策 | 区分类型和 ID，明确条件优先级 |

不要让一个长时间阻塞动作或演示用长等待掩盖目标丢失。运动、等待和显示都按任务节奏设计；同一时间由一个控制流程决定机器人运动。多线程不是修复矛盾运动命令的方法。

这些 Python 组织方式是本项目建议，课程中的积木图不能直接复制为 Python。语法通过只能证明可解析，不能证明分支、运动效果或识别准确性。

相关：`control`、`timer`、`threads`、`vision-errors`。
