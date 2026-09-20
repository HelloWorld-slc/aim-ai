# MCP 调试：参数、批量动作与结果判断

AIM AI 0.5.0，整理于 2026-09-20。以下工具是插件的电脑端调试接口，不可粘贴成机器人端 Python API。来源：本项目 `src/core/robot.ts`、`robot/backend.py`，固定版本的 [VEX-AIM-MCP](https://github.com/flashzdw/VEX-AIM-MCP) 与 [官方 WebSocket 库](https://github.com/VEX-Robotics/AIM_Websocket_Library)。运动基础见 [官方 Motion](https://api.vex.com/aim/home/python/Motion.html)，目标字段见 [官方 AI Vision](https://api.vex.com/aim/home/python/AI_Vision.html)。

## 选择何时调试

先静态检查；只有实际数据能解决问题时才连接。用户勾选「本轮允许 AI 自主运动调试」后，本轮可调用 `run_robot_batch`，不需逐步再次确认；未勾选只能读取和提出待点击的测试建议。默认不勾选，发送后自动取消勾选，历史不会恢复授权。「本轮不使用 MCP」优先于所有自动选项，编程、资料、历史和导出仍正常。

尽量不移动或只移动一次短距离。需要多步时合成一批，一份返回用于完整分析。每轮最多 1 批、8 步、2 次额外读取、3 次模型请求。测试本身已有前后数据，不要重复读取或无故请求全部字段。不要为了节省 token 而省略失败和偏差信息。

## read_robot_snapshot：读取状态

`fields` 为 `"all"`，或字段名组成的数组，例如 `["positionMm", "headingDeg"]`。省略时返回电量、位置、朝向和停止状态；兼容 `include_vision: true`。显式 fields 优先。all 表示下表所有已开放字段，不代表固件所有内部参数。

始终返回 `mode`（hardware / simulation）、`capturedAt`（UTC 采样时间）和 `scope`（远程调试会话范围）。模拟数据必须明确写「模拟」，不能当实机结果。状态过期超过两秒或断连时返回错误，不能以最后一次旧值冒充新结果。

| 字段 | 类型 / 单位 | 含义与用途 |
| --- | --- | --- |
| batteryPercent | 数值，% | 机器人报告的剩余电量 |
| positionMm | `{x,y}`，mm | 当前调试会话坐标；x 向右、y 向前，起始朝向为基准；用前后差值而不是假设位置归零 |
| headingDeg | 数值，° | 会话朝向；右转为正，比较时处理 0/360 环绕 |
| stopped | 布尔 | SDK 报告是否没有移动或转动；不是外部观察到的物理停止保证 |
| vision | 对象列表 | SPORTS_BALL、BLUE_BARREL、ORANGE_BARREL 各最多 3 个目标；不包含图片 |

视觉对象保留上游可提供的字段：`exists`（存在）、`type/id/classname`（类型/标识）、`originX/originY`（像素包围框起点）、`centerX/centerY`（像素中心）、`width/height`（像素尺寸）、`bearing`（相对视线角，度）、`score`（上游置信度值）。`angle/rotation/area` 按 SDK 原值保留，具体意义依对象类型；缺省值或 0 不能当作有效测量。像素和面积不是毫米距离，score 不未经核对就当百分比。空列表只表示本次无返回目标，不能证明场地没有球。

## run_robot_batch：一批多步运动

输入对象包括 `steps`，可选 `fields`、`distanceToleranceMm`（默认 10，1–50 mm）、`headingToleranceDeg`（默认 5，1–15°）。容差由任务精度决定，不应调大容差掩盖错误。

每一步：

| 参数 | 取值 |
| --- | --- |
| kind | `move` 或 `turn` |
| amount | move 为 1–200 mm；turn 为 1–90°，始终正数 |
| speed | 10–30%，显式使用 PERCENT |
| direction | move: forward / backward，默认 forward；turn: right / left，默认 right |

每轮最多一批 1–8 步，总直行距离不超过 800 mm、总转角不超过 360°。预计用时含每步余量不超过 45 秒；后台还检查单步超时、整批截止时间和停止状态。所有参数先整体校验，非法后续步骤不会导致前面先动。

示例（一个工具请求，返回一个结果）：

```json
{"steps":[{"kind":"move","amount":40,"speed":20,"direction":"forward"},{"kind":"move","amount":40,"speed":20,"direction":"backward"}],"fields":["positionMm","headingDeg","stopped"],"distanceToleranceMm":10,"headingToleranceDeg":5}
```

默认只回传位置、朝向、停止状态；fields 为 all 时加入电量和视觉。每批开始/结束采样，后台监控使用完整运动状态，不因请求字段少而跳过检查。

## 批量返回值与判读

| 返回字段 | 如何判断 |
| --- | --- |
| mode | 数据来自实机还是模拟 |
| status | completed：所有步骤传感器比较在容差内；deviation：偏差越界，后续步骤未执行；failed / cancelled：错误或取消 |
| requestedSteps / completedSteps | 计划步数 / 已完成并取得后测量的步数；失败中的那一步可能已产生位移，不能把差值当作完全未动 |
| failedStepIndex | 失败时若有当前步骤，报告该步骤的一基序号；它可能已部分执行 |
| before / after | 所选参数的前后快照；失败时 after 可能缺失 |
| steps[].command | 实际测试的单步请求 |
| steps[].measured.positionDeltaMm | 单步前后位置的直线距离，非沿途累计路程 |
| steps[].measured.headingChangeDeg | 单步带方向转角，归一化到 [-180,180) |
| steps[].positionErrorMm | 实际位移向量与依据起始朝向计算的目标位移向量之差；转向步骤目标位移为 0 |
| steps[].headingErrorDeg | 实际与目标转角的最短角差绝对值 |
| steps[].withinTolerance | 位置误差与角度误差均在容差内才为 true |
| tolerances | 本次使用的位置 / 朝向容差 |
| net.displacementMm / headingChangeDeg | 整批净位移 / 净朝向差；一个完整转圈的净朝向差可为 0，并不表示没有转动 |
| elapsedSeconds / error | 用时 / 故障说明；异常时不要继续发重复动作 |

位置和角度均来自机器人自身遥测；打滑、地面误差或传感器偏差可能让遥测与实际轨迹不同。结论应写「本次远程动作在所设容差内」或指出具体偏差，不能称“当前学生程序已整体正确”。连接初始化会重置会话朝向；不要跨重连比较坐标。此工具不下载或执行编辑器内任意 Python，不覆盖视觉策略、分支、循环或完整足球程序。

分析优先指出：预期、观测、误差、哪些步骤未执行、下一处值得改的代码。需要物理轨迹证据时让学生观察或量测；静态代码有明显问题时先改代码，不反复跑机器人。停止/取消会请求停机；网络故障时请求可能无法送达。
