# AIM 编程与运行方式

AIM AI 整理，2026-09-20。简明参考，不替代官方文档。

当前目标：VEX AIM 机器人端 Python，使用 `from vex import *` 和 `robot = Robot()`。
程序通过 VEX 扩展下载后在机器人上运行。电脑普通 Python 只用于语法检查，不执行机器人动作。
电脑端 Wi-Fi WebSocket 项目是不同运行方式；不要将其连接代码或依赖加入机器人端项目。
第一版使用单个 Python 源文件。不要添加未经 AIM MicroPython 验证的 pip 库。
保留生成配置区域。SDK、机器人固件和在线文档版本可能不同，接口需在课堂机器验证。

官方来源：https://api.vex.com/aim/home/
官方运行方式：https://api.vex.com/aim/home/websocket/index.html

AI 工作步骤：读取当前源码 → 查相关资料 → 提出局部修改 → 显示差异 → 学生应用 → 检查 → 实机验证。
