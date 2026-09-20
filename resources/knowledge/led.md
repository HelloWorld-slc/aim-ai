# LED · 灯光

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/LEDs.html)。

`robot.led.on(led[, color])` 点亮；`robot.led.off(led)` 熄灭。目标可为 `LED1`～`LED6`、`ALL_LEDS`，或多个 LED 组成的元组，例如 `(LED2, LED5)`。

颜色：`BLACK`、`BLUE`、`CYAN`、`GREEN`、`ORANGE`、`PURPLE`、`RED`、`TRANSPARENT`、`WHITE`、`YELLOW`；省略颜色时为白色。也可传 `Color(...)` 对象，详见 Logic → Custom Colors。

课堂用法：灯光显示策略状态，定时切换实现闪烁。LED 不是像素屏幕，不使用 x、y 坐标。

