# DAYI Agent 运行架构 V1.0

日期：2026-09-21  
状态：CURRENT ARCHITECTURE BASELINE  
适用范围：DAYI Workbench / DAYI Garden / 方案即时反馈 / 后续设计自动化 Agent

---

## 0. 本文的作用

这不是一份“未来愿景说明”，而是 DAYI Agent 接管时的运行边界和事实基线。

它解决四件事：

1. 明确什么已经存在，什么仍是目标态；
2. 明确 Agent 如何调用已经做好的产品，而不是重复造产品；
3. 明确谁对什么事实拥有最终解释权；
4. 为后续本地模型、云端模型、CAD、视频、文档等能力接入提供统一运行框架。

---

## 1. CURRENT 基线：方案即时反馈已经是现有能力

### 1.1 已确认的代码基线

DAYI「方案即时反馈」当前可用闭环，以 Git 提交：

`9ccd92b53df2763d681e540754b1448acafc6322`

为 2026-09-21 早晨 Work 最终调试与验收基线。

对应分支：

`codex/direction-feedback-automation-v2`

对应提交说明：

`Fix customer result routing and complete the delivery-to-view loop`

该版本已经完成并验证：

- 客户订单结果链接恢复；
- 后台查看客户结果；
- 客户结果页与后台交付结果打通；
- 同一页面切换订单链接时重新读取正确订单；
- 本地上传缓存异常时不再阻断结果页；
- 效果图加载失败时提供重试与直接打开入口；
- 后台交付后可直接核对客户视角；
- 最小“后台交付 → 客户看到结果”闭环浏览器验收。

因此从 Agent 架构角度：

> 「方案即时反馈」不是待开发 Agent，而是 DAYI 已经拥有的一个可调用 Capability / Product Runtime。

### 1.2 CURRENT 与 TARGET 必须分开

当前已经成立：

```
客户上传
→ 需求选择
→ ¥39.9 付款流程
→ 提交凭证
→ 人工核对实际到账
→ 后台读取订单资料
→ 人工上传方向图 + 3 条建议
→ 生成客户结果链接
→ 客户查看效果图和建议
```

当前仍未等同于正式生产能力的部分：

```
自动确认实际到账
自动选择模型
自动生成方向图
自动质量判断
自动重试
自动完成最终交付
```

现阶段正确表述是：

> 人工生产 / 人工交付闭环已跑通；自动生图与自动 QA 属于下一层 Agent 自动化能力。

不得把“自动化代码存在”“生产任务结构存在”误写为“无人值守自动生图已经正式上线”。

---

## 2. DAYI Agent OS 总体结构

DAYI 不采用“十几个 Agent 各自独立行动”的结构。

第一阶段采用：

```
                    大一 / Owner
                         │
                         ▼
                A0 Orchestrator
                 总调度 / 权限控制
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
       A1 Context Builder      Capability Router
         上下文组装              能力路由
              │                     │
              ▼                     ▼
        A2 Domain Planner      Image / Video / CAD
         专业任务规划          Docs / Web / Local
              │
              ▼
          A3 Executor
          实际执行层
              │
              ▼
           A4 QA
         独立质量审查
              │
              ▼
       A5 Archivist / Handoff
       归档 / 日志 / 交接 / 资产
```

Owner 始终在最上层。

DAYI Agent 的目标不是替 Owner 做价值判断，而是：

> 把资料整理、任务编排、模型调用、重复操作、质量检查、日志和交付这些工作自动化，把最终设计判断和创造力留给 Owner。

---

## 3. 六个运行角色

### A0 Orchestrator｜总编排器

职责：

- 接收自然语言任务；
- 判断任务类型；
- 拆分步骤；
- 调用 Context Builder；
- 选择需要的 Capability；
- 决定是否需要人工确认；
- 管理任务状态；
- 处理失败、重试和回滚；
- 确保高风险动作不越权。

A0 不直接承担专业设计判断，也不直接绑定具体模型。

典型输入：

> “把今天已付款的庭院订单处理一下。”

典型拆解：

```
读取订单
→ 核对状态
→ 读取原图和需求
→ 进入 Garden Planner
→ 调用图像能力
→ QA
→ 合格则交付
→ 不合格则重试 / 转人工
→ 写日志与归档
```

---

### A1 Context Builder｜上下文构建器

职责：

- 只提取本次任务需要的上下文；
- 区分当前事实、历史资料和旧版本；
- 调取客户订单、品牌规则、项目资料、设计原则；
- 避免把整个知识库一次性塞进模型。

核心原则：

> 最小充分上下文，而不是最大上下文。

