# Variables · 变量

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Logic/Variables.html)。

变量通过赋值创建，例如 `speed = 20`。函数内赋值通常创建局部变量；函数内重新绑定全局变量要先写 `global speed`。`if` 和 `for` 不会创建独立的函数作用域。

类型索引：整数 int、浮点数 float、字符串 str、布尔 bool、空值 None、range、列表 list、元组 tuple。用 `True` / `False` 表示布尔值，空值判断使用 `is None`。

- `range(stop)`、`range(start, stop[, step])`：停止值不包含在序列中。
- 列表：`roles = ["attack", "defend"]`，从索引 0 开始，可修改元素。
- 二维列表：`points = [[0, 0], [100, 0]]`，用两个索引访问。
- 元组：`point = (100, 0)`，不能修改元素；单元素元组必须有逗号，如 `(100,)`。

避免把多行列表都引用同一个可变对象；用不同列表表达不同坐标行。不要用变量覆盖 `robot`、`wait` 或库名。

