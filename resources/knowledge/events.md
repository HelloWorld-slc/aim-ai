# Events · 事件

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Logic/Events.html)。

创建 `event = Event()`，用 `event(callback[, args])` 注册函数；可注册多个响应者。

| 接口 | 行为 |
| --- | --- |
| `event.broadcast()` | 启动事件响应，调用方继续执行 |
| `event.broadcast_and_wait()` | 等待所有本次响应结束再继续 |

事件响应在独立线程运行。若响应者无限循环，等待型广播将不能正常结束。回调参数使用元组；不同响应者不能同时争抢机器人运动控制。

```python
def show_ready():
    robot.screen.show_emoji(HAPPY)

ready = Event()
ready(show_ready)
ready.broadcast_and_wait()
```

这是同一程序内部事件。机器人之间传消息使用 Message 中的 `robot.link`。