优先级：

1. CURRENT 状态；
2. 当前订单 / 当前项目；
3. 当前专业规则；
4. 历史决策；
5. 旧版本仅作为参考。

---

### A2 Domain Planner｜领域规划器

它不是一个固定模型，而是一类专业 Planner。

可按任务加载不同专业规则：

- Garden Planner：庭院；
- Content Planner：内容；
- CAD Planner：图纸；
- Finance Planner：经营数据；
- Video Planner：视频；
- Knowledge Planner：知识整理。

Garden Planner 的任务不是直接“画图”，而是形成结构化设计意图，例如：

```json
{
  "preserve": ["原建筑尺度", "主要墙体", "真实入口关系"],
  "problems": ["排水", "维护", "动线"],
  "design_direction": "东方自然主义",
  "hardscape_ratio": "克制",
  "planting_density": "疏朗",
  "must_avoid": ["网红堆砌", "假尺度", "过度硬化"],
  "customer_priorities": ["老人友好", "低维护"]
}
```

---

### A3 Executor｜执行器

Executor 是“干活的人”。

它可以调用：

- 已有方案即时反馈系统；
- 图像模型；
- 视频模型；
- GitHub；
- Supabase；
- 本地脚本；
- CAD 自动化；
- 文档生成；
- 浏览器自动化；
- 后续 Mac mini 本地服务。

Executor 不能自行改变产品价格、品牌核心规则、客户承诺或安全边界。

---

### A4 QA / Critic｜独立质量审查

生成者不应自己给自己最终通过。

QA 必须独立于 Executor。

庭院图最低审查维度：

```
1. 原场地尺度是否保持
2. 建筑 / 门窗 / 围墙关系是否合理
3. 动线是否可用
4. 排水是否存在明显风险
5. 老人 / 儿童安全
6. 植物密度是否符合 DAYI 标准
7. 是否过度硬化
8. 是否出现网红堆砌
9. 是否满足客户核心需求
10. 是否具备真实可施工感
11. 是否明显 AI 幻觉
12. 是否值得向客户展示
```

QA 输出不只给“通过 / 不通过”，还应输出：

```json
{
  "status": "retry",
  "reason_codes": [
    "planting_too_dense",
    "scale_drift"
  ],
  "correction": [
    "减少地被覆盖",
    "恢复入口真实宽度"
  ]
}
```

---

### A5 Archivist / Handoff｜归档与交接

职责：

- 保存任务日志；
- 保存关键决策；
- 保存最终资产；
- 记录失败原因；
- 更新 CURRENT 状态；
- 给下一个 Agent 生成最小交接包。

目标：

> 换模型、换会话、换设备，不丢系统状态。

---

## 4. Capability Router 不是 Agent

Router 只解决一个问题：

> “这一步需要什么能力，现在调用谁最合适？”

例如：

```
image.generate
│
├── 本地模型
├── 云端 A
├── 云端 B
└── fallback
```

业务层只请求：

`image.generate`

而不是写死：

`必须调用某某模型`

Router 负责：

- 质量；
- 成本；
- 延迟；
- 隐私；
- 可用性；
- 模型版本；
- 失败切换；
- 是否允许云端。

这样以后替换模型时，不需要重写业务 Agent。

---

## 5. 一个事实只有一个权威源

DAYI 后续必须执行 Single Source of Truth。

### 当前状态与版本

权威源：

- 系统状态文档；
- 当前 Git 基线；
- 当前数据库状态。

### 为什么这样决定

权威源：

- Decisions / 决策日志。

### Agent 能做什么

权威源：

- Agent Runtime Architecture；
- Capability Registry；
- 权限规则。

### 机器状态与字段

权威源：

- Schema；
- State Machine；
- Registry；
- Guard。

### 庭院设计标准

权威源：

- Garden Domain Rules；
- DAYI Design Standard；
- QA Rubric。

### 聊天记录

聊天记录是：

> 证据、讨论过程、补充背景。

聊天记录不是长期系统事实的唯一权威源。

---

## 6. 「方案即时反馈」在 Agent 架构里的正确位置

错误理解：

```
Agent
→ 再开发一个方案即时反馈网页
```

正确理解：

```
Agent OS
│
└── Executor
    │
    └── Existing Capability:
        Garden Instant Feedback
```

也就是说，现有产品已经是工具。

Agent 要做的是“调用它”，而不是“重做它”。

---

## 7. 当前方案即时反馈运行链

### CURRENT：可营业的人工闭环

