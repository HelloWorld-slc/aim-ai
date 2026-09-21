# 图像识别 · 颜色签名与颜色码

AIM AI 中文整理，2026-09-21。来源：VEX Robotics [Configuring Color Signatures](https://kb.vex.com/hc/en-us/articles/35107943103636-Configuring-Color-Signatures-in-VEXcode-AIM)、[Configuring Color Codes](https://kb.vex.com/hc/en-us/articles/35120469450004-Configuring-Color-Codes-in-VEXcode-AIM)。

## 官方配置要点

颜色签名用于检测选定颜色，需要先配置；官方 Utility 配置需要有线连接。把单色目标放到相机前，只框选目标颜色内部，避免混入背景；保存并命名，在控制面板核对。最多同时跟踪 7 个颜色签名。

色相和饱和度范围可以调整。官方建议以能稳定框住目标为度，避免过度放宽。颜色码由已配置颜色组成；官方配置说明为 2～4 种颜色，色块应相互靠近，否则可能被当成独立颜色。

## 本项目选用建议

预训练物体类别回答“像哪种已知对象”；颜色签名回答“哪里有这种颜色”。给红色贴纸配置颜色，不等于教会模型识别“球门”这个新语义类别。多个相同颜色物体同时出现时，仍需选目标规则。

调参时同时检查目标与背景。扩大范围若增加误检，应恢复上一组参数，再改善采样区域或照明。换场地后用原参数复测；保存采样光照、配置名称及测试结果，避免仅保存一组脱离环境的 RGB 数值。

## 与 Python 项目互通

构造和注册接口见 `vision`：颜色定义需要注册后才能使用，`get_data` 传已配置对象，不能把任意中文颜色名当作已定义变量。导入或编辑已有程序时保留生成配置区域与描述对象，避免覆盖颜色设置。

官方 Python 的颜色码声明列出额外参数但说明数量不完全一致；本项目先使用两个已校准颜色组合，扩展前查 SDK 并实测。`Color` 屏幕颜色、LED 颜色与视觉 `Colordesc` 分属不同用途；`colors` 资料讲的是绘图颜色，不能替代视觉签名配置。

相关：`vision`、`vision-environment`、`vision-errors`、`exchange`。
