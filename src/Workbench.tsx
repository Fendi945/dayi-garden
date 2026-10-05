import { useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  BriefcaseBusiness,
  ChevronRight,
  CirclePause,
  CirclePlay,
  FolderKanban,
  Home,
  Library,
  ListFilter,
  Search,
  Send,
  Settings,
  Sparkles,
} from "lucide-react";

type Section = "Home" | "Product" | "Business" | "Project" | "Knowledge";

const navItems = [
  { name: "Home" as const, label: "首页", icon: Home },
  { name: "Product" as const, label: "产品", icon: Boxes },
  { name: "Business" as const, label: "经营", icon: BriefcaseBusiness },
  { name: "Project" as const, label: "项目", icon: FolderKanban },
  { name: "Knowledge" as const, label: "知识", icon: Library },
];

const sectionData = {
  Product: {
    kicker: "价值定义",
    title: "产品",
    intro: "我们提供什么价值，以及每一项承诺如何被准确交付。",
    metrics: [["在售项目", "38"], ["待发布", "04"], ["定价问题", "02"]],
    columns: [
      ["产品目录", "商品", "服务", "数字产品", "套餐"],
      ["商业规则", "价格表", "版本", "可售范围", "渠道"],
      ["履约规则", "交付规则", "服务标准", "依赖关系", "例外事项"],
    ],
    note: "两个项目需在十月渠道发布前完成定价决策。",
  },
  Business: {
    kicker: "经营脉搏",
    title: "经营",
    intro: "价值如何进入市场并形成经营，从客户与商机，贯穿订单、库存、销售与复购。",
    metrics: [["在途商机", "12.8M"], ["风险订单", "07"], ["复购率", "68%"]],
    columns: [
      ["市场需求", "客户", "商机", "渠道", "复购信号"],
      ["交易履行", "订单", "销售", "库存", "分配"],
      ["经营状态", "收入健康度", "例外事项", "预测", "日结"],
    ],
    note: "北区需求比当前库存分配高出 11%。",
  },
  Project: {
    kicker: "交付控制",
    title: "项目",
    intro: "已经承诺的复杂交付如何完成，从计划到现场，每个关口都有明确责任与事实依据。",
    metrics: [["进行中项目", "16"], ["进度正常", "13"], ["近期里程碑", "09"]],
    columns: [
      ["项目组合", "计划集", "项目", "现场", "交付团队"],
      ["执行", "里程碑", "任务", "现场记录", "进度"],
      ["交付", "验收", "依据", "例外事项", "移交"],
    ],
    note: "Mizu 项目有一个里程碑受阻，正在等待现场验收。",
  },
  Knowledge: {
    kicker: "组织记忆",
    title: "知识",
    intro: "做完以后，什么应该留下来成为能力。通过审阅与晋升，让工作材料沉淀为可信的组织知识。",
    metrics: [["已审阅文件", "184"], ["本周决策", "12"], ["生效标准", "31"]],
    columns: [
      ["文件", "文档", "媒体", "参考资料", "事实依据"],
      ["知识", "笔记", "洞察", "决策", "关联"],
      ["治理", "标准", "负责人", "审阅周期", "历史记录"],
    ],
    note: "三项项目决策已具备晋升为工作空间标准的条件。",
  },
};

function Wordmark() {
  return (
    <div className="leading-none" aria-label="dayi">
      <span className="font-display text-[27px] font-semibold tracking-normal">day</span>
      <span className="relative inline-block font-display text-[27px] font-semibold tracking-normal">
        <span className="absolute left-1/2 top-[0.02em] size-[5px] -translate-x-1/2 rounded-full bg-brand" />
        <span className="inline-block translate-y-[0.16em]">ı</span>
      </span>
    </div>
  );
}

