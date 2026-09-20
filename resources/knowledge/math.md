# Math · 数学

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Logic/Math.html)。

数学库使用 `import math`。下列按官网 Math 页面列出内置函数、常量和数学函数，调用形式及可用性还需与当前 AIM 固件核对。

| 分组 | 完整名称索引 |
| --- | --- |
| 内置函数 | `abs`、`round`、`min`、`max`、`sum`、`divmod`、`pow`、`int`、`float` |
| 常量 | `math.pi`、`math.tau`、`math.e`、`math.inf`、`math.nan` |
| 三角与角度 | `math.sin`、`math.cos`、`math.tan`、`math.atan`、`math.atan2`、`math.asin`、`math.acos`、`math.degrees`、`math.radians` |
| 双曲函数 | `math.sinh`、`math.cosh`、`math.tanh`、`math.asinh`、`math.acosh`、`math.atanh` |
| 取整与绝对值 | `math.ceil`、`math.floor`、`math.trunc`、`math.fabs` |
| 幂、根、对数 | `math.pow`、`math.sqrt`、`math.exp`、`math.log`、`math.log10`、`math.log2`、`math.factorial`、`math.expm1` |
| 浮点处理 | `math.modf`、`math.frexp`、`math.fmod`、`math.copysign`、`math.ldexp` |
| 比较与分类 | `math.isclose`、`math.isfinite`、`math.isinf`、`math.isnan` |
| 特殊函数 | `math.gamma`、`math.lgamma`、`math.erf`、`math.erfc` |

三角函数使用弧度，机器人航向通常使用度；用 degrees/radians 转换。`atan2(y, x)` 的两个参数顺序有意义。除法、开方和对数先检查输入范围，浮点相等比较考虑容差。

```python
import math
angle_degrees = math.degrees(math.atan2(100, 100))
print(angle_degrees)
```

文档列出函数不代表桌面 Python 的所有数学能力都存在于机器人中；冷门函数应先检查固件支持。

