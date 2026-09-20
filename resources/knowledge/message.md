# Message · 双机消息

AIM AI 整理，2026-09-20。中文速查与接口索引；完整参数和示例见[官方文档](https://api.vex.com/aim/home/python/Message.html)。

方法属于 `robot.link`，两台机器人须先建立连接。

| 接口 | 作用 |
| --- | --- |
| `send_message(message[, arg1, arg2, arg3])` | 发送文字及最多三个数值 |
| `get_message([timeout])` | 读取下一条文字消息 |
| `get_message_and_data([timeout])` | 读取文字与数值组成的元组 |
| `is_connected()` | 查询双机连接 |
| `is_message_available()` | 查询消息队列 |
| `get_name()` | 对端名称；未连接可能返回 None |
| `handle_message(callback, message)` | 注册指定文字消息回调 |
| `connected(callback[, args])` | 注册连接回调 |
| `disconnected(callback[, args])` | 注册断连回调 |

接收超时单位毫秒，默认 1000。先检查队列再接收；队列读取和回调处理应规划清楚，避免把同一消息重复消费。`args` 是回调实参元组。

教学用法：用消息名区分角色分配、球位置和状态；断连时回退到本机策略，不无限等待队友。

