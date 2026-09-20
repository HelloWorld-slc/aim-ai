# 项目导入、导出与下载

AIM AI 整理，2026-09-20。

`.py` 是源码；`.aimpython` 是包含源码和配置的项目文件，不能仅修改后缀。
本插件支持普通 JSON 形式的 AIM Python 项目；不支持资源压缩包、积木项目和多文件打包。
保存时自动导出只更新磁盘文件，官方 VEXcode AIM 中已打开的内容仍须重新打开。
已在 VEXcode AIM 4.67.0 桌面版验证普通正方形项目可打开。文件中槽位为 0–7，界面及 VS Code 项目设置为 1–8，转换由插件处理。
导入兼容官方保存文件中的相邻重复配置区起始注释，实际配置语句保持不变。
VEX 官方 VS Code 扩展当前支持单个 Python 文件下载。导出网页文件不是 USB 下载的前置步骤。

本插件硬件桥接是实验性功能。蓝牙直连下载和官方编辑器实时双向同步尚未实现；可导出文件后在官方应用中连接设备。

官方来源：
- https://kb.vex.com/hc/en-us/articles/34975346116116-Creating-Opening-and-Saving-a-VEXcode-AIM-Project
- https://kb.vex.com/hc/en-us/articles/36091203177108-Downloading-and-Running-a-VEX-AIM-Project-in-VS-Code
