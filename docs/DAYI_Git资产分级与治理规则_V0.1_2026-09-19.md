# DAYI Git 资产分级与治理规则 V0.1

日期：2026-09-19

## 1. 双仓原则

DAYI 从现在开始按“公开资产 / 私有核心资产”分离。

### 公开仓库
当前：`Fendi945/dayi-garden`

适合保存：
- 产品愿景与路线图
- 可公开的应用规划
- 品牌理念
- 开源项目研究记录
- 非敏感架构说明
- 可公开的测试方法
- 对外可展示的产品文档
- 不包含真实客户信息的演示案例

禁止保存：
- API Key / Token / Secret
- 支付密钥
- Supabase Service Role Key
- 数据库密码
- 客户姓名、电话、地址、订单隐私
- 未脱敏的现场照片与客户资料
- 核心 Prompt 全量内容
- 私有工作流完整参数
- 商业模型成本底表
- 私有模型权重、授权文件
- 生产环境配置

### 私有核心仓库
建议单独建立 Private Repository，例如：
`dayi-core-private`

适合保存：
- DAYI Prompt System
- DAYI Design Rules
- DAYI Reference Library 索引
- ComfyUI / Workflow 生产 JSON
- 模型与节点版本锁定
- 质量评估规则
- 自动化调度逻辑
- 内部业务规则
- 生产环境部署配置模板
- 失败案例与修正策略
- 内部产品决策记录
- 脱敏后的真实订单训练 / 测试样本

## 2. 数据库与客户数据原则

Git 不是客户数据库。

真实客户数据应存储在：
- Supabase / 正式数据库
- 受控对象存储
- 明确权限的云存储

Git 中只允许：
- schema
- migration
- 脱敏样例
- 测试数据
- 字段定义

不得提交真实敏感客户数据。

## 3. 密钥管理

所有密钥使用环境变量或 Secret Manager。

代码中只出现：
```
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PAYMENT_SECRET=
```

实际值不得进入 Git。

必须加入 `.gitignore`：
- .env
- .env.*
- secrets/
- credentials/
- private/
- customer-data/

可提交：
- .env.example

不可提交：
- .env.production
- 真实凭证文件

## 4. DAYI 核心资产分级

### L0 可公开
品牌理念、公开产品介绍、通用研究。

### L1 内部
路线规划、未发布功能、内部讨论。

### L2 核心商业资产
Prompt、工作流、设计规则、质量判断体系、自动化生产逻辑。

### L3 敏感数据
客户数据、支付数据、访问凭证、生产密钥。

规则：
- Public Git 仅允许 L0。
- L1 视内容决定是否进入 Private Git。
- L2 必须 Private。
- L3 原则上不进 Git。

## 5. 开源代码引用规则

对任何外部开源项目记录：
- 项目 URL
- License
- 版本 / Commit
- 是否直接复用代码
- 是否只参考架构
- 修改内容
- 第三方版权声明

如直接引入代码：
- 保留原许可证
- 增加 THIRD_PARTY_NOTICES
- 上线前再次核验商业使用条件

## 6. 文档版本规则

公开文档：
`docs/DAYI_<主题>_Vx.x_YYYY-MM-DD.md`

私有文档建议：
`private-docs/<domain>/...`

重大判断变化：
- 新版本保留历史
- 不静默覆盖关键决策
- 记录变更原因

## 7. 提交规则

Commit 前检查：
1. 是否含客户隐私？
2. 是否含 API Key / 密钥？
3. 是否含生产 URL 中的敏感参数？
4. 是否含完整核心 Prompt？
5. 是否含未经许可的第三方文件？
6. 是否属于 Public Git 应保存的内容？

任何不确定内容：
默认不提交到 Public。

## 8. 当前执行决定

从 2026-09-19 起：

`Fendi945/dayi-garden`
定位为：
**DAYI Garden 公开产品 / 技术路线仓库**

未来私有仓库定位为：
**DAYI Core / DAYI Factory 私有核心资产库**

在私有仓库正式建立前：
核心 Prompt、客户数据、生产 Secret 与完整私有 Workflow 暂不写入任何公共 Git 仓库。
