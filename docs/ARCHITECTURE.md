# 个人写作系统技术架构与数据规范（ARCHITECTURE）

> **状态**：架构方案已确认（方案 C：底层解耦 + V1 独立本地 Web 工作台，已完成试跑参数校准）
> **最后更新**：2026-11-25

---

## 1. 架构选型与分层设计

采用**「Local-first 本地 Markdown 真源 + 无头核心引擎 + 表现层解耦」**的三层架构：

```text
┌───────────────────────────────────────────────────────────────────┐
│  表现层（UI / Surfaces）                                           │
│  ├── [V1] 独立本地 Web 工作台（React + Vite，双栏写作与 Diff 体验） │
│  └── [未来可选] dsh (DeepSeek Harness) 工具型插件 / CLI            │
├───────────────────────────────────────────────────────────────────┤
│  无头核心引擎（Core Engine，Node.js + TypeScript）                 │
│  ├── VaultStore        本地 Markdown / YAML 读写与版本管理         │
│  ├── CleanDiffEngine   轻度清洗 + 词/句级 Git 式 Diff 与 Revert    │
│  ├── RoundContextMgr   Round 会话管理、版本 Diff 计算与共识压缩    │
│  ├── ArchiveRetriever  立场库 / 经历库检索与跨碎片选题聚类         │
│  ├── ComplianceGate    发布前内容合规 + 个人/公司隐私双检          │
│  └── LLMProvider       DeepSeek / OpenAI 兼容协议流式客户端        │
├───────────────────────────────────────────────────────────────────┤
│  持久化真源（Local Vault，纯文本 Markdown + YAML）                 │
│  └── vault/  （完全人类可读，不锁死任何软件，可用 Git/Obsidian 打开）│
└───────────────────────────────────────────────────────────────────┘
```

### 为什么选型为「底层解耦 + V1 独立 Web 工作台」而非直接写重度 `dsh` UI 插件？
1. **交互契合度**：本系统核心是「Document-first」双栏工作台（左侧固定编辑器 + Git 式逐处 Revert Diff + 版本对比；右侧按 Round 沉淀的主编对话），独立 Web 界面布局自由、手感最佳。
2. **上下文可控性**：多轮改稿需要精确拼装每一轮的上下文（当前正文 + 上版 Diff + 已确认共识 + 命中过的历史立场），避免通用聊天框越聊越长导致模型失焦或“手痒代写”。
3. **稳定性与演进**：`dsh`（DeepSeek Harness）处于快速迭代的 Developer Preview 阶段，UI Slot 契约可能存在破坏性变更；将核心逻辑与 `vault/` 资产库保持独立无头设计，既保证 V1 零外部破坏风险，也确保未来需要联网/Agent 能力时，可随时补一个极轻的 `dsh` 纯工具型插件共享同一份 `vault/`。

---

## 2. 本地数据目录与文件格式规范（`vault/`）

所有用户思想资产均以纯文本存放在本地 `vault/` 目录下（默认与代码库分离或放在可单独备份/Git 同步的路径中）：

```text
vault/
├── config.local.yaml               # 本地配置（API BaseURL、模型名等；Key 建议放 .env 或系统环境变量）
├── inbox/                          # 1. 收件箱（原始口述碎片，正文只读留存）
│   └── 2026-11-25-001-slug.md
├── articles/                       # 2. 文章项目区（一篇一目录）
│   └── 2026-11-25-topic-slug/
│       ├── meta.yaml               #    文章元信息、来源碎片 ID、锁定承重句、当前阶段、标题候选
│       ├── cleaned.md              #    经 Diff 逐处确认/Revert 后的清洗底稿
│       ├── clean-diff.json         #    清洗操作记录（保留每处变更的 accept/revert 状态）
│       ├── map.md                  #    现状脉络图（层次、重复处、逻辑断层）
│       ├── drafts/                 #    作者亲手修改的每一版正文
│       │   ├── v1.md
│       │   ├── v2.md
│       │   └── ...
│       ├── rounds/                 #    按轮次沉淀的主编诊断、讨论记录与本轮共识
│       │   ├── round-01.md
│       │   └── round-02.md
│       ├── compliance.md           #    发布前双重合规与隐私审查报告
│       └── final.md                #    公众号长文定稿（预留排版/复盘扩展字段）
└── archive/                        # 3. 个人写作主体档案馆
    ├── stances/                    #    立场库（一条核心判断一文件，记录演进/自我修正历史）
    │   └── stance-001.md
    └── experiences/                #    经历库（一段可追溯个人经验一文件）
        └── exp-001.md
```

### 2.1 关键文件 Schema 约定

