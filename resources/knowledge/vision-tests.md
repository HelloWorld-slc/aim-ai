# 图像识别 · 实验记录、任务卡与验收

AIM AI 原创测试建议，2026-09-21。课程参考：VEX Robotics [视觉探究](https://education.vex.com/stemlabs/aim/aim-intro-course/exploring-ai-vision/exploring-the-ai-vision-sensor)、[足球挑战](https://education.vex.com/stemlabs/aim/aim-intro-course/finding-and-transporting-cargo/unit-challenge)、[视觉决策](https://education.vex.com/stemlabs/aim/aim-intro-course/controlling-decisions/lesson-1-making-decisions-with-code)。

## 可用官方材料

视觉探究页提供视野（桶、AprilTag）、光照、误分类和表面实验任务卡；足球挑战提供遥控规划和编码任务卡；视觉决策提供活动任务卡。来源页提供 Google Docs、Word 和 PDF 入口，原始材料链接另汇入 `vision-sources.json`。附件保留为链接，不宣称已阅读或改编附件全文。

## 本项目测试矩阵

| 场景 | 需要验证的行为 |
| --- | --- |
| 无目标 | 返回空结果时不报索引错误，不沿旧目标继续推进 |
| 单目标居中 / 左 / 右 | 类别正确，方向判断与实际位置相符 |
| 多个同类目标 | 选择规则明确，必要时避免来回切换 |
| 不同类别与干扰物 | 不把蓝桶、橙桶、背景或印刷图案当成球直接执行射门 |
| 目标移出视野 / 被遮住 | 丢失分支和搜索超时能生效 |
| 光照 / 距离 / 表面变化 | 记录识别变化，判断适用条件 |
| 多个 AprilTag | 只响应指定类型和编号，忽略非目标标记 |
| 颜色签名重载 | 保留配置名称与参数；重开项目后结果可重复 |

建议每条记录包含：日期、程序版本、机器人/固件、目标、实际位置、光照、表面、采样方式、检测类别与框、预期动作、实际动作、本次修改。不能取得的字段标记未记录，不补造数据。

检测测试区分真目标检出、漏检、干扰物误检；报告样本数和条件。运动测试另报持球成功、射门结果和完成时间，不用“代码没报错”替代任务成功。阈值、等待时间或速度每次只改一个主要因素，保留修改前对照。

离线模拟可检查空结果、多目标和状态转换；不能证明真实光照、镜头、地面或运动效果。后续实测记录可作为新案例入库，但应附场地、日期和版本，避免把一次成功当通用保证。

相关：`vision-guide`、`vision-data`、`vision-football`。
