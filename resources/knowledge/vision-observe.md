# 图像识别 · 画面、仪表板与数据查看

AIM AI 中文整理，2026-09-21。来源：VEX Robotics [Three Ways to See AI Vision](https://education.vex.com/stemlabs/aim/aim-intro-course/finding-and-transporting-cargo/three-ways-to-see-ai-vision)、[AI Vision Dashboard](https://kb.vex.com/hc/en-us/articles/36091751548436-Viewing-AI-Vision-Sensor-Data-in-the-AI-Vision-Dashboard)。

## 官方要点

课程介绍三种查看入口：VEXcode 的 AI Vision Dashboard、AI Vision Utility，以及机器人屏幕上的 AI Vision Viewer。Dashboard 从 Monitor 面板展开，可观察识别对象和配置好的颜色。官方说明该仪表板需要 USB-C 连接；不能用本插件 Wi-Fi 已连接来推断它已经可用。Pause 会冻结显示，Resume 恢复。

Python 的屏幕视觉显示入口见 `vision`。视觉层会覆盖屏幕其他内容，需要隐藏后再检查文字或表情。颜色配置步骤见 `vision-colors`。

## 本项目排查建议

先静止观察，再写运动逻辑。把同一物体放在正前方，记录类别、编号、包围框位置及大小；向左右移动，核对横坐标或偏角方向。将物体移出画面，确认结果会消失。此过程可以区分“传感器没看到”与“程序读错目标”。

| 现象 | 下一步 |
| --- | --- |
| 画面不变 | 检查是否暂停、连接是否正常，以及自己查看的是实时画面还是旧截图 |
| 画面有目标，程序说没有 | 对照过滤类别、颜色配置名、AprilTag 编号；重新读取数据 |
| 检测框正常，机器人动作错误 | 查看决策与运动代码，不能仅调整视觉阈值 |
| 屏幕文字看不到 | 先确认视觉显示层是否遮住文字 |

本插件 `read_robot_snapshot` 的 `vision` 是结构化检测列表，当前仅取球、蓝桶和橙桶；不包含图片、AprilTag 或颜色检测结果。列表为空时不能断言“相机画面空白”。本工具不是官方 Dashboard，也不能监视已经下载程序的完整运行过程。连接会初始化远程调试会话，使用边界见 `robot-debug`。

相关：`vision-data`、`vision-errors`、`robot-debug`。