#### （1）收件箱碎片：`inbox/YYYY-MM-DD-NNN-slug.md`
```markdown
---
id: "frag-20261125-001"
created_at: "2026-11-25T10:30:00+08:00"
source: "ima-voice"
status: "raw"              # raw | clustered | promoted | archived
tags: ["AI写作", "工具与思考"]
candidate_load_bearing:
  - "原话摘录 1..."
candidate_experiences:
  - "提到的真实经历简述..."
linked_articles: []
---

（此处为从 ima 复制进来的原始口述文本，系统永远以只读方式保存，不做原地修改。）
```

#### （2）文章项目元数据：`articles/<slug>/meta.yaml`
```yaml
id: "art-20261125-001"
title: ""                               # 最终定稿标题
stage: "revising"                       # cleaning | mapping | revising | compliance | finalized
writing_intent:                         # 写作初衷 / 触发场景（立项时选填，或在 Round 1 对话中补全沉淀）
  trigger: ""                           # 触发写作的具体事件或痛点
  target_audience: ""                   # 主要想说给谁听
  desired_effect: ""                    # 希望读者看完产生什么认知转变
source_fragments:
  - "frag-20261125-001"
current_draft_version: 2                # 对应 drafts/v2.md
current_round: 2                        # 对应 rounds/round-02.md
load_bearing_sentences:                 # 作者锁定的承重句
  - id: "lb-1"
    text: "核心原话..."
    dimension: "sharp_judgment"         # sharp_judgment | personal_experience | stance_revision
title_candidates:                       # 标题共创结果
  - title: "候选标题 A"
    angle: "反常识判断切入"
    selected: false
publish_meta:                           # V2 扩展预留位（排版、配图、复盘）
  platform: "wechat_mp"
  published_at: null
  retrospective_note: null
```

#### （3）轮次记录：`articles/<slug>/rounds/round-NN.md`
```markdown
---
round: 1
draft_version: 1
created_at: "2026-11-25T14:00:00+08:00"
status: "settled"          # active | settled
consensus:                 # 提交下一版时提炼并由作者确认的本轮共识
  - "同意第 2 段和第 4 段重复，合并处理"
  - "否决主编关于删掉比喻 X 的建议，作者决定保留该个人表达"
referenced_stances:
  - "stance-001"
---

## 主编诊断（基于 v1）
...（5 维度结构化诊断 + 追问）...

## 对话记录
### Author
...
### Editor
...
```

#### （4）立场档案：`archive/stances/stance-NNN.md`
```markdown
---
id: "stance-001"
topic: "AI 与写作主体性"
status: "active"           # active | revised | deprecated
created_at: "2026-11-25"
source_article: "art-20261125-001"
supersedes: null           # 若修正/推翻了过去的立场，指向旧 stance ID
tags: ["AI", "写作"]
---

### 核心判断
（一句话精准概括作者在此时间点的立场）

### 依据与上下文
（当时的出发点与主要论据）
```

---

## 3. 核心模块设计细节

### 3.1 轻度清洗与 Git 式 Revert Diff（`CleanDiffEngine`）
- **核心要求**：不能只把整段扔给 LLM 让它吐回清洗文本，否则难以防止模型偷偷改写句式。
- **实现策略**：
  1. LLM 仅输出结构化的「原子修改补丁列表（Edit Operations）」：`[{ index, original, suggested, reason: "typo" | "filler" }]`，严格禁止大段改写；
  2. 后端校验每个 patch 的原文锚点与改动比例（防止越界润色），计算标准词/字符级 Diff（如 `diff-match-patch` 或 `diff`）；
  3. 前端以 Git 风格高亮展示每一处删改（红色删除线 / 绿色新增），每处卡片带 `Revert / Keep` 切换按钮，状态实时落盘 `clean-diff.json` 并合成 `cleaned.md`。

### 3.2 多轮改稿的上下文工程（`RoundContextMgr`）
这是防止“对话越长、AI 越傻/越爱代写”的关键机制：

- **单轮对话内（Active Round）**：
  - System Prompt：固定注入「主编人设（风格 A）+ 绝不给正文范文铁律 + 5 维度诊断规范」。
  - 固定工作上下文：当前版本正文 `vN.md` + 锁定承重句 + 历史轮次共识摘要 + 检索命中的相关历史立场/经历。
  - 会话历史：仅携带**本轮（Round N）**的自由讨论消息。
- **跨轮次切换（提交 `v(N+1)` 时）**：
  1. 自动计算 `vN.md → v(N+1).md` 的文本 Diff；
  2. 将 Round N 的讨论记录压缩为 3–6 条「已达成共识 / 已否决建议」（展示给作者可微调确认）；
  3. 开启全新的 `Round N+1`，不再塞入前几轮的冗长原始聊天流水，只带入「最新正文 + 本次改稿 Diff + 累积共识列表 + 历史立场」，保持上下文始终干净高信噪比。