export function Workbench() {
  const [active, setActive] = useState<Section>("Home");
  const [playing, setPlaying] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("我正在关注今天的经营信号。你可以询问简报、决策建议或行动方案。");

  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    [],
  );

  function submitQuery(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setResponse(`已分析“${trimmed}”。当前最强信号是 Mizu 项目的交付风险。建议先确认现场验收，再调整两项依赖任务。这是一条本地演示回复。`);
    setQuery("");
  }

  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[112px_minmax(0,1fr)]">
      <aside className="fixed inset-x-0 bottom-0 z-30 flex h-[72px] items-center border-t border-border bg-sidebar px-3 md:inset-y-0 md:left-0 md:h-auto md:w-28 md:flex-col md:border-r md:border-t-0 md:px-0 md:py-7">
        <div className="hidden text-center md:block">
          <Wordmark />
          <p className="mt-2 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Workbench V4.2</p>
        </div>

        <nav className="flex flex-1 items-center justify-around md:mt-16 md:w-full md:flex-none md:flex-col md:gap-2" aria-label="一级导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = active === item.name;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => setActive(item.name)}
                className={`group relative flex h-14 min-w-14 flex-col items-center justify-center gap-1.5 text-[10px] transition-colors md:w-full ${selected ? "text-brand" : "text-muted-foreground hover:text-foreground"}`}
                aria-current={selected ? "page" : undefined}
              >
                {selected && <span className="absolute left-0 hidden h-7 w-0.5 bg-brand md:block" />}
                <Icon className="size-[18px] stroke-[1.6]" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden w-full md:mt-auto md:block">
          <div className="mx-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              className="flex w-full items-center gap-2 px-1 py-2 text-left text-muted-foreground transition-colors hover:text-foreground"
              aria-label={playing ? "暂停音乐" : "播放音乐"}
            >
              {playing ? <CirclePause className="size-5 text-brand" /> : <CirclePlay className="size-5" />}
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-medium text-foreground">静默形态</span>
                <span className="block truncate text-[9px]">DAY1 音乐</span>
              </span>
            </button>
            <button type="button" className="mt-1 flex w-full items-center gap-2 px-1 py-2 text-left text-muted-foreground transition-colors hover:text-foreground">
              <Settings className="size-4" />
              <span className="text-[10px]">企业设置</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 pb-24 md:col-start-2 md:pb-0">
        <header className="flex h-[72px] items-center justify-between border-b border-border px-5 md:px-10 lg:px-14">
          <div className="md:hidden"><Wordmark /></div>
          <div className="hidden items-center gap-3 md:flex">
            <span className="size-1.5 rounded-full bg-positive" />
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">系统运行正常</span>
          </div>
          <div className="flex items-center gap-5">
            <button type="button" className="text-muted-foreground transition-colors hover:text-foreground" aria-label="搜索"><Search className="size-[18px]" /></button>
            <span className="hidden text-xs text-muted-foreground sm:inline">{dateLabel}</span>
            <span className="grid size-8 place-items-center rounded-full border border-border bg-secondary text-[11px] font-semibold">DY</span>
          </div>
        </header>

        {active === "Home" ? (
          <HomeDashboard query={query} response={response} setQuery={setQuery} submitQuery={submitQuery} onNavigate={setActive} />
        ) : (
          <SectionView section={active} />
        )}
      </main>
    </div>
  );
}

