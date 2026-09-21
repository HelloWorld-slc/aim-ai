# 图像识别 · 课程与实战导航

AIM AI 中文整理，2026-09-21。课程来源：VEX Robotics [AIM Intro Course](https://education.vex.com/stemlabs/aim/aim-intro-course)。本组收录与 AIM 图像识别直接相关的课程要点、官方数据说明及项目实践建议。各页区分来源摘要与本项目建议；没有把课程视频转录成已核实文字。

## 按问题查资料

| 问题 | 资料 id / 页面 |
| --- | --- |
| 怎样看机器人正在识别什么 | `vision-observe` · [画面与数据查看](vision-observe.md) |
| 怎样读对象、处理空结果和多目标 | `vision-data` · [数据读取](vision-data.md)，接口总表 `vision` |
| 看多远、视野多宽、像素能否当距离 | `vision-geometry` · [视野与距离](vision-geometry.md) |
| 光照、阴影、反光或地面影响 | `vision-environment` · [环境实验](vision-environment.md) |
| 看不到球、认错物体、追踪丢失 | `vision-errors` · [故障排查](vision-errors.md) |
| 识别球门标记、按编号导航 | `vision-apriltags` · [AprilTag](vision-apriltags.md) |
| 识别自定义颜色、组合色块 | `vision-colors` · [颜色签名与颜色码](vision-colors.md) |
| 找球、接近、持球、瞄准与射门 | `vision-football` · [足球视觉任务](vision-football.md) |
| 按识别结果分支、重复动作 | `vision-decisions` · [视觉决策](vision-decisions.md) |
| 模型怎样训练、能否增加新物体 | `vision-training` · [训练与能力边界](vision-training.md) |
| 如何记录识别准确性、验证修改 | `vision-tests` · [测试与任务卡](vision-tests.md) |

## 使用范围

这里的图像识别指 AIM 机器人 AI Vision 的对象、标记和颜色检测。课程以积木教学为主，生成机器人端 Python 时还要查 `vision`、`macro`、`motion`、`kicker` 等接口资料；积木名称不能直接当作 Python 方法。

知识库帮助编程助手解释和编写程序；加入资料不会训练或更换机器人中的视觉模型。当前 MCP 快照只提供有限类别的检测对象列表，不提供相机图片，详见 `robot-debug`。不能因为收录了视觉资料，就声称助手已看到视频、识别任意图片或完成实机验收。

入库形式为中文摘要、原创排查步骤及来源链接。原始视频、插图、任务卡留在官方站点。素材链接目录见 `vision-sources.json`；链接被列出不等于已下载并审阅附件全文。
