# Kicker · 踢球器

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Kicker.html)。

`robot.kicker.kick(force)` 踢出吸附物体；力度常量 `SOFT`、`MEDIUM`、`HARD`。`robot.kicker.place()` 轻放物体。

先确认 `robot.has_sports_ball()`，再根据进攻方向决定是否踢球。看到球与已经持球是两个判断。初次实测用低力度，测量射程后调整；避免在高频循环中连续触发踢球。

推荐程序结构：搜索 → 对准 → 接近 → 持球确认 → 调整朝向 → 踢球 → 重新搜索。每一步增加超时处理。

