# 图像识别 · AprilTag 编号、遮挡与导航

AIM AI 中文整理，2026-09-21。来源：VEX Robotics [Moving to AprilTags](https://education.vex.com/stemlabs/aim/aim-intro-course/finding-and-transporting-cargo/lesson-2-moving-to-apriltags)、[Move to AprilTag 示例导读](https://education.vex.com/stemlabs/aim/aim-intro-course/transport-cargo-with-the-ai-vision-sensor/explore-an-example-project)、[AI Vision Python](https://api.vex.com/aim/home/python/AI_Vision.html)。

## 官方要点

课程用标记作为目标位置，引导学生将物体运到标记附近，并通过 Dashboard 观察。搬运后移开桶，避免挡住标记。Move to AprilTag 示例从 VEXcode AIM 的 File → Example Projects 打开；课程示例中的积木选项是 ID 0～4。

## 编号差异

截至整理日期，官方 Python 页的 `tag_detection` 段写 Circle21h7 家族、ID 0～36，而过滤参数及 `.id` 段写 0～37；本机 AIM_20250901_10_00_00 SDK 声明含 TAG37。存在声明不一致，不能把“常量存在”当作固件必然可识别。课堂先使用套件 ID 0～4；其他编号结合当前固件和官方可打印标记实测。积木菜单范围也不能等同于传感器全部能力。

## 本项目导航建议

1. 用官方兼容标记，先静止验证实际编号；不要用普通二维码替代。
2. 确认标记完整可见、朝向相机，排除遮挡，再核对检测开关和过滤参数。
3. 读取全部标记时遍历结果找指定编号，不假定列表第一个就是目标。类型也要匹配。
4. 将“发现目标”“对准”“接近”“到达”分开。每次动作后重新采样；失去标记时停止推进。
5. 球门标记只提供视觉参考，不能仅靠检测到 ID 就断言机器人已在最佳射门位置。

若多个标记使用相同编号，单靠编号无法区分它们。物体朝向信息也不是机器人世界坐标定位；需要额外几何关系与标定才能推出场地位置。

相关：`vision`、`vision-geometry`、`macro`、`vision-football`。
