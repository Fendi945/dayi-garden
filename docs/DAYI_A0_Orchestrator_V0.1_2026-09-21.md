# DAYI A0 Orchestrator 运行协议 V0.1

日期：2026-09-21  
状态：PILOT SPEC  
上位架构：`docs/DAYI_Agent运行架构_V1.0_2026-09-21.md`

---

## 1. 定位

A0 Orchestrator 是 DAYI Agent OS 的总调度器。

它不是“最聪明的模型”，也不是某个固定供应商模型，而是负责：

- 接收自然语言任务；
- 生成标准 Task；
- 找到本次任务需要的 Context；
- 调用 Domain Planner；
- 根据 Capability Registry 选择能力；
- 控制 Human Gate；
- 管理状态、重试、失败和回滚；
- 触发 QA；
- 验证最终交付；
- 把运行日志交给 Archivist。

A0 不直接拥有 DAYI 的设计判断权。

Owner 始终是 P0 最终权限持有人。

---

## 2. 输入

自然语言入口示例：

> 把今天已付款的庭院订单处理一下。

A0 首先不执行“生成图片”，而是创建 Task：

```json
{
  "task_id": "DAY1-TASK-...",
  "domain": "garden",
  "intent": "generate_direction_feedback",
  "source": {
    "type": "order",
    "order_code": "..."
  },
  "status": "received"
}
```

之后才进入规划和路由。

---

## 3. A0 的最小循环

```
Intent
↓
Create Task
↓
Resolve Context
↓
Check Preconditions
↓
Plan
↓
Resolve Capabilities
↓
Execute
↓
QA
↓
Human Gate if required
↓
Deliver
↓
Verify
↓
Archive
↓
Complete
```

任何一步失败，都必须写明：

- failure_code
- failure_reason
- retryable
- next_action

不得静默失败。

---

## 4. 前置条件检查

A0 在执行前必须先检查：

### 订单类任务

- 订单是否存在；
- 订单访问是否有效；
- 是否已经提交；
- 是否需要确认实际到账；
- 是否已有结果；
- 是否正在生产；
- 是否存在重复任务。

### 图像生产

- 原图是否可读取；
- 原图是否达到最低质量；
- 客户需求是否完整；
- 是否允许云端处理；
- 是否需要 Human Gate。

### 交付

- 效果图是否存在；
- 三条建议是否完整；
- QA 是否通过；
- 是否满足当前交付策略。

---

## 5. Human Gate

A0 必须把“是否需要人确认”当成 Task 的一等字段，而不是临时判断。

强制 Human Gate 的场景：

- P0 价格、收款、品牌核心或正式客户承诺；
- 高差、排水、结构、安全等专业风险；
- QA 低置信度；
- 新模型首次用于真实客户；
- 三次有限重试后仍失败；
- 高价值客户；
- 结果虽无明显错误但设计判断不足。

Human Gate 状态：

`needs_human`

通过后：

`approved`

---

## 6. Retry

A0 只允许有限重试。

默认策略：

```
attempt 1
→ QA fail
→ reason-aware correction
→ attempt 2
→ QA fail
→ parameter/provider change
→ attempt 3
→ still fail
→ needs_human
```

禁止：

- 无限重试；
- 无失败原因的重复生成；
- 失败后自动降低 DAYI 质量标准；
- 为提升“自动化率”绕过 Human Gate。

---

## 7. Capability Resolution

A0 不允许业务逻辑写死具体模型。

业务只声明需要：

- `order.read`
- `image.generate`
- `garden.qa`
- `delivery.publish`
- `delivery.verify`

Capability Router 再依据 Registry 解析到当前可用实现。

因此：

```
A0:
"我需要 image.generate"
```

而不是：

```
A0:
"调用某某固定模型"
```

---

## 8. CURRENT 方案即时反馈的调用方式

当前人工闭环已经存在。

A0 不得重新开发它。

正确位置：

```
A0
↓
Existing Capability
↓
Garden Instant Feedback
```

当前基线代码：

`9ccd92b53df2763d681e540754b1448acafc6322`

当前可直接视为 Existing Capability 的能力包括：

- 订单资料读取；
- 客户原图 / 凭证读取；
- Prompt 草稿读取；
- 人工方向图 + 3 条建议交付；
- 客户结果链接生成；
- 客户结果页读取；
- 交付版本和查看状态；
- 结果页显示闭环。

自动生图和自动 QA 尚不得标记为 CURRENT。

---

## 9. Delivery Verifier

A0 不允许把“写入成功”当成任务完成。

必须经过：

`delivered → verified → completed`

verified 至少满足：

- 效果图存在；
- 效果图可访问；
- 3 条建议存在；
- 客户结果链接有效；
- 结果页可加载本订单；
- 订单号与结果一致。

这条规则是硬约束。

---

## 10. A0 不做什么

A0 不：

- 擅自改价格；
- 擅自改收款主体；
- 擅自改 DAYI 品牌原则；
- 擅自删除长期资产；
- 擅自把 TARGET 当 CURRENT；
- 擅自把“模型调用成功”写成“客户已收到”；
- 擅自改变冻结 UI；
- 擅自无限重试。

---

## 11. 运行数据

A0 每次任务至少写入：

```
task_id
intent
domain
source
status
capabilities_requested
capabilities_resolved
attempt_count
human_gate
qa_status
artifacts
failure_code
next_action
timestamps
```

这些字段以 `machine/task.schema.json` 为准。

---

## 12. 权威源

A0 读取规则：

1. 当前系统状态 / Git 基线；
2. Task Schema；
3. Capability Registry；
4. Orchestrator Policy；
5. Domain Rules；
6. Decisions；
7. 历史聊天作为补充证据。

若历史聊天与 CURRENT 文件冲突，以 CURRENT 文件为准。

---

## 13. 第一阶段目标

V0.1 不追求无人值守。

第一阶段只要求 A0 能稳定做到：

```
自然语言任务
→ 标准 Task
→ 正确读取现有订单
→ 正确调用现有 Capability
→ 不越权
→ 有限重试
→ QA / Human Gate
→ 可验证交付
→ 可交接日志
```

这是 DAYI 从“能做很多事”进入“可以稳定接管”的关键一步。
