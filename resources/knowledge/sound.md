# Sound · 声音

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Sounds.html)。

方法属于 `robot.sound`。

| 接口 | 作用 |
| --- | --- |
| `play(sound[, volume])` | 播放内置音效 |
| `play_file(file[, volume])` | 播放已上传声音 |
| `play_note(note, length[, volume])` | 播放音符，时长为毫秒 |
| `stop()` | 结束当前声音 |
| `is_active()` | 查询是否正在播放 |

音量 0～100%，默认 50%；播放不阻塞后续代码。需要等结束时轮询 `is_active()` 并加 `wait`。音符可用 A～G、可选 #，八度 5～8，例如 `"D6"`。

内置声音：`ACT_ANGRY`、`ACT_EXCITED`、`ACT_HAPPY`、`ACT_SAD`、`ACT_SILLY`、`BLINKER`、`BRAKES`、`CHEER`、`CHIRP`、`COMPLETE`、`CRASH`、`DETECTED`、`DOORBELL`、`FAIL`、`FLOURISH`、`HUAH`、`LOOPING`、`MOVE_FORWARD`、`MOVE_REVERSE`、`OBSTACLE`、`PAUSE`、`PICKUP`、`RECEIVE`、`RESUME`、`SENSING`、`SEND`、`SPARKLE`、`TADA`、`TURN_LEFT`、`TURN_RIGHT`。

文件常量 `SOUND1`～`SOUND10` 对应官方控制面板上传资源。本插件目前不打包声音资源。

