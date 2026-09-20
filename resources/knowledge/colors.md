# Custom Colors · 自定义颜色

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Logic/Color_objects.html)。

自定义显示颜色用于屏幕与 LED。

| 构造方式 | 示例 |
| --- | --- |
| 十六进制整数 | `Color(0x336699)` |
| RGB 三分量 | `Color(51, 102, 153)` |
| 网页颜色字符串 | `Color("#336699")` |
| 内置颜色 | `Color(RED)` |

颜色对象还支持 `color.rgb(r, g, b)`、`color.hsv(h, s, v)`、`color.web(value)`。RGB 每项 0～255；HSV 色相 0～359，饱和度和亮度 0～1。

```python
team_color = Color(30, 180, 120)
robot.led.on(ALL_LEDS, team_color)
```

显示颜色与 AI Vision 的 `Colordesc` 视觉签名不同。视觉识别需要单独标定；给 LED 设置颜色不会创建识别目标。
