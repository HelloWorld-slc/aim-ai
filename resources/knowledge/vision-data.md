# 图像识别 · 数据读取、空结果与多目标

AIM AI 中文整理及原创示例，2026-09-21。来源：VEX Robotics [AI Vision Python](https://api.vex.com/aim/home/python/AI_Vision.html)、[Understanding the Data](https://kb.vex.com/hc/en-us/articles/35145536891028-Understanding-the-Data-in-the-AI-Vision-Utility)。示例方法和属性另对照本机 AIM_20250901_10_00_00 SDK 声明；声明核对不等于实机通过。

## 数据含义

对象的中心、起点和宽高是图像像素；`bearing` 是视线相对偏角，不是机器人全局航向。`type` 先区分类别体系，`id` 才能在该体系中解释；同一个整数不一定指同一种物体。`score` 用于 AI 分类，不应给所有颜色或标记对象套用同一置信度判断。官方机器人端 API 将该值说明为 1～100；MCP / WebSocket 值按其实际返回契约处理。

`get_data` 的返回结果可能为空；结果按宽度降序排列，第一个不保证最近、分数最高或是上一帧同一目标。完整过滤参数及属性见 `vision`。

## 原创 Python 读取示例

下面只采样和打印，不发运动命令。独立示例可放入机器人端 AIM Python 项目；加入已有项目时复用已有的初始化区域。40 次、100 毫秒是本例采样设置，不代表相机帧率或推荐控制周期。

```python
from vex import *
robot = Robot()

for sample in range(40):
    balls = robot.vision.get_data(SPORTS_BALL, 3)
    valid = [obj for obj in balls if obj.exists]
    if valid:
        target = min(valid, key=lambda obj: abs(obj.bearing))
        print(sample, len(valid), target.centerX,
              target.centerY, target.width, target.bearing, target.score)
    else:
        print(sample, "no ball detected")
    wait(100, MSEC)
```

## 本项目使用建议

本例选择最靠近正前方的球；任务也可选择宽度最大的球，但必须明确选择理由。多球接近时，逐次重新选择可能跳到另一目标；实际追踪应结合上一位置、允许变化范围和失踪时间，不能把列表索引当稳定跟踪 ID。

循环内重新采样后再判断，避免永久使用循环外的旧对象。`exists` 只描述这次取得的结果。像素宽度不能直接填进毫米运动参数；看到球与已持球分开判断，详见 `vision-football`。

相关：`vision`、`vision-decisions`、`vision-geometry`。
