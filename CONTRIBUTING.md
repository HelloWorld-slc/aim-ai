# 参与 AIM AI

欢迎帮助修正 AIM API、改善教学流程、适配模型和补充真实设备验证。先阅读 [README](README.md) 与 [架构](docs/ARCHITECTURE.md)，涉及新功能时可先开 Issue 说明课堂场景。

## 本地开发

使用 Node.js 22+、桌面 VS Code；Python 3.10+ 用于语法检查及机器人测试。

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run package
```

安装生成的 VSIX，或用 VS Code 扩展开发宿主加载项目。打包命令同时生成第三方库许可；不要手工修改 `dist` 或 `media/webview.js`。

## 机器人模拟测试

Windows PowerShell：

```powershell
py -3 -m venv .robot-runtime
.robot-runtime/Scripts/python.exe -m pip install --only-binary=:all: -r robot/requirements.lock
.robot-runtime/Scripts/python.exe tests/robot_backend_test.py
npm run test:robot
```

其他系统可将 Python 路径设置为 `AIM_AI_ROBOT_PYTHON`。这些测试建立真实 MCP stdio 通道，但动作由模拟对象执行，不连接实机，不使用付费模型。

扩展宿主测试使用本机 VS Code，可设置 `AIM_AI_VSCODE` 指定可执行文件：

```powershell
$env:AIM_AI_VSCODE = 'C:/Program Files/Microsoft VS Code/Code.exe'
node tests/run-integration.cjs
```

脚本在 `.vscode-test` 创建隔离工作区与用户配置，两次启动检查对话恢复；会联网安装机器人 Python 依赖。模型请求来自本机模拟服务。

可选界面测试需要 Playwright 和 Edge：将 `AIM_AI_PLAYWRIGHT` 指向已有 Playwright 模块，再执行 `node tests/webview.cjs`。它使用独立、无界面浏览器与模拟消息桥，不访问日常浏览器资料。结果放在忽略的 `test-results` 目录。

## 修改约定

- 让改动对应具体问题，保持中文界面易懂；更新相关使用说明。
- AIM 机器人端 Python 与电脑端 WebSocket Python 是两套接口，不要混用。
- 给行为变化增加针对性测试。静态、模拟、真实模型、实机结果分别记录，不能互相替代。
- 不增加任意 shell 执行、未经本轮授权的模型运动或凭据暴露路径；自主运动应保留批量边界、停止与结果来源。
- API Key 不进入项目、聊天记录、日志或截图；示例用虚构值。
- 上游代码固定版本，优先在适配层修改。更新 vendor 时同步来源提交、许可及兼容测试。

## 提交 Pull Request

使用仓库模板说明问题、行为变化和实际运行的测试。对界面变化附无隐私截图；涉及硬件注明操作系统、固件、连接方式和观察结果。没测到的部分请直接标明。

提交贡献即表示你有权提供这些内容，并同意原创贡献按本项目 MIT 许可分发。第三方代码与文档保留各自许可和来源。
