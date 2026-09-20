# Emoji · 表情

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Emoji.html)。

`robot.screen.show_emoji(emoji[, direction])` 显示表情；`robot.screen.hide_emoji()` 取消表情层。新表情替换旧表情，可能遮住屏幕文字和图形。

朝向：`LOOK_FORWARD`（默认）、`LOOK_LEFT`、`LOOK_RIGHT`。

表情常量索引：`EXCITED`、`CONFIDENT`、`SILLY`、`AMAZED`、`STRONG`、`THRILLED`、`HAPPY`、`PROUD`、`LAUGHING`、`OPTIMISTIC`、`DETERMINED`、`AFFECTIONATE`、`CALM`、`QUIET`、`SHY`、`CHEERFUL`、`LOVED`、`SURPRISED`、`THINKING`、`TIRED`、`CONFUSED`、`BORED`、`EMBARRASSED`、`WORRIED`、`SAD`、`SICK`、`DISAPPOINTED`、`NERVOUS`、`ANNOYED`、`STRESSED`、`ANGRY`、`FRUSTRATED`、`JEALOUS`、`SHOCKED`、`FEAR`、`DISGUST`。

课堂用法：为搜索、持球、射门三个状态指定不同表情；不要把屏幕表情当传感器结果。

