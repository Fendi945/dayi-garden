# DAYI Garden Domain Contract V0.1

日期：2026-09-21  
状态：PILOT SPEC  
用途：庭院类 Agent 的统一专业输入 / 输出契约

---

## 1. 目标

Garden Domain Contract 不是一份设计教程。

它定义：

> 所有庭院 Planner、Image Worker、QA、Delivery Worker 都必须共享的专业事实、约束和输出格式。

这样无论后面换 GPT、Qwen、本地模型、Jev 或其他模型，专业结构不变。

---

## 2. DAYI Garden 核心设计原则

### 必须长期保留

1. 真实尺度优先；
2. 使用和安全优先于氛围；
3. 留白优先于堆砌；
4. 减少无必要硬化；
5. 植物疏朗，而不是密铺；
6. 低维护优先；
7. 尊重现场，不做无必要大改；
8. 排水、高差、老人儿童安全属于优先检查项；
9. 不追求“网红感”；
10. 不用单一廉价色调统一全部空间；
11. 材料、植物、光影应有真实施工逻辑；
12. 图像必须尽量保留原场地关系。

---

## 3. 方向反馈产品边界

当前 39.9 元方向反馈是：

- 1 张方向图；
- 3 条设计建议；
- 帮助客户判断“这个方向是否值得继续深化”。

它不是：

- 完整方案设计；
- 施工图；
- 精确竖向设计；
- 完整植物施工清单；
- 结构设计；
- 排水施工图；
- 造价承诺。

任何 Agent 不得把轻产品输出说成重交付。

---

## 4. Planner 输入

Planner 必须接收：

- GardenContext；
- Product Contract；
- DAYI Design Rules；
- Customer Priorities；
- Site Evidence；
- Unknowns；
- Current Task Intent。

---

## 5. Planner 输出

统一输出 GardenPlan：

```json
{
  "preserve": [],
  "remove_or_reduce": [],
  "problems_to_solve": [],
  "spatial_strategy": [],
  "planting_strategy": [],
  "material_strategy": [],
  "drainage_safety_notes": [],
  "visual_direction": "",
  "must_avoid": [],
  "unknowns_blocking_precision": [],
  "delivery_notes": []
}
```

---

## 6. Image Worker 输入

Image Worker 不直接读整个订单系统。

它只读：

- 原图；
- GardenPlan；
- 图像 Prompt Contract；
- Image Constraints。

这样可以降低信息污染。

---

## 7. Image Constraints

必须保留：

- 原有主要建筑关系；
- 门窗位置；
- 围墙关系；
- 入口位置；
- 大尺度比例；
- 主要高差关系（如果原图能判断）；
- 主要已有植物或构筑物（如果 Planner 要求保留）。

禁止：

- 凭空放大院子；
- 改变建筑体量；
- 新增不存在的远景空间；
- 把狭小空间变成大庭院；
- 生成无法施工的悬浮结构；
- 用过多植物遮盖场地问题；
- 用光影掩盖尺度错误。

---

## 8. Garden QA 红线

出现以下任一项，默认不能直接交付：

- SCALE_DRIFT
- LAYOUT_HALLUCINATION
- DRAINAGE_RISK
- SAFETY_RISK
- CUSTOMER_NEED_MISSED
- BUILDING_RELATION_CHANGED
- OVER_HARDSCAPED
- PLANTING_TOO_DENSE
- RESULT_IMAGE_UNAVAILABLE

---

## 9. Garden QA 评分维度

QA 至少检查：

1. 场地尺度；
2. 建筑关系；
3. 动线；
4. 安全；
5. 排水风险；
6. 客户核心需求；
7. 植物密度；
8. 硬化比例；
9. DAYI 风格一致性；
10. 真实可施工感；
11. AI 幻觉；
12. 是否值得给客户看。

QA 不需要做“审美打分排行榜”。

它只需要判断：

- pass
- retry
- needs_human
- fail

并说明原因。

---

## 10. 三条建议契约

3 条建议必须：

- 与图中方向一致；
- 能被普通客户理解；
- 至少一条回应核心需求；
- 至少一条涉及使用 / 维护 / 安全；
- 不假装已经完成精确施工设计。

建议避免空泛词：

- “更高级”
- “更有氛围”
- “更美观”

应尽量具体：

- 减少硬铺，让主要活动区集中在入口和休息区；
- 靠墙区域采用疏朗耐阴植物，减少长期维护；
- 正式施工前先确认墙根防潮与院内排水去向。

---

## 11. 精度等级

为了防止 Agent 过度承诺，统一分三级：

### L1 Direction

方向反馈。

可以说：

- 布局方向；
- 风格方向；
- 减法建议；
- 材料与植物策略。

不可以说：

- 精确尺寸已定；
- 施工节点已确定。

### L2 Design

正式设计。

包含：

- 功能布局；
- 主要尺寸；
- 材料关系；
- 深化设计。

### L3 Construction

施工级。

包含：

- 标高；
- 排水；
- 节点；
- 结构；
- 专业施工图。

当前 39.9 产品 = L1。

---

## 12. Unknowns 原则

如果缺信息：

> 降低精度，而不是编造信息。

例如：

“现场排水去向未知，因此本次只给出排水方向建议，正式施工前需现场复核。”

---

## 13. 领域契约的目标

Garden Contract 的作用不是限制创造力，而是：

> 把不应该反复重新判断的底线固定下来，把真正需要创造力的部分留给 Planner 和 Owner。
