# Timer · 计时器

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Logic/Timer.html)。

创建 `timer = Timer()` 后开始计时。方法属于该计时器实例。

| 接口 | 用途 |
| --- | --- |
| `timer.reset()` | 归零重新计时 |
| `timer.time([units])` | 读取时间，默认 MSEC，也可 SECONDS |
| `timer.event(callback, delay[, arg])` | 延迟指定毫秒后调用函数，arg 为实参元组 |

计时读取不会让程序等待；等待用 `wait`。传回调函数名，不加调用括号。一个实参的元组写成 `(value,)`。

```python
timer = Timer()
while timer.time(SECONDS) < 2:
    print(robot.get_battery_level())
    wait(100, MSEC)
```

课堂可用计时器限制搜索时间，避免永远等待一个检测结果。