function HomeDashboard({
  query,
  response,
  setQuery,
  submitQuery,
  onNavigate,
}: {
  query: string;
  response: string;
  setQuery: (value: string) => void;
  submitQuery: (event: React.FormEvent) => void;
  onNavigate: (section: Section) => void;
}) {
  const status = [
    ["Product", "产品", "2 项定价待决策", "38 个在售项目", "稳定"],
    ["Business", "经营", "北区库存承压", "12.8M 商机", "关注"],
    ["Project", "项目", "1 个里程碑受阻", "13 / 16 进度正常", "行动"],
    ["Knowledge", "知识", "3 项决策待晋升", "184 份文件已审阅", "就绪"],
  ] as const;

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-10 md:px-10 md:py-12 lg:px-14 xl:py-14">
      <div className="grid gap-12 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)] xl:gap-16">
        <section>
          <div className="flex items-center gap-2 text-brand">
            <Sparkles className="size-4" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">DAY1 Intelligence</p>
          </div>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-medium leading-[1.12] tracking-normal md:text-5xl">
            现在最重要的是什么？
          </h1>
          <form onSubmit={submitQuery} className="mt-9 flex items-center border-b border-foreground pb-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              placeholder="询问产品、经营、项目或知识中的任何问题…"
              aria-label="向 DAY1 Intelligence 提问"
            />
            <button type="submit" className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105" aria-label="发送">
              <Send className="size-4" />
            </button>
          </form>
          <div className="mt-5 flex gap-3">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand" />
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{response}</p>
          </div>
        </section>

        <section className="border-l border-border pl-6 xl:pl-9">
          <div className="flex items-center justify-between">
            <p className="section-label">系统判断</p>
            <span className="text-[10px] text-muted-foreground">4 分钟前更新</span>
          </div>
          <p className="mt-7 font-display text-2xl leading-snug tracking-normal">先守住 Mizu 里程碑，再扩大需求。</p>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">经营状态稳健。交付资源集中，是本周计划唯一的关键约束。</p>
          <button type="button" onClick={() => onNavigate("Project")} className="mt-7 flex items-center gap-2 text-xs font-semibold text-brand">
            查看依据 <ArrowRight className="size-3.5" />
          </button>
        </section>
      </div>

      <section className="mt-16 border-t border-strong pt-7 md:mt-20">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-label">行动队列</p>
            <h2 className="mt-2 font-display text-2xl tracking-normal">三项决策等待处理</h2>
          </div>
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="筛选行动"><ListFilter className="size-4" /></button>
        </div>
        <div className="mt-7 divide-y divide-border border-y border-border">
          {[
            ["01", "批准调整后的安装窗口", "项目 · Mizu 零售部署", "高"],
            ["02", "处理价格底线例外", "产品 · 服务套餐 04", "今日"],
            ["03", "将现场决策晋升为标准", "知识 · 现场验收", "审阅"],
          ].map((item) => (
            <button key={item[0]} type="button" className="grid w-full grid-cols-[36px_1fr_auto] items-center gap-3 py-4 text-left transition-colors hover:bg-secondary/60 md:grid-cols-[52px_1fr_220px_70px]">
              <span className="font-mono text-[10px] text-muted-foreground">{item[0]}</span>
              <span className="text-sm font-medium">{item[1]}</span>
              <span className="hidden text-xs text-muted-foreground md:block">{item[2]}</span>
              <span className="flex items-center justify-end gap-2 text-[10px] uppercase text-brand">{item[3]} <ChevronRight className="size-3" /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-16 md:mt-20">
        <p className="section-label">核心状态</p>
        <div className="mt-5 grid border-y border-border sm:grid-cols-2 xl:grid-cols-4">
          {status.map(([name, label, signal, metric, state], index) => (
            <button key={name} type="button" onClick={() => onNavigate(name)} className={`group min-h-44 p-5 text-left transition-colors hover:bg-secondary ${index > 0 ? "sm:border-l sm:border-border" : ""} ${index > 1 ? "border-t border-border xl:border-t-0" : ""}`}>
              <div className="flex items-start justify-between">
                <span className="text-sm font-semibold">{label}</span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <p className="mt-8 text-sm">{signal}</p>
              <div className="mt-6 flex items-center justify-between text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <span>{metric}</span><span className={state === "行动" ? "text-brand" : ""}>{state}</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionView({ section }: { section: Exclude<Section, "Home"> }) {
  const data = sectionData[section];
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-10 md:px-10 md:py-14 lg:px-14">
      <p className="section-label text-brand">{data.kicker}</p>
      <div className="mt-5 grid gap-8 border-b border-strong pb-12 lg:grid-cols-[1fr_1fr]">
        <h1 className="font-display text-5xl font-medium tracking-normal md:text-6xl">{data.title}</h1>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">{data.intro}</p>
      </div>
      <div className="grid border-b border-border sm:grid-cols-3">
        {data.metrics.map(([label, value]) => (
          <div key={label} className="py-7 sm:border-r sm:border-border sm:px-6 sm:first:pl-0 sm:last:border-r-0">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-3xl tracking-normal">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-14 grid gap-10 lg:grid-cols-3 lg:gap-0">
        {data.columns.map(([heading, ...items], index) => (
          <section key={heading} className={index > 0 ? "lg:border-l lg:border-border lg:pl-8" : ""}>
            <p className="section-label">{heading}</p>
            <div className="mt-5 divide-y divide-border border-y border-border">
              {items.map((item) => (
                <button key={item} type="button" className="group flex w-full items-center justify-between py-4 text-left text-sm">
                  {item}<ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {section === "Knowledge" && (
        <section className="mt-16 border-y border-strong py-8">
          <p className="section-label">知识晋升</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 md:gap-5">
            {(["个人", "项目", "工作空间", "企业"] as const).map((level, index) => (
              <div key={level} className="flex items-center gap-3 md:gap-5">
                <span className={index === 3 ? "text-sm font-semibold text-brand" : "text-sm"}>{level}</span>
                {index < 3 && <ArrowRight className="size-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="mt-14 flex items-start gap-3 border-l-2 border-brand pl-5">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
        <div><p className="text-xs font-semibold">DAY1 Intelligence</p><p className="mt-1 text-sm text-muted-foreground">{data.note}</p></div>
      </div>
    </div>
  );
}
