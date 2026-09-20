# MicroPython Libraries · 库

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Micropython_libraries.html)。

官网标注 AIM 使用 MicroPython 1.22，基于 Python 3.4；不能因此假定桌面 Python 新语法和所有标准库功能都可用。具体固件可有裁剪。

官网所列 14 个库全部索引：

- [asyncio](https://docs.micropython.org/en/v1.22.0/library/asyncio.html)：协程调度。
- [binascii](https://docs.micropython.org/en/v1.22.0/library/binascii.html)：二进制与文本编码。
- [cmath](https://docs.micropython.org/en/v1.22.0/library/cmath.html)：复数数学。
- [errno](https://docs.micropython.org/en/v1.22.0/library/errno.html)：错误编号。
- [gc](https://docs.micropython.org/en/v1.22.0/library/gc.html)：内存回收。
- [hashlib](https://docs.micropython.org/en/v1.22.0/library/hashlib.html)：摘要计算。
- [heapq](https://docs.micropython.org/en/v1.22.0/library/heapq.html)：堆与优先队列。
- [io](https://docs.micropython.org/en/v1.22.0/library/io.html)：输入输出流。
- [json](https://docs.micropython.org/en/v1.22.0/library/json.html)：JSON 编解码。
- [os](https://docs.micropython.org/en/v1.22.0/library/os.html)：运行环境与文件系统。
- [re](https://docs.micropython.org/en/v1.22.0/library/re.html)：正则表达式。
- [select](https://docs.micropython.org/en/v1.22.0/library/select.html)：等待输入输出事件。
- [struct](https://docs.micropython.org/en/v1.22.0/library/struct.html)：二进制结构打包。
- [sys](https://docs.micropython.org/en/v1.22.0/library/sys.html)：解释器信息。

这些是模块级速查入口；模块的全部底层函数仍查对应版本官方文档。列出 os/io 不代表机器人具有 Windows 文件路径；asyncio 示例中的通用开发板硬件接口也不能直接用于 AIM。不要对机器人项目执行 pip 安装桌面库。