```
Customer
↓
上传真实庭院照片
↓
填写需求 / 面积 / 风格
↓
确认 ¥39.9 服务
↓
付款 + 上传凭证
↓
订单进入后台
↓
Owner 核对实际到账
↓
查看客户原图 / 需求 / Prompt 草稿
↓
人工生成 / 核对方向图
↓
上传效果图 + 3 条建议
↓
生成客户结果链接
↓
后台查看客户结果
↓
客户看到结果
↓
记录交付与查看状态
```

这条链是 CURRENT。

---

## 8. 下一层：自动生图 Agent 链

这是 TARGET / PILOT，不得与 CURRENT 混写。

```
paid order
↓
A0 Orchestrator
↓
A1 Context Builder
↓
Garden Planner
↓
Prompt Compiler
↓
Capability Router
↓
Image Worker
↓
Garden QA
↓
┌────────────────────────────┐
│ pass                       │ fail
▼                            ▼
Delivery Candidate        Retry Planner
│                            │
│                     limited retry
│                            │
│                     still fail
│                            ▼
│                      needs_human
▼
Human Gate / Auto Gate
↓
Existing Feedback Delivery API
↓
Delivery Verifier
↓
Customer Result Page
↓
completed
```

---

## 9. 自动生图的状态机

建议使用以下统一状态：

```
received
payment_pending
paid
planning
generating
qa_check
retrying
needs_human
approved
delivering
delivered
verified
completed
failed
```

其中：

### delivered

仅表示结果已经写入交付系统。

### verified

必须满足：

- 结果图存在；
- 图片可访问；
- 3 条建议完整；
- 客户结果链接有效；
- 客户结果页能加载。

### completed

只有在 verified 之后才能进入。

因此：

> 数据库写入成功 ≠ 客户收到结果。

这条规则来自已经发生过的真实问题，必须长期保留。

---

## 10. Human Gate

DAYI 不追求“一开始就 100% 无人化”。

第一阶段建议：

### 自动完成

- 读取订单；
- 组织上下文；
- Prompt 编译；
- 模型调用；
- 第一轮 QA；
- 明显错误自动重试；
- 生成候选结果；
- 日志。

### Owner 确认

- 最终设计判断；
- 高价值客户；
- 尺度明显复杂；
- 排水 / 高差 / 结构风险；
- QA 信心不足；
- 第一次使用新模型；
- 新风格或新工作流。

随着数据积累，Human Gate 可以逐步下沉。

---

## 11. Retry 机制

自动重试必须有限。

建议：

```
attempt 1
↓
QA fail
↓
针对失败原因修正 Prompt
↓
attempt 2
↓
QA fail
↓
切换参数 / 模型
↓
attempt 3
↓
仍失败
↓
needs_human
```

禁止：

- 无限重试；
- 无原因重复生成；
- 失败后静默交付；
- 为“自动化率”牺牲客户结果质量。

---

## 12. 失败码建议

统一错误码便于 Agent 学习：

```
INPUT_IMAGE_INVALID
ORDER_ACCESS_DENIED
PAYMENT_NOT_CONFIRMED
SCALE_DRIFT
LAYOUT_HALLUCINATION
PLANTING_TOO_DENSE
OVER_HARDSCAPED
DRAINAGE_RISK
SAFETY_RISK
STYLE_MISMATCH
CUSTOMER_NEED_MISSED
IMAGE_MODEL_TIMEOUT
IMAGE_MODEL_REJECTED
RESULT_UPLOAD_FAILED
RESULT_LINK_INVALID
RESULT_IMAGE_UNAVAILABLE
QA_LOW_CONFIDENCE
```

---

## 13. DAYI 的四层架构

为避免过去“二层 / 三层 / 四层”说法混乱，统一为四层。

### L1 Owner / Intent

人类目标、价值判断、最终权限。

### L2 Agent Runtime

Orchestrator、Context、Planner、QA、Archivist。

### L3 Capability / Execution

图像、视频、CAD、浏览器、Git、数据库、本地模型、云端 API。

### L4 Product & Data

方案即时反馈、大一工作台、数据库、订单、资产、日志。

关系：

```
Owner
↓
Agent Runtime
↓
Capability Layer
↓
Product / Data
```

---

## 14. 权限等级

### P0｜Owner Only

不得自动改变：

- 产品价格；
- 客户承诺；
- 品牌核心；
- 收款主体；
- 法务 / 财务重大动作；
- 删除重要资产；
- 修改冻结 UI；
- 大额付费调用；
- 对客户正式发送高风险内容。

### P1｜Agent 可执行但必须留痕

- 自动生成；
- 自动 QA；
- 自动重试；
- 写任务日志；
- 更新订单处理状态；
- 生成候选文案 / 图片。

