# Compositor 研究记录

日期：2026-09-19  
项目：https://github.com/robbietilton/Compositor  
作者：https://robbietilton.com/compositor

## 1. 项目定位

Compositor 是一个 macOS 原生开源图像合成 / 编辑应用，工作逻辑接近轻量 Photoshop。

截至 2026-09-18，项目仍处于高速迭代状态，仓库最新提交已经发布 1.0.4 更新内容。

主要技术栈：
- SwiftUI
- AppKit
- Core Image
- Metal
- Sparkle

许可证：
- MIT

## 2. 已确认能力

项目源码与 Issue 可确认的方向包括：
- Layers / Folders
- Layer Mask
- Clipping Mask
- Blend Modes
- Adjustment / pixel processing
- Selection
- Brush
- Blur
- Smear / Liquify / Smudge
- Burn / Dodge
- Content-Aware / Subject removal 相关能力
- 图像导入导出
- GPU 加速画笔

项目仍在快速补齐能力：
- Text Tool 仍有开放 Issue
- PSD 支持仍有开放 Issue
- Windows / Linux 版本均有社区需求

## 3. 为什么不直接拿来做 DAYI

当前代码高度依赖 Apple 平台原生框架。

因此：
- 不是 Windows 直接重编译即可运行
- 不适合作为 DAYI Web 前端直接嵌入
- 跨平台移植成本较高

如果未来 DAYI 主要服务 Windows / Web，应抽象“编辑能力”，而不是复制其完整 Mac App。

## 4. 对 DAYI 最有价值的部分

重点研究四类基础能力：

1. Layer Engine
2. Mask Engine
3. Selection Engine
4. GPU Render / Composite Engine

以及：
- 非破坏性调整
- 图层混合
- 局部编辑
- 选区与 Mask 的数据结构
- Undo / Editor Session 设计
- 图像导入 / 渲染 / 导出链

## 5. DAYI 的不同方向

Compositor 的交互逻辑：

用户  
→ 选择工具  
→ 设置参数  
→ 手工操作画布

DAYI 的目标：

用户  
→ 说出想要的结果  
→ Agent 理解目标  
→ 自动选区 / Mask / 编辑 / 合成  
→ 返回结果

示例：

“把右边的红枫换成腊梅。”

后台：
1. 目标识别
2. 定位对象
3. 生成 Mask
4. Remove / Inpaint
5. 生成腊梅
6. 调整尺度与透视
7. Relight
8. Composite
9. 质量检查

用户无需理解 Photoshop 术语。

## 6. 对庭院设计的语义层启发

未来效果图建议逐步拆为：
- building
- wall
- door/window
- sky
- tree
- shrub
- groundcover
- lawn
- pavement
- water
- rock
- furniture
- lighting

这样自然语言修改可直接落到具体对象，而不是每次整张重绘。

## 7. 近期可做 PoC

PoC 1：
“保留建筑，只重绘庭院区域。”

PoC 2：
“删除指定杂物，并自然补全背景。”

PoC 3：
“把指定植物替换成另一植物。”

PoC 4：
“只改变铺装材质，不改变空间结构。”

PoC 5：
“把池水颜色、亮度、反射调自然。”

## 8. License 注意事项

MIT 允许商业使用、修改和再分发，但复用代码时应保留原版权与许可声明。

正式引入 DAYI 代码库之前：
- 明确哪些代码为直接复用
- 哪些只是架构参考
- 增加 THIRD_PARTY_NOTICES / LICENSE 记录
- 对每个依赖单独核验其 License

## 9. 当前结论

不 fork Compositor 作为 DAYI 主工程。

把它作为：
**DAYI AI 图像编辑层的重要参考实现。**

尤其用于理解成熟的图层、Mask、Selection、像素处理和 GPU 编辑架构。

DAYI 真正需要构建的是：
**Natural Language Agent + Garden Semantic Model + Image Editing Engine。**
