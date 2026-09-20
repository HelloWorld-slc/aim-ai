# Functions · 函数

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Logic/Functions.html)。

用 `def name(parameters):` 定义函数，通过缩进组织函数体。参数让同一段行为可复用；默认参数应写在必要参数后。

`return value` 返回结果并结束当前调用；没有明确返回值时得到 None。返回值应由调用方保存或使用。需要修改全局变量时先核对作用域。

```python
def heading_error(target, current):
    return (target - current + 180) % 360 - 180

error = heading_error(1, 359)
print(error)  # 2 度
```

普通调用写 `heading_error(1, 359)`；注册回调时传函数对象，例如 `controller.button_up.pressed(on_up)`，而不是 `on_up()`。回调带实参时查相应 API 的元组要求。

