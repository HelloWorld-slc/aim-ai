# Console · 控制台

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Console.html)。

| 接口 | 用途 |
| --- | --- |
| `print(value[, end])` | 输出到 VEXcode 控制台/VS Code 终端 |
| `clear_console()` | 清除控制台 |
| `input([prompt])` | 阻塞等待输入，返回字符串 |
| `set_console_text_color(color)` | 修改后续输出颜色 |

`print` 默认换行；`end=""` 可连续输出。打印传感器值时限制频率，例如每 100 ms 一次。`input()` 不适合放进无人值守的运动循环。

清屏与颜色函数可能由官方模板生成；普通 VS Code 项目使用前检查定义是否存在，勿只复制调用。颜色常量如 BLUE、RED；终端显示效果受环境影响。机器人屏幕输出用 `robot.screen.print`，与控制台不同。

