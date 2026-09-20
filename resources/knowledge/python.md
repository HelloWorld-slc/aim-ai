# Python · 概览

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/index.html)。

每条 API 先核对对象、方法名、参数、默认值和返回值。参数表同时列出必需项与可选项，不能据参数数量猜测全部必填。

AIM 机器人端程序使用 `from vex import *`、`robot = Robot()`；不要重复初始化已有模板中的机器人。运动、视觉、消息等方法属于不同对象。常量区分大小写。

例：`robot.move_for(100, 0)` 表示移动指定距离；`robot.move_at(0)` 持续移动，必须安排停止。桌面 CPython 的语法检查无法证明机器人固件支持全部标准库。

本目录覆盖官网 Python 的 15 个一级分类及 Logic 的 12 个子页；MicroPython Libraries 页列出 14 个库与版本文档链接。正文是中文速查与接口索引，完整参数说明、图片和示例请打开各页官方来源。

## 分类目录

- [Motion · 运动](motion.md)
- [Emoji · 表情](emoji.md)
- [Kicker · 踢球器](kicker.md)
- [Sound · 声音](sound.md)
- [LED · 灯光](led.md)
- [Message · 双机消息](message.md)
- [Macro · 组合动作](macro.md)
- [AI Vision · 视觉](vision.md)
- [Screen · 屏幕与触摸](screen.md)
- [Controller · 遥控器](controller.md)
- [Inertial · 惯性传感器](inertial.md)
- [Console · 控制台](console.md)
- [Robot · 机器人信息](robot.md)
- [Logic · 程序逻辑](logic.md)
- [MicroPython Libraries · 库](micropython.md)

