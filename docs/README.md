# DAYI Garden｜文档索引

最后更新：2026-09-21

这里用于保存 DAYI Garden / DAYI Workbench 的长期产品、技术、工作流和决策资料。

## 核心路线

- [DAYI Agent 运行架构 V1.0](./DAYI_Agent运行架构_V1.0_2026-09-21.md)
- [DAYI A0 Orchestrator 运行协议 V0.1](./DAYI_A0_Orchestrator_V0.1_2026-09-21.md)
- [DAYI 产品与应用路线图 V0.1](./DAYI_产品与应用路线图_V0.1_2026-09-19.md)
- [DAYI Factory V1 讨论归档](./DAYI_Factory_V1_讨论归档_2026-09-18.md)
- [DAYI Workflow 测试矩阵与评估表 V0.1](./DAYI_Workflow测试矩阵与评估表_V0.1_2026-09-19.md)

## 技术研究

- [Compositor 研究记录](./Compositor_研究记录_2026-09-19.md)

## Git 与资产治理

- [DAYI Git 资产分级与治理规则 V0.1](./DAYI_Git资产分级与治理规则_V0.1_2026-09-19.md)

## 当前 P0

### 已完成 CURRENT

方案即时反馈已跑通：

进入 → 上传 → 描述 → 付款 → 人工核对到账 → 人工交付方向图与3条建议 → 客户结果页可见

2026-09-21 Work 最终验收代码基线：

`9ccd92b53df2763d681e540754b1448acafc6322`

分支：

`codex/direction-feedback-automation-v2`

### 下一步 TARGET

不再重做方案即时反馈网页，转向 Agent 上层自动化：

订单 → Planner → Image Worker → 独立 QA → Human Gate → 现有交付系统 → Delivery Verifier

自动生图、自动 QA、自动重试、自动最终交付在完成真实生产验证前，不标记为 CURRENT。

## 长期资产

- DAYI Prompt System
- DAYI Reference Library
- DAYI Workflow
- 真实订单数据
- 设计规则与质量评估标准
- 失败案例与修正策略
- 产品决策记录

> 注意：核心 Prompt、客户数据、生产密钥、支付密钥、完整私有 Workflow 不进入公共仓库。


## 机器协议

- `machine/task.schema.json`：统一 Task 对象
- `machine/capabilities.registry.json`：Capability Registry 与成熟度
- `machine/orchestrator.policy.json`：A0 权限、Human Gate、Retry、交付验证规则
- `machine/task.state-machine.json`：统一任务生命周期状态机

机器层约定：能力成熟度 `CURRENT / PILOT / TARGET / ARCHIVED` 与任务运行状态完全分离；`TARGET` 不得自动视为 `CURRENT`。