### 3.3 立场/经历检索与碎片聚类（`ArchiveRetriever`）
- **V1 轻量策略（无重型向量数据库依赖）**：
  - 个人写作库在千条规模以内，完全不需要引入复杂基础设施。
  - 通过「标签 + 关键词索引 + LLM 轻量语义重排（把档案的标题与一句话摘要列表作为索引交给模型筛选 Top-K 关联项）」即可做到极高的召回准确度，同时 100% 基于本地纯 Markdown 文件运行，零额外运维成本。

### 3.4 模型适配层（`LLMProvider`）
- 统一采用 **OpenAI Chat Completions 兼容协议**（天然同时支持 DeepSeek 官方 API 与市面上绝大多数中转站）。
- 支持按任务配置模型路由（默认共用同一模型，后续可按需拆分）：
  - 轻量任务（碎片打标、共识压缩、轻度清洗补丁）：可用性价比/高速模型；
  - 深度任务（脉络透视、主编诊断与多轮对话、合规与隐私审查）：可用推理能力更强的旗舰模型。
- 全部对话与诊断支持 **SSE 流式输出**，保证交互响应顺滑。

### 3.5 双重合规与隐私审查（`ComplianceGate`）
- 独立于改稿对话的专用审查流程，使用独立的审查 System Prompt 与结构化输出：
  - **维度 A（发布合规）**：法律法规红线、微信公众平台运营规范高风险点、绝对化/争议性失实风险。
  - **维度 B（隐私与商业机密）**：直接标识（姓名、公司、产品/项目代号、精确内部指标）+ 间接组合标识（时间/岗位/特定事件细节组合导致熟人或同行可反推）。
- 审查结果以结构化风险卡片展示（高/中/低风险分级 + 原文高亮定位 + 风险解释 + 最小脱敏方向），同时保存至 `compliance.md` 留痕。

---

## 4. V1 推荐技术栈

以「单人本地运行、启动零心智负担、代码清晰易维护」为首要目标：

- **运行时与语言**：Node.js + TypeScript（前后端同语言，核心引擎 `packages/core` 与接口类型直接复用）
- **后端服务**：Fastify 或 Hono（轻量本地 HTTP + SSE 服务，读写 `vault/`）
- **前端工作台**：React + Vite + Tailwind CSS
  - 编辑器：清爽的 Markdown 编辑体验（支持划词提问、版本切换）
  - Diff 组件：支持行内高亮与单处 Revert 交互的定制视图
- **包管理**：pnpm monorepo 结构预览：

```text
writing-system/
├── docs/
│   ├── PRD.md
│   └── ARCHITECTURE.md
├── packages/
│   ├── core/            # 无头核心引擎（VaultStore / CleanDiff / RoundMgr / Archive / Compliance / LLM）
│   ├── server/          # 本地 HTTP/SSE API 层
│   └── web/             # V1 独立本地 Web 工作台
└── vault/               # 本地写作资产目录（默认 gitignore 或独立仓库管理）
```

---

## 5. 经真实口述稿试跑校准的 Prompt 与交互参数

基于 2026-11-25 真实口述稿试跑结果，以下核心规则固化进 Core Engine 的 Prompt 与交互契约：

1. **轻度清洗规则（`CleanDiffEngine`）**：
   - **默认修正**：语音同音错字（含行业/研发术语误识别）、明显漏标点、相邻段落同一术语识别不一致；
   - **可选标记（供一键 Revert）**：口语重复叠词；
   - **明确禁止触碰**：口语连接词（“我觉得”“那么”“其实”等）、作者习惯的直白口语表达、句式语序。
2. **脉络透视与承重句提取**：
   - 脉络图需明确标出**段落间边界模糊、主题漂移、视角跳切、首尾脱节**四类结构问题；
   - 候选承重句控制在 **2–5 句（典型 3–4 句）**，必须逐字引用原文并标注命中的判据类型。
3. **主编对话契约（`RoundContextMgr`）**：
   - 首轮诊断固定 5 维度（承重墙 / 逻辑结构 / 公摊套话 / 经验暗门 / 历史立场）+ **3–4 个聚焦追问**；
   - 若 `meta.yaml` 中的 `writing_intent` 为空或正文隐藏了触发场景，Round 1 需主动探询写作初衷与目标读者；
   - 当作者在讨论中补出关键背景或合理解释时，主编 Prompt 明确要求**即时更新框架、收回不再成立的旧建议**，并在结算本轮时同步更新 `writing_intent` 与 `consensus`。

