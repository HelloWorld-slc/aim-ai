# AI Vision · 视觉

AIM AI 整理，2026-09-21。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/AI_Vision.html)。视觉实验、识别排查和足球任务见 [图像识别导航](vision-guide.md)（资料 id：`vision-guide`）。

## 接口索引

- `robot.screen.show_aivision()`、`hide_aivision()`：显示/隐藏视觉层。
- `robot.vision.tag_detection(state)`：AprilTag 开关。
- `robot.vision.get_data(signature[, count])`：返回检测对象元组；count 为 1～24，默认 8。
- `robot.has_sports_ball()`、`has_any_barrel()`、`has_blue_barrel()`、`has_orange_barrel()`：持有物体判断。
- `Colordesc(index, red, green, blue, hangle, hdsat)` 与 `robot.vision.color_description(object)`：颜色描述与注册。
- `Codedesc(index, c1, c2, ...)` 与 `robot.vision.code_description(object)`：颜色码描述与注册。

## 筛选和返回字段

筛选：`ALL_VISION`、`ALL_CARGO`、`ALL_TAGS`、`ALL_COLORS`、`SPORTS_BALL`、`BLUE_BARREL`、`ORANGE_BARREL`、`AIM_ROBOT`、`TAG0`～`TAG37`，以及已配置的颜色名。

对象属性全部索引：`exists`、`width`、`height`、`centerX`、`centerY`、`bearing`、`rotation`、`originX`、`originY`、`id`、`score`、`type`。画幅 320×240；bearing 以度表示左右偏移，右正左负。类型常量在 `AiVision`：`AI_OBJECT`、`TAG_OBJECT`、`COLOR_OBJECT`、`CODE_OBJECT`。

## 编程注意

先检查元组非空，再访问第 0 项并检查 `exists`；不要照搬直接索引的示例。像素尺寸不是毫米距离。持球判断优先用官网写法 `robot.has_sports_ball()`；本机 SDK 另有 vision 对象别名。多目标、采样和空结果示例见 `vision-data`。

AprilTag 范围存在官方文档内部差异：`tag_detection` 段写 0～36，过滤参数和 `.id` 段写 0～37，本机 SDK 声明有 TAG37。优先使用套件 0～4；其他编号结合固件实测，详见 `vision-apriltags`。不要仅凭常量存在保证识别成功。

颜色签名 index 为 1～7；颜色码 index 为 1～8。官网颜色码参数展示和说明数量不完全一致，额外颜色数量须以本机 SDK/固件实测为准；先用两个颜色。
