# String Formatting · 字符串格式

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Logic/Custom_formatting.html)。

用格式字符串让传感器数据容易阅读。下面是书写示例，较复杂格式需核对机器人 MicroPython 支持。

| 用途 | 示例 |
| --- | --- |
| 插入变量 | `f"Battery: {level}"` |
| 小数位 | `f"{value:.2f}"` |
| 先取近似数值 | `round(value, 2)` |
| 千位分隔 | `f"{value:,}"` |
| 百分比 | `f"{ratio:.1%}"` |
| 十六进制 / 二进制 | `f"{value:#x}"` / `f"{value:b}"` |
| 拼接 | `"Battery: " + str(level)` |
| 大小写 | `text.upper()`、`text.lower()` |
| 子串 / 前后缀 | `part in text`、`text.startswith(prefix)`、`text.endswith(suffix)` |
| 转义 | 换行 `\n`、制表 `\t` |

百分比格式会把 0.25 显示成 25.0%；电量已经是 0～100 时应直接附加 %。若固件不支持某种格式，使用简单 print 或 str 拼接。

