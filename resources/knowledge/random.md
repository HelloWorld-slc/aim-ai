# Random · 随机数

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Logic/Random.html)。

先 `import random`。

| 接口 | 范围 / 说明 |
| --- | --- |
| `random.randint(a, b)` | 整数，包含 a 和 b |
| `random.uniform(start, end)` | 区间浮点数 |
| `random.randrange([start,] stop[, step])` | 在 range 序列中选一个整数，不含 stop |
| `random.random()` | 大于等于 0、小于 1 的浮点数 |
| `random.getrandbits(n)` | n 位随机整数，官网 n 为 0～32 |
| `random.choice(sequence)` | 从非空序列取一个元素 |

课堂可随机选择待机表情或搜索方向；不要随机决定危险速度或覆盖槽位。调试固定输入和策略，记录随机分支，便于复现。

