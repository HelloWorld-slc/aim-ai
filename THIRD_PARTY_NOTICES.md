# 第三方与资料来源

本扩展的原创代码以仓库 LICENSE（MIT）提供。VEX、VEXcode、AIM 名称与标识属于相应权利人；本扩展不代表官方产品。

本 VSIX 未捆绑 VEX 专有 SDK、固件、vexcom、官方应用或扩展。它检测用户已有安装，通过 VS Code 命令调用已安装扩展；相关软件仍遵循其原有许可。0.4.0 另外捆绑下文所列 MIT 许可的官方 WebSocket Python 库。资料为自行整理的中文摘要和接口索引，每篇附官方链接；没有复制整站教程。官方 API 名称用于说明兼容接口，不意味着官方文档整体采用本项目的 MIT 许可。

复用与构建工具：

| 项目 | 用途 | 许可/来源 |
| --- | --- | --- |
| VS Code 扩展 API | 侧栏、文件操作、SecretStorage、诊断、差异编辑器 | https://github.com/microsoft/vscode （源码 MIT；应用发行版遵循微软产品许可） |
| TypeScript | 编译检查 | https://github.com/microsoft/TypeScript （Apache-2.0） |
| esbuild | 本地打包 | https://github.com/evanw/esbuild （MIT） |
| tsx | TypeScript 测试运行 | https://github.com/privatenumber/tsx （MIT） |
| @vscode/vsce | VSIX 打包 | https://github.com/microsoft/vscode-vsce （MIT） |
| @types/node | 构建类型声明 | https://github.com/DefinitelyTyped/DefinitelyTyped （MIT） |
| @types/vscode | 构建类型声明 | https://github.com/microsoft/vscode （MIT） |

上表构建依赖仅用于开发，`node_modules` 不分发进 VSIX。插件使用 VS Code 提供的 Node.js；可选机器人调试在专用 Python 环境安装锁定的依赖，见 `robot/requirements.lock`。

官方参考入口：

- https://api.vex.com/aim/home/
- https://api.vex.com/aim/home/python/index.html
- https://docs.micropython.org/en/v1.22.0/library/index.html
- https://code.vex.com/
- https://kb.vex.com/

未来如直接复制或捆绑第三方实现，需保留其相应许可与版权声明；不要将 VEX 专有组件重新发布为本项目 MIT 源码。

## 模型服务标识

`media/providers` 中的 DeepSeek、Qwen、Kimi、GLM、OpenAI、Claude、Gemini 标识下载自官方站点或服务商官方 GitHub 组织，保留原始图片；用于识别所连接的服务，不表示合作或官方背书。标识的商标与图片权利仍属各自权利人，不适用本项目原创代码的 MIT 授权。逐项下载来源、主页、日期和校验值见 `media/providers/SOURCES.json`。对外发布前应按各品牌的使用规则复核。

Gemini 星形图片来自 Google 官方 `google-gemini/cookbook` 的示例资源，原仓库 Apache-2.0 许可副本随附于 `media/providers/GEMINI-LICENSE.txt`；商标权仍由权利人保留。

## 随扩展打包的开源运行库

| 库 | 用途 | 官方源码 / 许可 |
| --- | --- | --- |
| markdown-it | Markdown 解析和代码块检测 | https://github.com/markdown-it/markdown-it · MIT |
| DOMPurify | HTML 白名单清理 | https://github.com/cure53/DOMPurify · 选择 Apache-2.0 |
| highlight.js | Python / JSON / diff 高亮 | https://github.com/highlightjs/highlight.js · BSD-3-Clause |
| eventsource-parser | SSE 分段解析 | https://github.com/rexxars/eventsource-parser · MIT |
| jsdiff（diff） | 新增/删除行统计 | https://github.com/kpdecker/jsdiff · BSD-3-Clause |
| @modelcontextprotocol/sdk | 本地 MCP stdio 客户端 | https://github.com/modelcontextprotocol/typescript-sdk · MIT |

这些运行库及所需传递依赖已编译进本地脚本，不从 CDN 加载。完整版权和许可见 `resources/licenses/BUNDLED-DEPENDENCIES.txt`。原生代码差异编辑器由 VS Code 提供。

## 机器人后端

| 项目 | 复用内容 | 许可副本 |
| --- | --- | --- |
| [flashzdw/VEX-AIM-MCP](https://github.com/flashzdw/VEX-AIM-MCP) | 连接管理及运动 / 传感器 / 视觉工具函数 | `robot/vendor/VEX-AIM-MCP-LICENSE.txt` · MIT |
| [VEX-Robotics/AIM_Websocket_Library](https://github.com/VEX-Robotics/AIM_Websocket_Library) | 官方 `vex` Python 通信库 | `robot/vendor/VEX-WEBSOCKET-LICENSE.txt` · MIT |

固定提交、原始路径和适配行为见 [robot/UPSTREAM.md](robot/UPSTREAM.md)。原有版权声明保留，AIM AI 的适配层不把第三方作品重新声明为自身原创。

Python `mcp`、`websocket-client` 等依赖不打入 VSIX，由用户点击安装环境后按锁定清单下载，遵循各自包内许可。没有加入图像分析模型、OpenCV、Docker 或上游的完整自动控制工具集。

JavaScript 运行库许可通过 `scripts/licenses.mjs` 从实际构建输入自动收集，当前 24 个包；缺少许可证时构建失败。README 的自制横幅与模拟界面截图是项目文档资源，模型标识仍遵循上文商标说明。