### P2｜Agent 自主

- 读取；
- 分类；
- 检索；
- 本地分析；
- 格式转换；
- 测试；
- 非破坏性校验。

---

## 15. 数据边界

公开仓库可放：

- 前端；
- 公共文档；
- 测试；
- Schema；
- 非敏感运行规范。

私有核心保存：

- 核心 Prompt；
- 模型密钥；
- 支付密钥；
- 完整私有 Workflow；
- 客户敏感数据；
- 生产路由策略；
- 质量学习数据；
- 私有参考图库。

---

## 16. Mac mini / 本地运行的未来位置

未来 Mac mini 不是 DAYI OS 本身。

它是 Capability Layer 的一个执行节点。

```
DAYI Agent OS
│
├── Cloud Capability
│
└── Local Runtime
    ├── Local LLM
    ├── Image Model
    ├── CAD Worker
    ├── File Index
    └── Private Asset Store
```

DAYI 应允许：

> 同一个 Agent 任务，按隐私、质量、成本和速度动态决定本地还是云端执行。

---

## 17. 未来接入 Jev 等决策模型的位置

高频决策模型如果接入，应放在：

`Capability Router / Decision Engine`

而不是替代整个 DAYI Agent OS。

它可用于：

- 模型路由；
- 状态判断；
- 批量分类；
- 快速规则决策；
- 高频任务分发。

设计判断、项目上下文和最终责任仍由 DAYI Runtime + Owner 控制。

---

## 18. 当前优先级

### P0：现在

不再重做方案即时反馈。

重点是：

1. 把现有即时反馈系统登记为 Existing Capability；
2. 建立 Orchestrator 调用协议；
3. 定义统一 Task Schema；
4. 定义 Agent ↔ Existing Product 的接口；
5. 建立独立 QA；
6. 建立 Delivery Verifier；
7. 把 CURRENT / TARGET 状态机器化。

### P1：下一步

自动生图 Pilot：

```
已付款订单
→ Planner
→ Image Worker
→ QA
→ 人工确认
→ 自动回传
```

### P2：稳定以后

```
多个专业 Agent
→ CAD
→ 视频
→ 内容
→ 财务
→ 知识
→ 本地 Mac mini
→ 云端模型池
```

---

## 19. 第一份 Agent 接口建议

统一任务对象：

```json
{
  "task_id": "DAY1-TASK-...",
  "domain": "garden",
  "intent": "generate_direction_feedback",
  "source": {
    "type": "order",
    "order_code": "..."
  },
  "status": "received",
  "priority": "normal",
  "human_gate": true,
  "capabilities": [
    "order.read",
    "image.generate",
    "garden.qa",
    "delivery.publish"
  ]
}
```

结果对象：

```json
{
  "task_id": "DAY1-TASK-...",
  "status": "needs_human",
  "artifacts": [],
  "qa": {
    "status": "retry",
    "reason_codes": []
  },
  "next_action": "owner_review"
}
```

---

## 20. 版本治理规则

从本版本开始：

### CURRENT

表示：

> 代码 / 产品 /流程已经真实存在，并有可验证证据。

### PILOT

表示：

> 已实现部分能力，正在真实场景验证。

### TARGET

表示：

> 明确要做，但不能当作当前能力描述。

### ARCHIVED

表示：

> 历史方案，仅供追溯。

任何 Agent 不得把 TARGET 自动提升为 CURRENT。

---

## 21. 当前事实快照

截至 2026-09-21：

| 项目 | 状态 |
|---|---|
| 方案即时反馈客户端 | CURRENT |
| 业务后台 | CURRENT |
| 人工核对到账 | CURRENT |
| 后台查看原图 / 凭证 / Prompt | CURRENT |
| 人工上传效果图 + 3 条建议 | CURRENT |
| 客户结果链接 | CURRENT |
| 客户结果页 | CURRENT |
| 结果显示闭环 | CURRENT |
| 查看状态 / 版本记录 | CURRENT |
| 自动图像生产 | PILOT / NOT PRODUCTION |
| 自动 QA | TARGET |
| 自动重试 | TARGET |
| 自动最终交付 | TARGET |
| DAYI Orchestrator | TARGET / NEXT |
| Mac mini 本地执行节点 | TARGET |

---

## 22. 一句话原则

DAYI Agent OS 的核心不是“让更多 Agent 同时工作”，而是：

> 让一个清晰的编排中枢，调用已经存在的产品和能力，在 DAYI 标准下稳定完成任务，并把真正需要判断的部分交还给人。
