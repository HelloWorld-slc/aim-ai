# Screen · 屏幕与触摸

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Screen.html)。

以下方法均属于 `robot.screen`；`[...]` 代表可选项。

| 功能 | 接口 |
| --- | --- |
| 触摸 | `pressing()`、`x_position()`、`y_position()` |
| 光标文本 | `print(text)`、`set_cursor(row, column)`、`next_row()`、`clear_row([row, color])`、`get_row()`、`get_column()` |
| 坐标文本 | `print_at(text, x, y)`、`set_origin(x, y)` |
| 样式 | `clear_screen([color])`、`set_font(fontname)`、`set_pen_width(width)`、`set_pen_color([color])`、`set_fill_color([color])` |
| 绘图 | `draw_pixel(x, y)`、`draw_line(x1, y1, x2, y2)`、`draw_rectangle(x, y, width, height[, color])`、`draw_circle(x, y, radius[, color])` |
| 图像与裁剪 | `show_file(file, x, y[, center])`、`set_clip_region(x, y, width, height)` |
| 回调 | `pressed(callback[, arg])`、`released(callback[, arg])` |

坐标范围 0～240，中心 (120,120)，圆形屏幕会裁掉方形画幅角落。光标行列与像素坐标不同。画笔宽度 0～32。字体为 `MONO12/15/20/24/30/40/60`、`PROP20/30/40/60`（写代码用完整常量如 MONO24）。

`IMAGE1`～`IMAGE10` 需先上传图像；本插件不打包图片。全屏表情或视觉层可能遮住文字。触摸位置表示上次按压位置，应配合 pressing 判断。

