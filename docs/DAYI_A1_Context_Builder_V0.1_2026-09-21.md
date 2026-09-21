# DAYI A1 Context Builder 运行协议 V0.1

日期：2026-09-21  
状态：PILOT SPEC  
上位架构：`docs/DAYI_Agent运行架构_V1.0_2026-09-21.md`

---

## 1. 定位

A1 Context Builder 负责为每个任务组装“最小充分上下文”。

它不负责做设计，不负责调用模型，不负责给最终结论。

它只做一件事：

> 从 DAYI 的多个事实源中，提取这次任务真正需要的信息，并按统一结构交给 Planner / Executor / QA。

---

## 2. 为什么需要 Context Builder

DAYI 的资料会越来越多：

- 客户订单
- 原图
- 项目需求
- 设计原则
- 品牌规则
- 历史项目
- 施工经验
- 产品状态
- 旧版讨论
- Prompt
- QA 规则
- 设备能力
- 模型能力

如果每次任务都把全部资料塞给模型，会带来：

- 旧信息污染当前任务；
- CURRENT 与历史版本混淆；
- Token 浪费；
- 模型过度联想；
- 不相关私人信息被带入任务；
- Planner 与 QA 判断标准漂移。

因此 A1 必须执行：

> 最小充分上下文，而不是最大上下文。

---

## 3. Context 组装顺序

优先级固定：

1. 当前任务本身；
2. 当前订单 / 当前项目事实；
3. 当前专业规则；
4. 当前产品与系统状态；
5. 当前 QA 规则；
6. 相关历史项目经验；
7. 决策日志；
8. 历史聊天只作为补充证据。

如果历史信息与 CURRENT 状态冲突：

> 以 CURRENT 权威源为准。

---

## 4. Garden Context 最小输入

针对方案即时反馈 / 庭院任务，最小输入应包含：

### A. Order Facts

- order_code
- yard_size
- style
- customer_needs
- notes
- contact presence
- payment_status
- process_status
- checkout_stage

### B. Site Evidence

- yard image ref
- original image availability
- image dimensions / orientation if available
- known site constraints
- known drainage / level / access constraints if explicitly provided

### C. DAYI Design Rules

- 东方自然主义
- 留白优先
- 少堆砌
- 真实尺度
- 低维护
- 先安全和使用，再谈氛围
- 克制硬化
- 植物疏朗
- 避免网红化
- 尊重现状，不做无必要大改

### D. Delivery Rules

- 当前产品 = 1 张方向图 + 3 条建议
- 不承诺施工图深度
- 不把方向图描述为完整施工方案
- 客户可见结果必须与订单一致

---

## 5. 不应自动注入的内容

除非任务明确需要，否则 A1 不应主动加入：

- 用户私人生活信息；
- 用户健康信息；
- 家庭信息；
- 与当前项目无关的财务信息；
- 无关客户项目；
- 旧版废弃 Prompt；
- 已归档 UI 方案；
- TARGET 能力当成 CURRENT；
- 过期价格；
- 未验证的模型表现；
- 与当前场地无关的个人偏好推断。

---

## 6. Context 分层

统一分四层：

### Level 0 — Hard Facts

不可被模型改写的事实：

- 订单号
- 当前价格
- 当前付款状态
- 当前交付状态
- 原图
- 已明确客户需求
- 当前 Git 基线

### Level 1 — Hard Rules

强约束：

- P0 权限
- 产品边界
- 设计安全原则
- QA 红线
- 交付验证规则

### Level 2 — Soft Preferences

可作为设计偏好：

- 东方自然主义
- 留白
- 疏朗
- 低维护
- 光影
- 克制材料

### Level 3 — References

参考案例、历史经验、风格图、旧项目。

Planner 可以借鉴，但不能把参考当事实。

---

## 7. Context Builder 输出

A1 输出统一 GardenContext：

```json
{
  "context_id": "DAY1-CTX-...",
  "task_id": "DAY1-TASK-...",
  "domain": "garden",
  "facts": {},
  "hard_rules": [],
  "preferences": [],
  "references": [],
  "unknowns": [],
  "warnings": [],
  "source_refs": []
}
```

其中：

### unknowns

明确写“不知道什么”。

例如：

- 现场标高未知
- 朝向未知
- 地下结构未知
- 排水去向未知

不得让模型自动脑补。

### warnings

例如：

- 仅一张现场照片
- 尺度信息不足
- 客户需求互相冲突
- 风格描述模糊

---

## 8. Context 不做推断

A1 不允许把推测变成事实。

例如：

错误：

> “这个院子应该有地下车库顶板。”

正确：

> “地下结构未知。”

错误：

> “客户肯定希望多种植物。”

正确：

> “客户明确需求中未说明植物数量偏好。”

---

## 9. Context 新鲜度

每个 Context 都必须记录：

- built_at
- source timestamps
- baseline refs
- stale_after（如适用）

订单状态类信息必须尽量实时。

长期设计原则可长期缓存。

---

## 10. Context 冲突处理

如果两个来源冲突：

A1 不自行选择最“合理”的那个。

必须输出：

```json
{
  "conflict": true,
  "sources": [...],
  "resolution": "needs_authoritative_source"
}
```

如果存在明确权威源，则使用权威源并记录：

`superseded_sources`

---

## 11. 与 Planner 的边界

A1 负责：

> “现在已知什么？”

Planner 负责：

> “基于这些已知信息，怎么做？”

QA 负责：

> “做出来的结果是否符合标准？”

三者不能混成一个角色。

---

## 12. 第一阶段实现目标

A1 V0.1 只需要稳定做到：

```
订单
→ 读当前状态
→ 读客户原图
→ 读需求
→ 注入当前 DAYI 设计规则
→ 注入产品边界
→ 明确未知项
→ 输出结构化 GardenContext
```

做到这一点以后，自动生图 Worker 才有稳定输入。
