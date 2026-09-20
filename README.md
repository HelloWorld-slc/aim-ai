<div align="center">

<img src="docs/assets/banner.png" alt="AIM AI — AI-assisted coding for VEX AIM" width="900" />

**在 VS Code 中，用自然语言编写、检查和调试 VEX AIM Python。**

AI-assisted VEX AIM coding · Built for the classroom

**简体中文** · [English](README.en.md)

[![CI](https://github.com/HelloWorld-slc/aim-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/HelloWorld-slc/aim-ai/actions/workflows/ci.yml)
[![Preview](https://img.shields.io/badge/preview-0.5.0-48c9b0)](https://github.com/HelloWorld-slc/aim-ai/releases/tag/v0.5.0)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS_Code-1.96%2B-007ACC)](https://code.visualstudio.com/)

[下载安装](https://github.com/HelloWorld-slc/aim-ai/releases) · [机器人配网](docs/ROBOT_DEBUG.md) · [测试记录](docs/TESTING.md) · [参与贡献](CONTRIBUTING.md)

</div>

---

AIM AI 把模型对话、官方 API 速查、代码差异、项目导出和机器人调试放进同一个侧栏。学生描述目标，AI 提出代码，学生查看修改并测试；教师可以复用项目模板组织课堂活动。项目起源于《绿茵智控：AI 足球机器人挑战项目》，也适用于正方形行走、视觉识别和运动控制入门。

> **当前为 0.5.0 预览版。** 编辑与项目互通已验证；MCP 流程已通过模拟测试，Wi-Fi 连接和状态读取已在一台实机验证；新增自主批量运动的物理效果、下载仍待现场验收。本项目是独立开源工具，与 VEX Robotics 无隶属或授权关系。

## 能做什么

| 能力 | 使用方式 |
| --- | --- |
| 对话编程 | 描述任务，AI 读取当前程序与相关资料，生成修改建议 |
| 看清修改 | 右侧原生差异视图显示逐行增删；点击应用才修改代码，支持恢复 |
| 流式回答 | Markdown、表格、代码高亮、实际模型名；显示接口公开返回的思考内容 |
| 保存上下文 | 对话自动保存在本机；新对话保留历史，支持搜索、继续、重命名和删除 |
| 查阅 AIM API | 32 篇中文速查，覆盖 Python 全部 15 类与 Logic 12 个子页 |
| 项目互通 | 创建 / 导入 / 导出 `.aimpython`；手动导出后自动用 VEXcode AIM 打开 |
| 机器人调试 | 按需 Wi-Fi 连接、可选字段读取、自主批量测试、遥测误差比较 |
| 自选模型 | DeepSeek、Qwen、Kimi、GLM、OpenAI、Claude、Gemini 预设及自定义接口 |

<p align="center">
  <img src="docs/assets/chat.png" alt="AI 回答、思考展示与代码修改入口" width="310" />
  &nbsp;&nbsp;
  <img src="docs/assets/autonomous.png" alt="对话中的自主运动与不使用 MCP 选项" width="310" />
</p>

<p align="center"><sub>截图来自隔离的界面测试，回答、模型名与机器人数据为演示样例，不代表真实模型或实机验收。</sub></p>

## 五分钟开始

### 1. 安装

从 [GitHub Releases](https://github.com/HelloWorld-slc/aim-ai/releases) 下载 `aim-ai-0.5.0.vsix`。在 VS Code 扩展页选择 **⋯ → 从 VSIX 安装**，安装后执行 **Developer: Reload Window**，打开侧栏的 **AI** 图标。

当前通过 GitHub 分发，尚未上架扩展市场。

### 2. 打开 AIM 项目

使用 **打开文件夹** 选择 AIM Python 项目根目录，例如 `AIM_Square`。目录内应有 `.vscode/vex_project_settings.json`；只打开一个 `.py` 文件无法识别项目。

没有项目时，在「项目」页新建空白 / 100 mm 正方形模板，或导入 `.aimpython`。新建与导入需要已由 **VEX 官方 VS Code 扩展** 下载 AIM Python SDK；未安装时先用官方扩展创建一次 AIM Python 项目。

### 3. 配置自己的模型

在「模型」页选择服务商，确认接口地址和模型 ID，输入自己的 API Key，然后测试连接。模型名称及可用思考档位以账号和服务商支持情况为准，预设可以修改。

API Key 保存到 VS Code SecretStorage，不写入项目、聊天记录或版本库。服务商按自己的规则计费，本插件不附带模型额度。

### 4. 描述、检查、应用

> 请让机器人以 20% 速度走一个边长 100 mm 的正方形，完成后停止。先查 AIM 的运动接口，并说明修改。

等待回答和右侧代码比较 → 查看增删 → **应用修改** → **检查代码** → 保存。语法检查通过不等于真实动作正确。

### 5. 导出并打开

点击 **导出 .aimpython**，默认交给已安装的 VEXcode AIM 打开。之后通过官方应用进行机器人连接和下载。

`.py` 是源码，`.aimpython` 是项目容器，**不能只改后缀**。手动导出与打开已在 VEXcode AIM 4.67.0 验证；网页端导入仍待独立验证。

## 机器人连接与 AI 调试

0.5.0 整合 [flashzdw/VEX-AIM-MCP](https://github.com/flashzdw/VEX-AIM-MCP) 与 [VEX 官方 WebSocket 库](https://github.com/VEX-Robotics/AIM_Websocket_Library)，保留上游 MIT 许可与固定版本记录。

1. 在「机器人」页点击 **安装调试环境**，需要 Python 3.10+。
2. 先用 **模拟演示** 验证界面；实机使用 [配网教程](docs/ROBOT_DEBUG.md) 获取 IP。
3. 保存 IP 并保留 **AI 按需自动连接**。AI 需要状态时自动连接，无需再次确认；普通聊天不会先连接。
4. 在对话框展开 **机器人辅助与自主调试**。勾选 **本轮允许 AI 自主运动调试** 后，AI 可直接执行一批测试并分析结果，无需逐步再次确认。未勾选时保持只读和手动测试建议。

自主运动默认关闭，每次发送后取消勾选，历史不会恢复授权。AI 被要求尽量少移动、短距离验证；必要的多步动作合并一次请求，只返回一份汇总。每轮最多一批 8 步，总移动 800 mm、总转动 360°、预计用时含余量 45 秒，速度 10–30%。参数在整批开始前校验，偏差或失败会停止后续步骤。聊天取消会向后台发出停止请求。

| 调试能力 | 说明 |
| --- | --- |
| 自主运动 | 本轮勾选后可前进 / 后退 1–200 mm，左 / 右转 1–90°，一次合并多步 |
| 返回参数 | AI 可选电量、位置、朝向、停止状态、视觉，也可请求全部已开放字段 |
| 判断结果 | 每步位移与转角误差、容差比较、整批净位移；AI 收到汇总后给出结论 |
| 未开启自主运动 | 读取状态、提出待点击建议；不直接移动 |
| 项目修改与下载 | 应用代码、下载 / 运行项目仍使用用户按钮 |

连接会开启新的远程调试会话，并重置会话朝向。它不能旁观验证机器人上已下载的学生程序，也不提供蓝牙文件传输。断网时停止请求无法保证送达。

本地连接与手动测试不调用模型；AI 辅助每轮最多 3 次模型请求、2 次状态读取，仅传输受限摘要。详见 [连接、费用与排障](docs/ROBOT_DEBUG.md)。

## 不使用 MCP 也能编程

MCP 是可选模块。无需安装机器人调试依赖或连接后台，仍可问答、写代码、查资料、查看差异、保存历史、导出项目。在对话框勾选 **本轮不使用 MCP（只编程）**，可覆盖自动连接设置。未安装环境时自动回到普通编程；连接失败时报告原因，继续静态分析，不编造测试结果。

新增的 **资料 → MCP 调试** 详细解释所有开放参数、单位、字段筛选、批量报告和容差；自主运动时相关指南会提供给 AI。遥测比较可以辅助排查运动问题，但不等于外部量测，也不能证明编辑器中整段程序已执行正确。

## 环境与兼容性

| 组件 | 用途 |
| --- | --- |
| 桌面 VS Code 1.96+ | 运行扩展；重点面向 Windows，当前本地验收为 Windows 11 |
| Windows 10 | 课堂目标系统，尚待独立机器验收 |
| 模型 API 与互联网 | 使用 AI；支持 Chat Completions 兼容接口与 Claude Messages |
| Python 3 | 本地语法检查；机器人调试要求 3.10+ |
| VEX 官方 VS Code 扩展 / AIM SDK | 新建、导入项目及实验性的官方下载命令桥接 |
| VEXcode AIM 桌面应用 | 自动打开导出的项目，再使用官方连接 / 下载功能 |
| AIM 机器人与互通 Wi-Fi | 可选的真实机器人调试；模拟演示无需硬件 |

普通使用者不需要安装 Node.js、Git、Docker、向量数据库或单独配置 MCP 客户端。机器人 Python 依赖按需安装到插件专用环境。

## 范围与数据

- **项目格式：** 当前处理单文件 AIM Python；不打包积木、多文件程序或自定义音视频资源。
- **同步：** 保存自动导出只更新文件，已打开的 VEXcode AIM 不会自动刷新；尚无双向实时同步。
- **资料：** 内置自行整理的中文摘要、接口索引与官方链接，覆盖分类不等于镜像全部教程。MicroPython 14 个模块提供官方文档入口。
- **思考：** 仅展示 API 返回的可见文本；服务商未提供的隐藏思考无法读取。关闭流式可兼容不支持 SSE 的接口。
- **历史：** 完整对话和思考文本保存在本机工作区扩展数据目录；发送近期历史摘录时不附带保存的思考文本。
- **模型输入：** 提问、当前程序、近期历史与相关资料发往用户选择的服务；开启机器人辅助后可包含状态摘要。不会上传摄像头画面。
- **实机：** 官方扩展下载 / 运行桥接默认关闭，`aimAI.experimentalHardware` 可开启；实际兼容性仍待验收，与 Wi-Fi 调试开关独立。

## 开发与贡献

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run package
```

开发建议 Node.js 22+。机器人后端测试另外创建 Python 环境并安装 `robot/requirements.lock`；完整命令、VS Code 集成测试和界面测试见 [贡献指南](CONTRIBUTING.md)。

```text
src/                  扩展、AI 对话、项目与机器人客户端
media/                侧栏界面与模型标识
resources/knowledge/  AIM Python 速查资料
robot/                MCP 适配层、上游代码和固定依赖
tests/                核心、扩展宿主、界面与机器人模拟测试
docs/                 使用说明、架构和验证记录
```

欢迎提交接口错误修正、真实设备兼容记录、课堂案例和模型适配。请使用仓库的 Issue / Pull Request 模板，报告结果时区分 **模拟、实机、真实模型**。

[架构](docs/ARCHITECTURE.md) · [测试记录](docs/TESTING.md) · [版本记录](CHANGELOG.md) · [第三方许可](THIRD_PARTY_NOTICES.md) · [贡献指南](CONTRIBUTING.md)

## 许可与致谢

原创代码采用 [MIT License](LICENSE)。感谢 VEX-AIM-MCP、VEX AIM WebSocket Library、MCP SDK，以及 Markdown、流式解析和代码差异相关开源项目。捆绑依赖的版权和许可随包保留。

VEX 与模型服务商的名称、标识和文档属于相应权利人，不因本项目开源而转为 MIT 授权。详见 [第三方说明](THIRD_PARTY_NOTICES.md)。
