# 架构与后续工作

## 当前结构

```text
VS Code 侧栏
  → Assistant：模型请求、3 个编程工具、2 个按需机器人工具、修改建议、备份/恢复
  → Conversations：工作区对话、原子持久化、历史摘录
  → Provider：服务预设、协议与思考参数适配
  → Application：Windows 官方应用启动，不经 shell
  → Knowledge：31 篇本地资料、分类层级、关键词与方法名检索、来源
  → Projects：官方项目配置、单文件源码、.aimpython 转换
  → Validation：Python AST + VS Code diagnostics
  → Devices：已安装官方 VEX 扩展的有限命令桥接
  → RobotDebug：专用 Python 环境、按需连接、单步测试、结果分析
      → TypeScript MCP Client → stdio → Python 适配层
          → VEX-AIM-MCP 函数 → 官方 AIM WebSocket 库 → 机器人
```

AI 可调用 `read_reference`、`get_diagnostics`、`propose_program`；启用机器人辅助时另外开放 `read_robot_snapshot`、`propose_robot_test`。模型不能执行终端、任意文件操作、运动、下载或运行项目。API Key 使用 VS Code SecretStorage；Webview 不持有密钥，使用 CSP、禁用原始 HTML 的 Markdown 解析与 DOMPurify 白名单清理。模型地址只能从用户级配置指定，项目不能替换地址收走密钥。HTTP 重定向不跟随。

资料索引包含 `group`、可选 `parent` 和 `source`。激活时加载全部内置摘要，验证文件名、唯一 id 和父级引用；资料页本地搜索标题、关键词及正文，Logic 子页可展开。初始模型上下文固定加入运行指南，再选最多 3 篇相关资料，合计不超过 16,000 字符；英文 API 采用词边界匹配，并支持从完整调用名提取方法名。AI 可按索引 id 继续读取资料，不接受任意路径。

`src/core` 不依赖 VS Code，便于以后复用到 CLI/MCP。暂时不创建本地网络控制端口。对话由 `Conversations` 按工作区写入扩展 `storageUri/conversations`，单份 JSON 原子替换并串行写入；`active.json` 恢复上次选中的对话。文件损坏时保留原件并报告，单份文件上限 20 MB。每次发送仅选择近期最多 6 条/16,000 字符作为历史摘录，避免缺少原始思考签名的旧显示消息冒充服务商协议消息。本次工具循环保留服务商原始 reasoning/signature 字段，公开返回的思考文本单独存入聊天记录，签名/加密思考块只在本次 API 工具循环保留，不展示或存进聊天。每约 2 秒串行持久化回答检查点，完成与中断最终落盘；恢复未完成记录时标记中断。修改恢复副本存于扩展 globalStorage 的 `history`。副本包含源码，当前版本不自动清理；可使用 VS Code 打开的扩展数据目录管理。

项目文件索引仅查找 `.vscode/vex_project_settings.json`，主程序路径必须位于项目内。导出保存元数据，源码检查期间发生变化会拒绝此次导出。AI 修改前校验原文未发生变化，并再次检查保存恢复副本期间的并发编辑。

## 为什么没有直接套用大型 AI 扩展

首版只需单文件编程、少量受控工具和 AIM 文件互通。复用 VS Code 的编辑、诊断、凭据功能及官方 VEX 扩展，比维护一个大型通用 AI 扩展分支更直接。模型接口用平台自带 fetch；资料按关键词检索，不额外部署向量数据库。开源不意味着运行模型免费，主要降低维护和重复开发成本。

## 分阶段交付

1. **已实现、无需实机**：API 配置/请求，资料检索，检查，差异预览/应用/恢复，AIM 文件导入导出，新建项目，保存自动导出。
2. **等待用户参与**：真实模型的工具调用兼容性、SDK诊断、USB设备识别、选槽下载、停止、低速正方形实测。逐项记录具体版本和结果。
3. **协议验证后决定**：蓝牙文件下载。VS Code Webview 不能假定具有浏览器完整 Web Bluetooth 能力；先确认官方公开接口、设备协议、运行环境。若无稳定通道，保留官方应用下载路径。
4. **已整合 MCP 调试，通用客户端接口待设计**：0.4.0 使用本地 stdio MCP 连接机器人适配层；当前作为插件内部服务，不是供所有客户端直接操作整个项目的通用服务器。真实双向同步需要官方接口、版本标识和冲突合并，不以后台键鼠操控冒充 API。
5. **课堂规模化**：教师网关额度控制、项目模板库、活动记录导出、Windows 10独立验证、更多模型供应商适配。

## 开源范围

源码以 MIT 发布于 https://github.com/HelloWorld-slc/aim-ai ，安装包通过 GitHub Releases 分发，尚未发布市场。发布排除 `.vscode-test`、测试日志、`.research`、API Key、本机环境及学生内容；不捆绑官方专有软件。0.4.0 捆绑 MIT 许可的上游 Python 源码，固定提交与许可见 `robot/UPSTREAM.md`。

流式协议由 eventsource-parser 切分，Chat Completions 与 Claude Messages 分别聚合文本、思考和工具参数，收到完成标记才允许处理工具。Webview 以消息 ID 更新同一条回答，界面节流约 70 ms。完整代码块由 Markdown AST 检测，jsdiff 统计行数，原生 vscode.diff 使用不可变只读快照；应用前仍检查当前源码没有并发变化。

## MCP 机器人边界

扩展使用 `@modelcontextprotocol/sdk` 1.30.0，与 Python `mcp` 1.30.0 配套维护，固定版本便于复现。后台仅注册连接、快照、有限测试、停止、断开 5 个工具；未注册上游完整工具集。Python 通过无 shell 的隐藏子进程启动，stdout 专用于 MCP，SDK 诊断转入 stderr。应用不开放本地 HTTP 控制端口。

`aimAI.robotAutoConnect` 默认开启，但只有依赖安装完成、连接设置已保存时才向 AI 提供自动能力。模型调用读取 / 提案时才连接，普通回答不触发连接。一轮只允许一次连接尝试、两次状态读取，最多三轮模型调用。手动测试结果由用户主动发送分析；模型读取得到的数据以受限摘要返回，不包含图像。

官方 `Robot()` 初始化发送 ProgramInit、重置会话朝向，并打开状态 / 命令 / 图像 / 音频连接，因此这是新的远程调试会话，不能并行旁观已下载的学生程序。构造函数在 Python 主线程调用；连接超时由 TypeScript 侧结束子进程。真实状态要求连接有效、非空且更新距今不超过两秒。

运动入口由扩展持有随机令牌，模型上下文和 Webview 均不持有。AI 只能登记有效两分钟的方案；用户按钮才走执行入口。TypeScript 与 Python 分别校验距离、角度、速度，后台拒绝并发动作。测试超时与取消尝试停止，失败后要求重新连接；网络停止请求不被表述为物理停止保证。

`--simulate` 创建无机器人网络连接的内存对象。模式标签贯穿 MCP 返回、界面与模型摘要，测试结果不能冒充实机验证。状态读取会替换旧结果，避免界面将上次运动报告当作最新快照。
