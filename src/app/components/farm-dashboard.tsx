"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";
import {
  Activity,
  Archive,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  CloudSun,
  Download,
  FileSpreadsheet,
  Flower2,
  LayoutDashboard,
  Leaf,
  LogOut,
  Map as MapIcon,
  MapPinned,
  Package,
  Plus,
  Printer,
  Search,
  Settings2,
  ShieldCheck,
  Sprout,
  UserRound,
  Users,
  Wrench,
  Wheat,
} from "lucide-react";
import {
  logoutAction,
  switchWorkspaceAction,
} from "@/app/actions/auth";
import {
  createCropCycleAction,
  createCropTypeAction,
  createAssetAction,
  archiveAssetAction,
  createAssetMaintenanceAction,
  createExpenseAction,
  createMachineJobAction,
  createHoldingAction,
  createNurseryBatchAction,
  createNurseryCheckAction,
  createPlotAction,
  recordTenureDisputeAction,
  archiveLandRecordAction,
  createStockItemAction,
  createStockMovementAction,
  createSupplierAction,
  createTaskAction,
  createTransplantAction,
  createWorkerAction,
  createWorkEntryAction,
  recordScoutingAction,
  recordSprayAction,
  recordSubsidyReceiptAction,
  recordWeatherAction,
  recordAssetUsageAction,
  createCropReferenceAction,
  importCropReferencesAction,
  updateTaskStatusAction,
} from "@/app/actions/operations";
import {
  recordHarvestAction,
  recordSaleAction,
  savePlanAction,
} from "@/app/actions/reports";
import {
  createWorkspaceAction,
  recordBenchmarkConsentAction,
  requestDataAction,
  updateFarmSettingsAction,
} from "@/app/actions/settings";
import type { DashboardData } from "@/lib/dashboard-data";
import {
  buildPlanCsv,
  calculateActuals,
  calculatePlan,
  calculatePlannedCostsByCategory,
  calculateProfitVarianceDriver,
  buildMonthlyCashFlow,
} from "@/lib/economics";
import { summarizeAssetCosts } from "@/lib/asset-costs";
import { translate, type Locale } from "@/lib/i18n";
import { ActionForm, FormField, FormSelect, FormTextArea } from "./action-form";
import { LocaleSwitcher } from "./locale-switcher";
import { OfflineActivityForm } from "./offline-activity-form";
import { ManagerInviteForm } from "./manager-invite-form";
import { ThemeToggle } from "./theme-toggle";
import { FileAttachments } from "./file-attachments";
import { OfflineSyncStatus } from "./offline-sync-status";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }>;
type SectionId = "overview" | "land" | "crops" | "nursery" | "tasks" | "inputs" | "labour" | "reports" | "settings";

const navigation: Array<{ id: SectionId; key: string; icon: IconComponent; ownerOnly?: boolean }> = [
  { id: "overview", key: "dashboard", icon: LayoutDashboard },
  { id: "land", key: "land", icon: MapPinned },
  { id: "crops", key: "crops", icon: Leaf },
  { id: "nursery", key: "nursery", icon: Flower2 },
  { id: "tasks", key: "tasks", icon: ClipboardCheck },
  { id: "inputs", key: "inputs", icon: Package },
  { id: "labour", key: "labour", icon: Users },
  { id: "reports", key: "reports", icon: BarChart3, ownerOnly: true },
  { id: "settings", key: "settings", icon: Settings2 },
];

const expenseCategories = [
  "SEED", "LAND_PREP", "NURSERY", "TRANSPLANTING", "IRRIGATION",
  "FERTILIZER", "WEEDING", "LABOUR", "MACHINERY", "HARVEST",
  "PACKAGING", "TRANSPORT", "OTHER",
];

function titleCase(value: string) {
  return value.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function dateLabel(value: string | null, locale: Locale) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "sw" ? "sw-TZ" : "en-TZ", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function money(value: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "sw" ? "sw-TZ" : "en-TZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function number(value: number, locale: Locale, digits = 1) {
  return new Intl.NumberFormat(locale === "sw" ? "sw-TZ" : "en-TZ", {
    maximumFractionDigits: digits,
  }).format(value);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Sprout size={21} /></div>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

export function FarmDashboard({ data }: { data: DashboardData }) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const locale: Locale = data.user.locale === "sw" ? "sw" : "en";
  const t = (key: string) => translate(locale, key);
  const isOwner = data.role === "OWNER";
  const section = navigation.find((item) => item.id === activeSection) ?? navigation[0]!;
  const visibleNavigation = navigation.filter((item) => !item.ownerOnly || isOwner);
  const now = new Date(data.generatedAt);
  const nowMs = data.generatedAt;
  const today = now.toDateString();
  const dueToday = data.tasks.filter(
    (task) => task.status === "PENDING" && task.dueAt && new Date(task.dueAt).toDateString() === today,
  ).length;
  const activeCycles = data.cycles.filter((cycle) => cycle.status !== "CLOSED");
  const actualByCycle = useMemo(
    () => new Map(data.cycles.map((cycle) => {
      const cycleExpenseRows: Array<{ category: string; amount: number }> = [
        ...data.expenses.flatMap((expense) => {
          const split = expense.allocations.filter((allocation) => allocation.cycleId === cycle.id);
          if (split.length) {
            return split.map((allocation) => ({ category: expense.category, amount: allocation.amount }));
          }
          return expense.cycleId === cycle.id
            ? [{ category: expense.category, amount: expense.amount }]
            : [];
        }),
        ...data.machineJobs
          .filter((job) => job.cycleId === cycle.id)
          .map((job) => ({
            category: "MACHINERY",
            amount: job.fuelCost + job.hireCost + job.maintenanceCost,
          })),
        ...data.assetUsages
          .filter((usage) => usage.cycleId === cycle.id)
          .map((usage) => ({
            category: "MACHINERY",
            amount: usage.fuelCost ?? 0,
          })),
        ...data.assetMaintenances
          .filter((maintenance) => maintenance.cycleId === cycle.id)
          .map((maintenance) => ({
            category: "MACHINERY",
            amount: maintenance.cost ?? 0,
          })),
      ];
      const actual = calculateActuals({
        expenses: cycleExpenseRows,
        labour: data.workEntries.filter((entry) => entry.cycleId === cycle.id && entry.amount !== null)
          .map((entry) => ({ amount: entry.amount ?? 0 })),
        stockUsage: cycle.stockUsage,
        harvests: cycle.harvests,
        sales: cycle.sales,
      });
      return [cycle.id, actual] as const;
    })),
    [data.assetMaintenances, data.assetUsages, data.cycles, data.expenses, data.machineJobs, data.workEntries],
  );
  const totalCosts = [...actualByCycle.values()].reduce((sum, actual) => sum + actual.totalCost, 0);
  const lowStockItems = data.stockItems.filter(
    (item) => item.lowStockThreshold !== null && item.balance <= item.lowStockThreshold,
  );
  const [search, setSearch] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const selectedSectionTitle = t(section.key);
  const content = (() => {
    switch (activeSection) {
      case "land":
        return <LandSection data={data} locale={locale} isOwner={isOwner} />;
      case "crops":
        return <CropSection data={data} locale={locale} isOwner={isOwner} />;
      case "nursery":
        return <NurserySection data={data} locale={locale} />;
      case "tasks":
        return <TasksSection data={data} locale={locale} nowMs={nowMs} />;
      case "inputs":
        return <InputsSection data={data} locale={locale} isOwner={isOwner} />;
      case "labour":
        return <LabourSection data={data} locale={locale} isOwner={isOwner} />;
      case "reports":
        return isOwner ? (
          <ReportsSection
            actualByCycle={actualByCycle}
            data={data}
            locale={locale}
          />
        ) : null;
      case "settings":
        return <SettingsSection data={data} locale={locale} isOwner={isOwner} />;
      default:
        return (
          <OverviewSection
            activeCycles={activeCycles}
            actualByCycle={actualByCycle}
            data={data}
            dueToday={dueToday}
            locale={locale}
            lowStockItems={lowStockItems}
            nowMs={nowMs}
            onNavigate={setActiveSection}
            totalCosts={totalCosts}
            isOwner={isOwner}
          />
        );
    }
  })();

  return (
    <div className="app-frame" data-farm-id={data.farm.id}>
      <OfflineSyncStatus farmId={data.farm.id} locale={locale} />
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark"><Sprout size={23} strokeWidth={2.1} /></span>
          <span>shamba<span className="brand-period">.</span></span>
        </div>
        <div className="workspace-label">{t("workspace")}</div>
        <div className="workspace-chip">
          <div className="workspace-avatar"><Wheat size={17} /></div>
          <div className="workspace-info">
            <strong>{data.farm.name}</strong>
            <span>{data.farm.region || (locale === "sw" ? "Eneo halijawekwa" : "Region not set")}</span>
          </div>
          {data.memberships.length > 1 && (
            <ChevronDown size={16} className="workspace-chevron" />
          )}
        </div>
        {data.memberships.length > 1 && (
          <div className="workspace-switcher">
            <ActionForm action={switchWorkspaceAction} submitLabel={locale === "sw" ? "Badili shamba" : "Switch farm"}>
              <FormSelect
                label={locale === "sw" ? "Chagua shamba" : "Choose workspace"}
                name="farmId"
                defaultValue={data.farm.id}
                options={data.memberships.map((member) => ({
                  value: member.farm.id,
                  label: member.farm.name,
                }))}
              />
            </ActionForm>
          </div>
        )}
        <nav aria-label={locale === "sw" ? "Urambazaji mkuu" : "Main navigation"} className="side-nav">
          <span className="nav-group-label">{locale === "sw" ? "SHAMBA" : "FARM"}</span>
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-current={activeSection === item.id ? "page" : undefined}
                className={`nav-item ${activeSection === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                type="button"
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{t(item.key)}</span>
                {item.id === "tasks" && data.tasks.some((task) => task.status === "PENDING") && (
                  <span className="nav-count">{data.tasks.filter((task) => task.status === "PENDING").length}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="connectivity-card">
            <span className="connectivity-icon"><CloudSun size={17} /></span>
            <div>
              <strong>{t("fieldMode")}</strong>
              <p>{locale === "sw" ? "Kumbukumbu husawazishwa mtandaoni." : "Field notes sync when you reconnect."}</p>
            </div>
          </div>
          <div className="profile-row">
            <div className="profile-avatar">{initials(data.user.name)}</div>
            <div className="profile-info">
              <strong>{data.user.name}</strong>
              <span>{t(isOwner ? "owner" : "manager")}</span>
            </div>
            <form action={logoutAction}>
              <button aria-label={t("signOut")} className="icon-button signout-button" title={t("signOut")} type="submit">
                <ArrowRight size={17} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Sprout size={20} /></span> shamba<span className="brand-period">.</span></div>
          <div className="breadcrumbs">
            <span>{data.farm.name}</span><span className="crumb-separator">/</span>
            <strong>{selectedSectionTitle}</strong>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input aria-label={t("search")} onChange={(event) => setSearch(event.target.value)} placeholder={t("search")} value={search} />
              <kbd>/</kbd>
            </label>
            <LocaleSwitcher locale={locale} />
            <ThemeToggle locale={locale} />
            <button className="icon-button notification-button" aria-label={t("notifications")} type="button">
              <Bell size={18} />
              {dueToday > 0 && <span className="notification-dot" />}
            </button>
            <div className="account-menu">
              <button
                aria-expanded={accountMenuOpen}
                aria-label={locale === "sw" ? "Akaunti na kutoka" : "Account and sign out"}
                className="icon-button account-menu-trigger"
                onClick={() => setAccountMenuOpen((open) => !open)}
                type="button"
              >
                <UserRound size={17} />
              </button>
              {accountMenuOpen && (
                <section aria-label={locale === "sw" ? "Taarifa za akaunti" : "Account details"} className="account-menu-panel">
                  <div className="account-menu-identity">
                    <span className="profile-avatar">{initials(data.user.name)}</span>
                    <div className="profile-info">
                      <strong>{data.user.name}</strong>
                      <span>{t(isOwner ? "owner" : "manager")}</span>
                    </div>
                  </div>
                  <div className="account-field-mode">
                    <span className="connectivity-icon"><CloudSun size={17} /></span>
                    <div>
                      <strong>{t("fieldMode")}</strong>
                      <p>{locale === "sw" ? "Kumbukumbu za shamba husawazishwa mtandaoni." : "Field entries sync when you reconnect."}</p>
                    </div>
                  </div>
                  <form action={logoutAction}>
                    <button className="account-signout" type="submit">
                      <LogOut size={16} />
                      {t("signOut")}
                    </button>
                  </form>
                </section>
              )}
            </div>
            <div className="topbar-date"><CalendarDays size={15} /> {new Intl.DateTimeFormat(locale === "sw" ? "sw-TZ" : "en-TZ", { weekday: "short", month: "short", day: "numeric" }).format(now)}</div>
          </div>
        </header>
        <div className="page-content">
          <div className="mobile-page-title"><span>{selectedSectionTitle}</span></div>
          {content}
        </div>
      </main>
      <span className="sr-only">{search ? `Search: ${search}` : ""}</span>
    </div>
  );
}

function OverviewSection({
  activeCycles,
  actualByCycle,
  data,
  dueToday,
  locale,
  lowStockItems,
  nowMs,
  onNavigate,
  totalCosts,
  isOwner,
}: {
  activeCycles: DashboardData["cycles"];
  actualByCycle: Map<string, ReturnType<typeof calculateActuals>>;
  data: DashboardData;
  dueToday: number;
  locale: Locale;
  lowStockItems: DashboardData["stockItems"];
  onNavigate: (section: SectionId) => void;
  totalCosts: number;
  isOwner: boolean;
  nowMs: number;
}) {
  const t = (key: string) => translate(locale, key);
  const pendingTasks = data.tasks.filter((task) => task.status === "PENDING");
  const now = new Date(nowMs);
  const overdueTasks = pendingTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < nowMs);
  const costThisMonth = data.expenses
    .filter((expense) => expense.spentAt && new Date(expense.spentAt).getMonth() === now.getMonth())
    .reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div className="dashboard-content">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">{t("farmHealth")}</div>
          <h1>{t("welcome")}, {data.user.name.split(" ")[0]} <span className="welcome-spark">✳</span></h1>
          <p>{data.farm.region ? `${data.farm.region}${data.farm.district ? ` · ${data.farm.district}` : ""}` : t("setupRequired")}</p>
        </div>
        <div className="welcome-actions">
          <button className="button button-quiet" onClick={() => onNavigate("tasks")} type="button">
            <ClipboardCheck size={16} /> {t("tasks")}
          </button>
          <button className="button button-primary" onClick={() => onNavigate("crops")} type="button">
            <Plus size={17} /> {t("addCycle")}
          </button>
        </div>
      </div>

      <section className="season-banner">
        <div className="season-banner-copy">
          <div className="season-pill"><span /> {locale === "sw" ? "REKODI ZA MSIMU" : "FIELD SEASON RECORD"}</div>
          <h2>{activeCycles.length > 0
            ? locale === "sw" ? "Kila hatua ya shamba, imeunganishwa." : "Every field step, connected."
            : locale === "sw" ? "Anza kuweka kumbukumbu za shamba." : "Start building your farm record."}</h2>
          <p>{locale === "sw"
            ? "Panga vitalu, fuatilia kazi za kila siku na ujue gharama za kila zao."
            : "Plan plots, keep up with daily work and understand costs by crop cycle."}</p>
          <button onClick={() => onNavigate(activeCycles.length > 0 ? "crops" : "land")} className="banner-link" type="button">
            {locale === "sw" ? "Endelea na shamba" : "Explore your farm"} <ArrowRight size={16} />
          </button>
        </div>
        <div className="season-illustration" aria-hidden="true">
          <span className="sun-disc" />
          <span className="field-hill field-hill-back" />
          <span className="field-hill field-hill-front" />
          <span className="field-plant plant-one"><i /><b /></span>
          <span className="field-plant plant-two"><i /><b /></span>
          <span className="field-plant plant-three"><i /><b /></span>
        </div>
      </section>

      <section aria-label={t("farmHealth")} className="stat-grid">
        <StatCard icon={Leaf} label={t("activeCycles")} value={String(activeCycles.length)} note={locale === "sw" ? "Kwenye hatua za uzalishaji" : "Across all growing stages"} tone="sage" />
        <StatCard icon={MapIcon} label={t("plots")} value={String(data.plots.length)} note={`${data.holdings.length} ${locale === "sw" ? "umiliki wa ardhi" : "land holdings"}`} tone="sand" />
        <StatCard icon={CalendarDays} label={t("dueToday")} value={String(dueToday)} note={`${overdueTasks.length} ${locale === "sw" ? "zimechelewa" : "overdue"}`} tone="lavender" />
        <StatCard
          icon={CircleDollarSign}
          label={t("recordedCost")}
          value={isOwner ? money(totalCosts, data.farm.currency, locale) : "—"}
          note={isOwner ? `${money(costThisMonth, data.farm.currency, locale)} ${locale === "sw" ? "mwezi huu" : "this month"}` : locale === "sw" ? "Inaonekana kwa mmiliki pekee" : "Visible to farm owner only"}
          tone="mint"
        />
      </section>

      <div className="overview-grid">
        <section className="panel today-panel">
          <div className="panel-header">
            <div><h3>{locale === "sw" ? "Kazi za shambani" : "Today in the field"}</h3><p>{locale === "sw" ? "Kazi na kumbukumbu zinazohitaji uangalizi." : "Tasks and updates that need your attention."}</p></div>
            <button className="text-button" onClick={() => onNavigate("tasks")} type="button">{locale === "sw" ? "Angalia zote" : "View all"} <ArrowRight size={14} /></button>
          </div>
          {pendingTasks.length > 0 ? (
            <div className="today-task-list">
              {pendingTasks.slice(0, 4).map((task) => (
                <div className="today-task" key={task.id}>
                  <span className={`task-check ${task.dueAt && new Date(task.dueAt).getTime() < nowMs ? "is-overdue" : ""}`} />
                  <div className="today-task-copy"><strong>{locale === "sw" ? task.titleSw : task.titleEn}</strong><span>{task.cropName} · {task.plotName}</span></div>
                  <time>{dateLabel(task.dueAt, locale)}</time>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={t("noData")} detail={locale === "sw" ? "Kazi za utunzaji zitaonekana ukianzisha mzunguko wa zao." : "Care tasks appear here once you start a crop cycle."} />
          )}
          <button className="add-inline" onClick={() => onNavigate("tasks")} type="button"><Plus size={15} /> {t("addTask")}</button>
        </section>

        <section className="panel attention-panel">
          <div className="panel-header">
            <div><h3>{locale === "sw" ? "Yanayohitaji uangalizi" : "Needs attention"}</h3><p>{locale === "sw" ? "Vitu vya kufuatilia wiki hii." : "Things to keep an eye on this week."}</p></div>
            <span className="attention-count">{overdueTasks.length + lowStockItems.length + data.plots.filter((plot) => plot.renewalDate && new Date(plot.renewalDate).getTime() < nowMs + 60 * 86_400_000).length}</span>
          </div>
          <div className="attention-list">
            {overdueTasks.slice(0, 2).map((task) => (
              <div className="attention-item" key={task.id}><span className="attention-icon warning"><Clock3 size={16} /></span><div><strong>{locale === "sw" ? task.titleSw : task.titleEn}</strong><p>{locale === "sw" ? "Kazi imepitwa na tarehe yake" : `Overdue · ${task.plotName}`}</p></div><ArrowUpRight size={15} /></div>
            ))}
            {lowStockItems.slice(0, 2).map((item) => (
              <div className="attention-item" key={item.id}><span className="attention-icon inventory"><Package size={16} /></span><div><strong>{item.name} {locale === "sw" ? "imepungua" : "is running low"}</strong><p>{number(item.balance, locale, 2)} {item.unit} {locale === "sw" ? "zimebaki" : "remaining"}</p></div><ArrowUpRight size={15} /></div>
            ))}
            {data.plots.filter((plot) => plot.renewalDate && new Date(plot.renewalDate).getTime() < nowMs).slice(0, 2).map((plot) => (
              <div className="attention-item" key={`${plot.id}-overdue-renewal`}><span className="attention-icon warning"><CalendarDays size={16} /></span><div><strong>{plot.name} · {locale === "sw" ? "upyaishaji wa hati umechelewa" : "tenure renewal overdue"}</strong><p>{dateLabel(plot.renewalDate, locale)}</p></div><ArrowUpRight size={15} /></div>
            ))}
            {overdueTasks.length === 0 && lowStockItems.length === 0 && data.plots.every((plot) => !plot.renewalDate || new Date(plot.renewalDate).getTime() >= nowMs + 60 * 86_400_000) && (
              <div className="attention-clear"><BadgeCheck size={18} /><span>{locale === "sw" ? "Hakuna tahadhari kwa sasa." : "Nothing needs attention right now."}</span></div>
            )}
            {data.plots.filter((plot) => plot.renewalDate && new Date(plot.renewalDate).getTime() >= nowMs && new Date(plot.renewalDate).getTime() < nowMs + 60 * 86_400_000).slice(0, 2).map((plot) => (
              <div className="attention-item" key={plot.id}><span className="attention-icon warning"><CalendarDays size={16} /></span><div><strong>{plot.name} · {locale === "sw" ? "hati ya ardhi inaisha" : "tenure renewal coming up"}</strong><p>{dateLabel(plot.renewalDate, locale)}</p></div><ArrowUpRight size={15} /></div>
            ))}
          </div>
          <button className="text-button attention-link" onClick={() => onNavigate("land")} type="button">{locale === "sw" ? "Angalia ardhi" : "Review land records"} <ArrowRight size={14} /></button>
        </section>
      </div>

      <section className="panel cycles-panel">
        <div className="panel-header">
          <div><h3>{locale === "sw" ? "Mizunguko ya mazao" : "Crop cycles"}</h3><p>{locale === "sw" ? "Mizunguko hai na hatua zake." : "Active crop cycles and their current stage."}</p></div>
          <button className="text-button" onClick={() => onNavigate("crops")} type="button">{locale === "sw" ? "Mizunguko yote" : "All cycles"} <ArrowRight size={14} /></button>
        </div>
        {activeCycles.length > 0 ? (
          <div className="cycle-card-grid">
            {activeCycles.slice(0, 3).map((cycle) => {
              const actual = actualByCycle.get(cycle.id);
              return (
                <article className="cycle-card" key={cycle.id}>
                  <div className="cycle-card-top"><span className={`crop-icon crop-icon-${cycle.mode.toLowerCase()}`}><Sprout size={19} /></span><span className="status-pill">{titleCase(cycle.status)}</span></div>
                  <h4>{cycle.cropName}</h4>
                  <p>{cycle.plotName} · {number(cycle.areaValue, locale, 2)} {cycle.areaUnit}</p>
                  <div className="cycle-card-meta"><span><CalendarDays size={14} /> {dateLabel(cycle.plantingAt, locale)}</span><span><Wheat size={14} /> {cycle.actualYield === null ? "—" : `${number(cycle.actualYield, locale)} ${cycle.yieldUnit}`}</span></div>
                  {isOwner && actual && <div className="cycle-cost-line"><span>{locale === "sw" ? "Gharama hadi sasa" : "Recorded costs so far"}</span><strong>{money(actual.totalCost, data.farm.currency, locale)}</strong></div>}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title={locale === "sw" ? "Hakuna mzunguko ulioanza" : "No crop cycles started"} detail={locale === "sw" ? "Weka ardhi na zao ili uanze mzunguko wako wa kwanza." : "Set up land and a crop type to start your first cycle."} />
        )}
      </section>

      {data.logs.length > 0 && (
        <section className="panel recent-panel">
          <div className="panel-header"><div><h3>{locale === "sw" ? "Shughuli za hivi karibuni" : "Recent field notes"}</h3><p>{locale === "sw" ? "Kumbukumbu mpya zilizoongezwa." : "Latest updates from the farm."}</p></div><button className="text-button" onClick={() => onNavigate("tasks")} type="button">{locale === "sw" ? "Fungua kumbukumbu" : "Open field log"} <ArrowRight size={14} /></button></div>
          <div className="recent-list">{data.logs.slice(0, 4).map((log) => <div className="recent-item" key={log.id}><span className="recent-dot" /><div><p>{log.body}</p><span>{log.cropName ?? (locale === "sw" ? "Shughuli za shamba" : "Farm activity")} · {dateLabel(log.loggedAt, locale)}</span></div></div>)}</div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={18} strokeWidth={1.8} /></div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-note">{note}</span>
    </article>
  );
}

function LandSection({ data, locale, isOwner }: { data: DashboardData; locale: Locale; isOwner: boolean }) {
  const t = (key: string) => translate(locale, key);
  return (
    <div className="dashboard-content">
      <SectionHeading eyebrow="LAND REGISTER" title={t("land")} description={locale === "sw" ? "Rekodi umiliki, ukubwa wa vitalu na hali ya hati." : "Record land tenure, plot size, soil and renewal details."} />
      <div className="two-panel-grid">
        <section className="panel form-panel">
          <div className="panel-header"><div><h3>{t("addLand")}</h3><p>{locale === "sw" ? "Umiliki au upangishaji wa ardhi." : "Add owned or rented land."}</p></div><MapPinned size={20} /></div>
          <ActionForm action={createHoldingAction} submitLabel={t("save")} className="form-grid">
            <FormField label={locale === "sw" ? "Jina la umiliki" : "Holding name"} name="name" required />
            <FormSelect label={locale === "sw" ? "Umiliki" : "Tenure"} name="owned" options={[{ value: "yes", label: locale === "sw" ? "Inamilikiwa" : "Owned" }, { value: "no", label: locale === "sw" ? "Imepangishwa" : "Rented / leased" }]} />
            <FormField label={locale === "sw" ? "Gharama / kodi" : "Purchase price / rent"} name="costOrRent" type="number" min="0" step="0.01" />
            <FormField label={locale === "sw" ? "Jina la mwenye ardhi" : "Land owner"} name="ownerName" />
            <FormField label={locale === "sw" ? "Mwanzo wa mkataba" : "Lease start"} name="leaseStart" type="date" />
            <FormField label={locale === "sw" ? "Mwisho wa mkataba" : "Lease end"} name="leaseEnd" type="date" />
            <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
          </ActionForm>
        </section>
        <section className="panel form-panel">
          <div className="panel-header"><div><h3>{t("addPlot")}</h3><p>{locale === "sw" ? "Unganisha kitalu na umiliki wa ardhi." : "Link a measured plot to a land holding."}</p></div><MapIcon size={20} /></div>
          <ActionForm action={createPlotAction} submitLabel={t("save")} className="form-grid">
            <FormSelect label={locale === "sw" ? "Umiliki wa ardhi" : "Land holding"} name="holdingId" options={data.holdings.map((holding) => ({ value: holding.id, label: holding.name }))} />
            <FormField label={locale === "sw" ? "Jina la kitalu" : "Plot name"} name="name" required />
            <FormField label={locale === "sw" ? "Eneo" : "Area"} name="areaValue" type="number" min="0.0001" step="0.0001" required />
            <FormSelect label={locale === "sw" ? "Kipimo cha eneo" : "Area unit"} name="areaUnit" defaultValue={data.farm.areaUnit} options={["acre", "hectare", "square metre"].map((unit) => ({ value: unit, label: unit }))} />
            <FormField label={locale === "sw" ? "Aina ya udongo" : "Soil type"} name="soilType" />
            <FormField label={locale === "sw" ? "Chanzo cha maji" : "Water source"} name="waterSource" />
            <FormSelect label={locale === "sw" ? "Aina ya umiliki" : "Tenure type"} name="tenureType" options={[
              { value: "TITLE", label: "Title" }, { value: "CUSTOMARY_CERTIFICATE", label: "Customary certificate" }, { value: "LEASE", label: "Lease" }, { value: "INFORMAL", label: "Informal" },
            ]} />
            <FormSelect label={locale === "sw" ? "Hali ya hati" : "Document status"} name="documentStatus" options={[
              { value: "NONE", label: "No document" }, { value: "COPIED", label: "Copy held" }, { value: "VERIFIED", label: "Verified" },
            ]} />
            <FormField label={locale === "sw" ? "Tarehe ya upyaishaji" : "Renewal date"} name="renewalDate" type="date" />
            <FormField label="GPS latitude" name="gpsLat" type="number" min="-90" max="90" step="any" />
            <FormField label="GPS longitude" name="gpsLng" type="number" min="-180" max="180" step="any" />
            <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
          </ActionForm>
        </section>
      </div>
      <section className="panel data-panel">
        <div className="panel-header"><div><h3>{locale === "sw" ? "Vitalu vyako" : "Your plots"}</h3><p>{data.plots.length} {locale === "sw" ? "vitalu vimehifadhiwa" : "plots recorded"}</p></div></div>
        {data.plots.length ? (
          <div className="table-scroll"><table><thead><tr>
            <th>{locale === "sw" ? "Kitalu" : "Plot"}</th><th>{locale === "sw" ? "Umiliki" : "Holding"}</th>
            <th>{locale === "sw" ? "Eneo" : "Area"}</th><th>{locale === "sw" ? "Udongo" : "Soil"}</th>
            <th>{locale === "sw" ? "Hati" : "Tenure document"}</th><th>{locale === "sw" ? "Upyaishaji" : "Renewal"}</th>
            {isOwner && <th>{locale === "sw" ? "Vitendo" : "Actions"}</th>}
          </tr></thead><tbody>{data.plots.map((plot) => (
            <tr key={plot.id}>
              <td><strong>{plot.name}</strong><small>{plot.waterSource || (locale === "sw" ? "Chanzo cha maji hakijawekwa" : "Water source not set")}</small></td>
              <td>{plot.holdingName}</td><td>{number(plot.areaValue, locale, 2)} {plot.areaUnit}</td><td>{plot.soilType || "—"}</td>
              <td><span className={`status-pill ${plot.documentStatus === "VERIFIED" ? "status-done" : ""}`}>{titleCase(plot.documentStatus)}</span></td>
              <td>{dateLabel(plot.renewalDate, locale)}</td>
              {isOwner && <td><ActionForm action={archiveLandRecordAction} submitLabel={locale === "sw" ? "Hifadhi" : "Archive"}><input name="recordType" type="hidden" value="plot" /><input name="recordId" type="hidden" value={plot.id} /></ActionForm></td>}
            </tr>
          ))}</tbody></table></div>
        ) : <EmptyState title={t("noData")} detail={locale === "sw" ? "Ongeza umiliki wa ardhi na kitalu ili kuanza." : "Add a land holding and plot to start your land register."} />}
      </section>
      <section className="panel data-panel">
        <div className="panel-header"><div><h3>{locale === "sw" ? "Umiliki wa ardhi" : "Land holdings"}</h3><p>{locale === "sw" ? "Ardhi inayomilikiwa na iliyopangishwa." : "Owned and leased land records."}</p></div></div>
        {data.holdings.length ? <div className="data-list">{data.holdings.map((holding) => <div className="data-row" key={holding.id}><span className="data-row-icon"><MapPinned size={17} /></span><div><strong>{holding.name}</strong><span>{holding.owned ? (locale === "sw" ? "Inamilikiwa" : "Owned") : (locale === "sw" ? "Imepangishwa" : "Leased")} · {holding.ownerName || (locale === "sw" ? "Mwenye ardhi hajatajwa" : "Owner not listed")}</span></div><time>{holding.leaseEnd ? `${locale === "sw" ? "Mwisho" : "Ends"} ${dateLabel(holding.leaseEnd, locale)}` : holding.costOrRent !== null ? money(holding.costOrRent, holding.currency, locale) : "—"}</time>{isOwner && <ActionForm action={archiveLandRecordAction} submitLabel={locale === "sw" ? "Hifadhi" : "Archive"}><input name="recordType" type="hidden" value="holding" /><input name="recordId" type="hidden" value={holding.id} /></ActionForm>}</div>)}</div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Taarifa za umiliki wa ardhi zitaonekana hapa." : "Your land holdings will appear here."} />}
      </section>
      {isOwner && <section className="panel form-panel">
        <div className="panel-header"><div><h3>{locale === "sw" ? "Rekodi mgogoro wa ardhi" : "Record a tenure dispute"}</h3><p>{locale === "sw" ? "Hifadhi maelezo ya mgogoro na hatua yake." : "Keep a dated record of tenure concerns and their resolution."}</p></div><Archive size={20} /></div>
        <ActionForm action={recordTenureDisputeAction} submitLabel={t("save")} className="form-grid">
          <FormSelect label={locale === "sw" ? "Kitalu" : "Plot"} name="plotId" required={false} options={data.plots.map((plot) => ({ value: plot.id, label: plot.name }))} />
          <FormSelect label={locale === "sw" ? "Au umiliki" : "Or land holding"} name="holdingId" required={false} options={data.holdings.map((holding) => ({ value: holding.id, label: holding.name }))} />
          <FormField label={locale === "sw" ? "Tarehe" : "Date"} name="occurredAt" type="date" />
          <FormSelect label={locale === "sw" ? "Hali" : "Status"} name="status" options={[{ value: "OPEN", label: locale === "sw" ? "Wazi" : "Open" }, { value: "RESOLVED", label: locale === "sw" ? "Imetatuliwa" : "Resolved" }]} />
          <FormTextArea label={locale === "sw" ? "Maelezo ya mgogoro" : "Dispute details"} name="description" required />
          <FormTextArea label={locale === "sw" ? "Suluhisho" : "Resolution"} name="resolution" />
        </ActionForm>
        {data.tenureDisputes.map((dispute) => <div className="data-row" key={dispute.id}><span className="status-pill">{titleCase(dispute.status)}</span><div><strong>{dispute.subject} · {dateLabel(dispute.occurredAt, locale)}</strong><span>{dispute.description}{dispute.resolution ? ` · ${dispute.resolution}` : ""}</span></div></div>)}
      </section>}
    </div>
  );
}

function CropSection({ data, locale, isOwner }: { data: DashboardData; locale: Locale; isOwner: boolean }) {
  const t = (key: string) => translate(locale, key);
  return (
    <div className="dashboard-content">
      <SectionHeading eyebrow="CROP CYCLE REGISTER" title={t("crops")} description={locale === "sw" ? "Unda violezo vya mazao na ufuatilie kila mzunguko kuanzia kupanda." : "Set up crop templates and track each cycle from planting through harvest."} />
      <div className="two-panel-grid">
        <section className="panel form-panel">
          <div className="panel-header"><div><h3>{t("addCrop")}</h3><p>{locale === "sw" ? "Taarifa za uzalishaji ni hiari na huwekewa lebo." : "Crop figures are optional and visibly labelled."}</p></div><Leaf size={20} /></div>
          <ActionForm action={createCropTypeAction} submitLabel={t("save")} className="form-grid">
            <FormField label={locale === "sw" ? "Jina la zao" : "Crop name"} name="name" required />
            <FormSelect label={locale === "sw" ? "Njia ya uzalishaji" : "Production method"} name="mode" options={[{ value: "NURSERY", label: locale === "sw" ? "Kitalu kisha kupandikiza" : "Nursery then transplant" }, { value: "DIRECT", label: locale === "sw" ? "Kupanda moja kwa moja" : "Direct-sown" }]} />
            <FormField label={locale === "sw" ? "Aina / cultivar" : "Default variety"} name="varietyDefault" />
            <FormField label={locale === "sw" ? "Muda wa mzunguko (siku)" : "Cycle length (days)"} name="cycleLengthDays" type="number" min="1" step="1" />
            <FormField label={locale === "sw" ? "Nafasi ya mimea" : "Plant spacing"} name="spacingNote" />
            <FormField label={locale === "sw" ? "Mimea kwa ekari" : "Plants per acre"} name="plantsPerAcre" type="number" min="0" step="any" placeholder={locale === "sw" ? "Weka thamani iliyothibitishwa" : "Enter a verified value"} />
            <FormField label={locale === "sw" ? "Mavuno kwa mmea" : "Yield per plant"} name="yieldPerPlant" type="number" min="0" step="any" placeholder={locale === "sw" ? "Weka thamani iliyothibitishwa" : "Enter a verified value"} />
            <FormField label={locale === "sw" ? "Kipimo cha mavuno" : "Yield unit"} name="yieldUnit" defaultValue="kg" required />
            <FormTextArea label={locale === "sw" ? "Hatua (hiari)" : "Stages (optional)"} name="stages" placeholder={locale === "sw" ? "Kiingereza | Kiswahili | siku baada ya kupanda" : "English | Kiswahili | days after planting"} />
            <FormTextArea label={locale === "sw" ? "Vikumbusho (hiari)" : "Care reminders (optional)"} name="careTemplates" placeholder={locale === "sw" ? "Kazi | Kiswahili | jina la hatua | rudia kila siku N" : "Task | Kiswahili | stage name | repeat every N days"} />
            <p className="field-help field-wide">{locale === "sw" ? "Vipimo vya mimea na mavuno huwekewa lebo ya makadirio hadi vithibitishwe. Vikumbusho hutengenezwa tu ikiwa hatua ina siku ya kuanza." : "Plant and yield figures are marked as placeholder benchmarks until verified. Automatic reminders need a stage day offset."}</p>
          </ActionForm>
        </section>
        <section className="panel form-panel">
          <div className="panel-header"><div><h3>{t("addCycle")}</h3><p>{locale === "sw" ? "Unganisha zao na kitalu cha shamba." : "Link a crop type to a farm plot."}</p></div><Sprout size={20} /></div>
          <ActionForm action={createCropCycleAction} submitLabel={t("save")} className="form-grid">
            <FormSelect label={locale === "sw" ? "Kitalu" : "Plot"} name="plotId" options={data.plots.map((plot) => ({ value: plot.id, label: `${plot.name} · ${plot.areaValue} ${plot.areaUnit}` }))} />
            <FormSelect label={locale === "sw" ? "Zao" : "Crop type"} name="cropTypeId" options={data.cropTypes.map((crop) => ({ value: crop.id, label: `${crop.name} · ${crop.mode === "NURSERY" ? "Nursery" : "Direct"}` }))} />
            <FormField label={locale === "sw" ? "Aina / cultivar" : "Variety"} name="variety" />
            <FormField label={locale === "sw" ? "Eneo lililopandwa" : "Planted area"} name="areaValue" type="number" min="0.0001" step="0.0001" required />
            <FormSelect label={locale === "sw" ? "Kipimo cha eneo" : "Area unit"} name="areaUnit" defaultValue={data.farm.areaUnit} options={["acre", "hectare", "square metre"].map((unit) => ({ value: unit, label: unit }))} />
            <FormField label={locale === "sw" ? "Tarehe ya kupanda" : "Planting date"} name="plantingAt" type="date" />
            <FormField label={locale === "sw" ? "Mavuno yanayotarajiwa" : "Expected yield"} name="expectedYield" type="number" min="0" step="any" />
            <FormField label={locale === "sw" ? "Kipimo cha mavuno" : "Yield unit"} name="yieldUnit" defaultValue="kg" required />
            <p className="field-help field-wide">{locale === "sw" ? "Makadirio ya mavuno yana lebo ya makadirio hadi yathibitishwe. Kila mzunguko unahifadhiwa chini ya shamba hili." : "Expected yield is marked as a placeholder benchmark until verified. Each cycle is scoped to this farm."}</p>
          </ActionForm>
        </section>
      </div>
      <section className="panel data-panel">
        <div className="panel-header"><div><h3>{locale === "sw" ? "Mizunguko yote" : "Crop cycles"}</h3><p>{data.cycles.length} {locale === "sw" ? "mizunguko imerekodiwa" : "cycles recorded"}</p></div></div>
        {data.cycles.length ? <div className="table-scroll"><table><thead><tr><th>{locale === "sw" ? "Zao / ratiba ya hatua" : "Crop / stage timeline"}</th><th>{locale === "sw" ? "Kitalu" : "Plot"}</th><th>{locale === "sw" ? "Hatua" : "Stage"}</th><th>{locale === "sw" ? "Eneo" : "Area"}</th><th>{locale === "sw" ? "Kupanda" : "Planting"}</th><th>{locale === "sw" ? "Mavuno yanayotarajiwa" : "Expected harvest"}</th><th>{locale === "sw" ? "Mavuno halisi" : "Actual yield"}</th></tr></thead><tbody>{data.cycles.map((cycle) => <tr key={cycle.id}><td><strong>{cycle.cropName}</strong><small>{cycle.variety || (locale === "sw" ? "Aina haijawekwa" : "Variety not set")}</small><div className="stage-chip-list">{cycle.stageTimeline.map((stage) => <span className="stage-chip" key={stage.id}>{locale === "sw" ? stage.nameSw : stage.nameEn}<small>{stage.expectedAt ? dateLabel(stage.expectedAt, locale) : locale === "sw" ? "Tarehe haijawekwa" : "date not set"}</small></span>)}</div></td><td>{cycle.plotName}</td><td><span className="status-pill">{titleCase(cycle.status)}</span></td><td>{number(cycle.areaValue, locale, 2)} {cycle.areaUnit}</td><td>{dateLabel(cycle.plantingAt, locale)}</td><td>{dateLabel(cycle.expectedHarvestAt, locale)}</td><td>{cycle.actualYield === null ? "—" : `${number(cycle.actualYield, locale)} ${cycle.yieldUnit}`}</td></tr>)}</tbody></table></div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Tengeneza aina ya zao na kitalu kwanza." : "Create a crop type and plot, then start a cycle."} />}
      </section>
      <section className="crop-template-grid">
        {data.cropTypes.map((crop) => <article className="panel crop-template-card" key={crop.id}><div className="cycle-card-top"><span className={`crop-icon crop-icon-${crop.mode.toLowerCase()}`}><Leaf size={18} /></span><span className="status-pill">{crop.mode === "NURSERY" ? (locale === "sw" ? "KITALU" : "NURSERY") : (locale === "sw" ? "MOJA KWA MOJA" : "DIRECT")}</span></div><h3>{crop.name}</h3><p>{crop.cycleLengthDays ? `${crop.cycleLengthDays} ${locale === "sw" ? "siku" : "days"}` : (locale === "sw" ? "Muda haujawekwa" : "Cycle length not set")} · {crop.stageTemplates.length} {locale === "sw" ? "hatua" : "stages"}</p><div className="stage-chip-list">{crop.stageTemplates.map((stage) => <span className="stage-chip" key={stage.id}>{locale === "sw" ? stage.nameSw : stage.nameEn}{stage.dayOffset === null ? "" : ` · d${stage.dayOffset}`}</span>)}</div><div className="placeholder-note"><span className="placeholder-dot" /> {t("placeholder")}</div></article>)}
      </section>
      <CropReferenceCatalog data={data} locale={locale} isOwner={isOwner} />
    </div>
  );
}

function CropReferenceCatalog({
  data,
  locale,
  isOwner,
}: {
  data: DashboardData;
  locale: Locale;
  isOwner: boolean;
}) {
  const crops = data.cropTypes;
  const references = crops.flatMap((crop) =>
    crop.references.map((reference) => ({ ...reference, cropName: crop.name })),
  );
  return (
    <section className="panel data-panel crop-reference-panel">
      <div className="panel-header">
        <div>
          <h3>{locale === "sw" ? "Marejeo ya magonjwa na viuatilifu" : "Crop disease & pesticide catalogue"}</h3>
          <p>{locale === "sw" ? "Ongeza taarifa zilizothibitishwa na shamba lako; hakuna mapendekezo yanayojazwa." : "Store farm-verified crop references. No disease or pesticide recommendations are prefilled."}</p>
        </div>
        <Leaf size={20} />
      </div>
      {isOwner && crops.length > 0 && (
        <div className="two-panel-grid crop-reference-forms">
          <section className="panel form-panel">
            <div className="panel-header">
              <div>
                <h3>{locale === "sw" ? "Ongeza kwa mkono" : "Add a reference"}</h3>
                <p>{locale === "sw" ? "Unganisha ugonjwa au kiuatilifu na zao." : "Associate a disease or pesticide with a crop."}</p>
              </div>
            </div>
            <ActionForm action={createCropReferenceAction} submitLabel={locale === "sw" ? "Hifadhi rejea" : "Save reference"} className="form-grid">
              <FormSelect label={locale === "sw" ? "Zao" : "Crop"} name="cropTypeId" options={crops.map((crop) => ({ value: crop.id, label: crop.name }))} />
              <FormSelect label={locale === "sw" ? "Aina ya rejea" : "Reference type"} name="kind" options={[
                { value: "DISEASE", label: locale === "sw" ? "Ugonjwa" : "Disease" },
                { value: "PESTICIDE", label: locale === "sw" ? "Kiuatilifu" : "Pesticide" },
              ]} />
              <FormField label={locale === "sw" ? "Jina" : "Name"} name="name" required />
              <FormField label={locale === "sw" ? "Kiambato hai (si lazima)" : "Active ingredient (optional)"} name="activeIngredient" />
              <FormTextArea label={locale === "sw" ? "Maelezo (si lazima)" : "Notes (optional)"} name="notes" />
            </ActionForm>
          </section>
          <section className="panel form-panel">
            <div className="panel-header">
              <div>
                <h3>{locale === "sw" ? "Ingiza faili la Excel/CSV" : "Import an Excel-compatible CSV"}</h3>
                <p>{locale === "sw" ? "Pakua kiolezo, kijaze na ukihifadhi kama CSV ya UTF-8." : "Download the template, edit it in Excel, then save as UTF-8 CSV."}</p>
              </div>
              <FileSpreadsheet size={20} />
            </div>
            <a className="button button-quiet" download href="/templates/crop-reference-template.csv">
              <Download size={16} /> {locale === "sw" ? "Pakua kiolezo cha CSV" : "Download CSV template"}
            </a>
            <ActionForm action={importCropReferencesAction} submitLabel={locale === "sw" ? "Ingiza marejeo" : "Import references"} className="form-grid crop-reference-import">
              <FormSelect label={locale === "sw" ? "Hifadhi kwa zao" : "Assign to crop"} name="cropTypeId" options={crops.map((crop) => ({ value: crop.id, label: crop.name }))} />
              <label className="field field-wide">
                <span>{locale === "sw" ? "Faili la CSV" : "CSV file"}</span>
                <input accept=".csv,text/csv" name="file" required type="file" />
              </label>
              <p className="field-help field-wide">
                {locale === "sw" ? "Safu: kind, name, active_ingredient, notes. Aina ni DISEASE au PESTICIDE. Faili lisizidi MB 1; hadi mistari 200." : "Columns: kind, name, active_ingredient, notes. Use DISEASE or PESTICIDE; maximum 1 MB and 200 rows. Duplicate names are skipped."}
              </p>
            </ActionForm>
          </section>
        </div>
      )}
      {references.length ? (
        <div className="crop-reference-list">
          {references.map((reference) => (
            <article className="crop-reference-row" key={reference.id}>
              <span className={`status-pill ${reference.kind === "DISEASE" ? "status-skipped" : "status-done"}`}>
                {reference.kind === "DISEASE" ? (locale === "sw" ? "UGONJWA" : "DISEASE") : (locale === "sw" ? "KIUATILIFU" : "PESTICIDE")}
              </span>
              <div>
                <strong>{reference.name}</strong>
                <span>{reference.cropName}{reference.activeIngredient ? ` · ${reference.activeIngredient}` : ""}</span>
                {reference.notes && <small>{reference.notes}</small>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>{locale === "sw" ? "Hakuna marejeo bado" : "No crop references yet"}</strong>
          <p>{locale === "sw" ? "Ongeza mwenyewe au ingiza kiolezo cha CSV kilichopakuliwa." : "Add records manually or import the downloaded CSV template."}</p>
        </div>
      )}
      {isOwner && crops.length === 0 && (
        <p className="field-help">{locale === "sw" ? "Unda aina ya zao kabla ya kuongeza marejeo." : "Create a crop type before adding crop-specific references."}</p>
      )}
    </section>
  );
}

function NurserySection({ data, locale }: { data: DashboardData; locale: Locale }) {
  const t = (key: string) => translate(locale, key);
  const nurseryCycles = data.cycles.filter((cycle) => cycle.mode === "NURSERY");
  const batches = nurseryCycles.flatMap((cycle) => cycle.batches.map((batch) => ({ ...batch, cycleLabel: `${cycle.cropName} · ${cycle.plotName}` })));
  return (
    <div className="dashboard-content">
      <SectionHeading eyebrow="NURSERY RECORDS" title={t("nursery")} description={locale === "sw" ? "Fuatilia mbegu, uotaji, uhai wa miche na upandikizaji." : "Track seed lots, germination, survival and transplant counts."} />
      <div className="three-panel-grid">
        <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Kundi la kitalu" : "Seed batch"}</h3><p>{locale === "sw" ? "Rekodi chanzo na kiasi cha mbegu." : "Record source and quantity for a nursery cycle."}</p></div><Flower2 size={20} /></div>
          <ActionForm action={createNurseryBatchAction} submitLabel={t("save")} className="form-grid">
            <FormSelect label={locale === "sw" ? "Mzunguko wa kitalu" : "Nursery crop cycle"} name="cycleId" options={nurseryCycles.map((cycle) => ({ value: cycle.id, label: `${cycle.cropName} · ${cycle.plotName}` }))} />
            <FormField label={locale === "sw" ? "Kiasi cha mbegu" : "Seed quantity"} name="quantity" type="number" min="0.0001" step="any" required />
            <FormField label={locale === "sw" ? "Kipimo" : "Unit"} name="quantityUnit" defaultValue="g" required />
            <FormField label={locale === "sw" ? "Aina" : "Variety"} name="variety" />
            <FormField label={locale === "sw" ? "Muuzaji" : "Supplier"} name="supplier" />
            <FormField label={locale === "sw" ? "Namba ya kundi" : "Lot reference"} name="seedLot" />
            <FormField label={locale === "sw" ? "Gharama halisi" : "Actual cost"} name="costAmount" type="number" min="0" step="0.01" />
            <FormField label={locale === "sw" ? "Tarehe ya kupanda" : "Sowing date"} name="sownAt" type="date" />
            <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
          </ActionForm>
        </section>
        <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Ukaguzi wa kitalu" : "Survival check"}</h3><p>{locale === "sw" ? "Hifadhi idadi na hali ya miche." : "Record counts, condition and observations."}</p></div><Activity size={20} /></div>
          <ActionForm action={createNurseryCheckAction} submitLabel={t("save")} className="form-grid" offlineActionKey="nursery-check" workspaceId={data.farm.id} locale={locale}>
            <FormSelect label={locale === "sw" ? "Kundi la mbegu" : "Seed batch"} name="batchId" options={batches.map((batch) => ({ value: batch.id, label: `${batch.cycleLabel} · ${batch.seedLot || "no lot"}` }))} />
            <FormField label={locale === "sw" ? "Zilizoota" : "Germinated"} name="germinated" type="number" min="0" step="1" />
            <FormField label={locale === "sw" ? "Zilizo hai" : "Surviving"} name="surviving" type="number" min="0" step="1" />
            <FormField label={locale === "sw" ? "Hali" : "Condition"} name="condition" />
            <FormTextArea label={locale === "sw" ? "Maelezo / picha zitaongezwa baadaye" : "Notes (photo upload is not enabled yet)"} name="notes" />
          </ActionForm>
        </section>
        <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Upandikizaji" : "Transplant"} </h3><p>{locale === "sw" ? "Miche iliyohamishwa na iliyotupwa." : "Record plants moved to field and discarded."}</p></div><Sprout size={20} /></div>
          <ActionForm action={createTransplantAction} submitLabel={t("save")} className="form-grid">
            <FormSelect label={locale === "sw" ? "Kundi la mbegu" : "Seed batch"} name="batchId" options={batches.map((batch) => ({ value: batch.id, label: `${batch.cycleLabel} · ${batch.seedLot || "no lot"}` }))} />
            <FormField label={locale === "sw" ? "Idadi iliyopandikizwa" : "Plants transplanted"} name="quantityMoved" type="number" min="0" step="1" required />
            <FormField label={locale === "sw" ? "Idadi iliyotupwa" : "Plants discarded"} name="quantityDiscarded" type="number" min="0" step="1" defaultValue="0" />
            <FormField label={locale === "sw" ? "Tarehe" : "Transplant date"} name="movedAt" type="date" />
            <FormTextArea label={locale === "sw" ? "Sababu ya upotevu" : "Loss reason"} name="reason" />
          </ActionForm>
        </section>
      </div>
      <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Makundi ya kitalu" : "Nursery batches"}</h3><p>{batches.length} {locale === "sw" ? "makundi yamerekodiwa" : "batches recorded"}</p></div></div>
        {batches.length ? <div className="data-list">{batches.map((batch) => { const latest = batch.checks[0]; const survival = latest?.germinated && latest.surviving !== null ? latest.surviving / latest.germinated : null; return <div className="nursery-batch-row" key={batch.id}><span className="data-row-icon"><Flower2 size={18} /></span><div className="batch-main"><strong>{batch.cycleLabel}</strong><span>{batch.seedLot || (locale === "sw" ? "Kundi halijatajwa" : "Lot not recorded")} · {batch.supplier || (locale === "sw" ? "Muuzaji hajatajwa" : "Supplier not recorded")}</span></div><div className="batch-metric"><strong>{number(batch.quantity, locale, 2)} {batch.quantityUnit}</strong><span>{locale === "sw" ? "mbegu" : "seed"}</span></div><div className="batch-metric"><strong>{survival === null ? "—" : `${number(survival * 100, locale)}%`}</strong><span>{locale === "sw" ? "uhai wa miche" : "latest survival"}</span></div><div className="batch-metric"><strong>{batch.transplants.reduce((sum, plant) => sum + plant.quantityMoved, 0)}</strong><span>{locale === "sw" ? "imepandikizwa" : "transplanted"}</span></div></div>; })}</div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Anzisha mzunguko wa zao la kitalu ili kuongeza kundi." : "Start a nursery crop cycle before adding seed batches."} />}
      </section>
    </div>
  );
}

function TasksSection({ data, locale, nowMs }: { data: DashboardData; locale: Locale; nowMs: number }) {
  const t = (key: string) => translate(locale, key);
  const sortedTasks = [...data.tasks].sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  return (
    <div className="dashboard-content">
      <SectionHeading eyebrow="FIELD ROUTINE" title={t("tasks")} description={locale === "sw" ? "Kazi za utunzaji, vikumbusho na kumbukumbu za kila siku." : "Care reminders, daily tasks and a field diary."} />
      <div className="two-panel-grid tasks-top-grid">
        <section className="panel form-panel"><div className="panel-header"><div><h3>{t("addTask")}</h3><p>{locale === "sw" ? "Panga kazi kwa mzunguko wa zao." : "Schedule a task against a crop cycle."}</p></div><CalendarDays size={20} /></div>
          <ActionForm action={createTaskAction} submitLabel={t("save")} className="form-grid">
            <FormSelect label={locale === "sw" ? "Mzunguko wa zao" : "Crop cycle"} name="cycleId" options={data.cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.cropName} · ${cycle.plotName}` }))} />
            <FormField label={locale === "sw" ? "Jina la kazi" : "Task name"} name="title" required />
            <FormField label={locale === "sw" ? "Tarehe ya kukamilisha" : "Due date"} name="dueAt" type="date" required />
            <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
          </ActionForm>
        </section>
        <section className="panel form-panel"><div className="panel-header"><div><h3>{t("logActivity")}</h3><p>{locale === "sw" ? "Ingiza kumbukumbu hata bila mtandao." : "Save a field note offline; it syncs when you reconnect."}</p></div><Activity size={20} /></div><OfflineActivityForm cycles={data.cycles.map((cycle) => ({ id: cycle.id, cropName: cycle.cropName, plotName: cycle.plotName }))} farmId={data.farm.id} locale={locale} /></section>
      </div>
      <div className="three-panel-grid">
        <section className="panel form-panel">
          <div className="panel-header"><div><h3>{locale === "sw" ? "Rekodi hali ya hewa" : "Record weather"}</h3><p>{locale === "sw" ? "Tumia vipimo ulivyokusanya shambani." : "Record observed rain and temperature only."}</p></div><CloudSun size={20} /></div>
          <ActionForm action={recordWeatherAction} submitLabel={t("save")} className="form-grid" offlineActionKey="weather" workspaceId={data.farm.id} locale={locale}>
            <FormSelect label={locale === "sw" ? "Kitalu" : "Plot"} name="plotId" options={data.plots.map((plot) => ({ value: plot.id, label: plot.name }))} />
            <FormSelect label={locale === "sw" ? "Mzunguko (si lazima)" : "Crop cycle (optional)"} name="cycleId" required={false} options={data.cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.cropName} · ${cycle.plotName}` }))} />
            <FormField label={locale === "sw" ? "Tarehe" : "Date"} name="observedAt" type="date" />
            <FormField label={locale === "sw" ? "Mvua (mm)" : "Rainfall (mm)"} name="rainfallMm" type="number" min="0" step="0.1" />
            <FormField label={locale === "sw" ? "Joto (°C)" : "Temperature (°C)"} name="temperatureC" type="number" min="-80" max="80" step="0.1" />
            <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
          </ActionForm>
        </section>
        <section className="panel form-panel">
          <div className="panel-header"><div><h3>{locale === "sw" ? "Ukaguzi wa wadudu na magonjwa" : "Pest and disease scouting"}</h3><p>{locale === "sw" ? "Rekodi tatizo na kiwango chake." : "Record what was observed in the field."}</p></div><Search size={20} /></div>
          <ActionForm action={recordScoutingAction} submitLabel={t("save")} className="form-grid" offlineActionKey="scouting" workspaceId={data.farm.id} locale={locale}>
            <FormSelect label={locale === "sw" ? "Kitalu" : "Plot"} name="plotId" options={data.plots.map((plot) => ({ value: plot.id, label: plot.name }))} />
            <FormSelect label={locale === "sw" ? "Mzunguko (si lazima)" : "Crop cycle (optional)"} name="cycleId" required={false} options={data.cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.cropName} · ${cycle.plotName}` }))} />
            <FormField label={locale === "sw" ? "Mdudu au ugonjwa" : "Pest or disease"} name="issue" required />
            <FormSelect label={locale === "sw" ? "Ukali" : "Severity"} name="severity" options={[
              { value: "LOW", label: locale === "sw" ? "Chini" : "Low" },
              { value: "MEDIUM", label: locale === "sw" ? "Wastani" : "Medium" },
              { value: "HIGH", label: locale === "sw" ? "Juu" : "High" },
            ]} />
            <FormField label={locale === "sw" ? "Tarehe" : "Date"} name="observedAt" type="date" />
            <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
          </ActionForm>
        </section>
        <section className="panel form-panel">
          <div className="panel-header"><div><h3>{locale === "sw" ? "Rekodi ya unyunyiziaji" : "Spray record"}</h3><p>{locale === "sw" ? "Hifadhi muda wa kusubiri kabla ya kuvuna." : "Record the pre-harvest interval for safety checks."}</p></div><ShieldCheck size={20} /></div>
          <ActionForm action={recordSprayAction} submitLabel={t("save")} className="form-grid" offlineActionKey="spray" workspaceId={data.farm.id} locale={locale}>
            <FormSelect label={locale === "sw" ? "Kitalu" : "Plot"} name="plotId" options={data.plots.map((plot) => ({ value: plot.id, label: plot.name }))} />
            <FormSelect label={locale === "sw" ? "Mzunguko (si lazima)" : "Crop cycle (optional)"} name="cycleId" required={false} options={data.cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.cropName} · ${cycle.plotName}` }))} />
            <FormField label={locale === "sw" ? "Bidhaa" : "Product"} name="product" required />
            <FormField label={locale === "sw" ? "Kiambato hai" : "Active ingredient"} name="activeIngredient" />
            <FormField label={locale === "sw" ? "Kundi / batch" : "Batch"} name="batch" />
            <FormField label={locale === "sw" ? "Kipimo" : "Dose"} name="dose" />
            <FormField label={locale === "sw" ? "Siku za kusubiri kabla ya mavuno" : "Pre-harvest interval (days)"} name="preHarvestIntervalDays" type="number" min="0" max="365" step="1" />
            <FormField label={locale === "sw" ? "Tarehe ya kunyunyizia" : "Application date"} name="appliedAt" type="date" />
            <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
          </ActionForm>
        </section>
      </div>
      {(data.weatherLogs.length > 0 || data.scoutingLogs.length > 0 || data.sprayRecords.length > 0) && (
        <section className="panel data-panel">
          <div className="panel-header"><div><h3>{locale === "sw" ? "Kumbukumbu za shamba" : "Field observations"}</h3><p>{locale === "sw" ? "Hali ya hewa, ukaguzi na dawa zilizotumika." : "Recent weather, scouting and spray records."}</p></div></div>
          <div className="recent-list">
            {data.sprayRecords.map((record) => <article className="recent-item" key={record.id}><span className={`recent-dot ${record.warning ? "task-state-icon state-overdue" : ""}`} /><div><p><strong>{record.product}</strong>{record.warning && <span className="status-pill status-skipped">{locale === "sw" ? "Tahadhari: muda wa kusubiri unaingiliana na mavuno" : "Warning: harvest falls inside the pre-harvest interval"}</span>}</p><span>{record.plotName} · {record.cropName ?? (locale === "sw" ? "Hakuna mzunguko" : "No cycle")} · {dateLabel(record.appliedAt, locale)} · {record.preHarvestIntervalDays === null ? (locale === "sw" ? "Muda wa kusubiri haujawekwa" : "No interval recorded") : `${record.preHarvestIntervalDays} ${locale === "sw" ? "siku" : "days"}`}</span></div></article>)}
            {data.scoutingLogs.map((record) => <article className="recent-item" key={record.id}><span className="recent-dot" /><div><p><strong>{record.issue}</strong> · {titleCase(record.severity)}</p><span>{record.plotName} · {record.cropName ?? (locale === "sw" ? "Hakuna mzunguko" : "No cycle")} · {dateLabel(record.observedAt, locale)}{record.notes ? ` · ${record.notes}` : ""}</span></div></article>)}
            {data.weatherLogs.map((record) => <article className="recent-item" key={record.id}><span className="recent-dot" /><div><p><strong>{record.plotName}</strong> · {dateLabel(record.observedAt, locale)}</p><span>{record.rainfallMm === null ? "—" : `${number(record.rainfallMm, locale)} mm`} {locale === "sw" ? "mvua" : "rain"} · {record.temperatureC === null ? "—" : `${number(record.temperatureC, locale)} °C`}{record.notes ? ` · ${record.notes}` : ""}</span></div></article>)}
          </div>
        </section>
      )}
      <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Kazi zilizopangwa" : "Scheduled tasks"}</h3><p>{data.tasks.length} {locale === "sw" ? "kazi" : "tasks"}</p></div><span className="panel-counter">{data.tasks.filter((task) => task.status === "PENDING").length} {t("pending").toLowerCase()}</span></div>
        {sortedTasks.length ? <div className="task-table">{sortedTasks.map((task) => <div className={`task-row ${task.status === "PENDING" && task.dueAt && new Date(task.dueAt).getTime() < nowMs ? "task-row-overdue" : ""}`} key={task.id}><span className={`task-state-icon state-${task.status.toLowerCase()}`}>{task.status === "DONE" ? <Check size={15} /> : <span />}</span><div className="task-row-copy"><strong>{locale === "sw" ? task.titleSw : task.titleEn}</strong><span>{task.cropName} · {task.plotName}</span></div><time>{dateLabel(task.dueAt, locale)}</time><span className={`status-pill ${task.status === "DONE" ? "status-done" : task.status === "SKIPPED" ? "status-skipped" : ""}`}>{titleCase(task.status)}</span><ActionForm action={updateTaskStatusAction} submitLabel={locale === "sw" ? "Badili" : "Update"} className="task-status-form" offlineActionKey="task-status" locale={locale}><input name="taskId" type="hidden" value={task.id} /><FormSelect label={locale === "sw" ? "Hali" : "Status"} name="status" defaultValue={task.status} options={[{ value: "PENDING", label: locale === "sw" ? "Inasubiri" : "Pending" }, { value: "DONE", label: locale === "sw" ? "Imekamilika" : "Done" }, { value: "SKIPPED", label: locale === "sw" ? "Imepitwa" : "Skipped" }, { value: "DELAYED", label: locale === "sw" ? "Imechelewa" : "Delayed" }]} /></ActionForm></div>)}</div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Kazi za utunzaji zitaonekana hapa." : "Tasks generated from care templates will appear here."} />}
      </section>
      <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Kumbukumbu za shamba" : "Field diary"}</h3><p>{locale === "sw" ? "Shughuli zilizorekodiwa hivi karibuni." : "Recent daily activity notes."}</p></div></div>
        {data.logs.length ? <div className="recent-list">{data.logs.map((log) => <article className="recent-item" key={log.id}><span className="recent-dot" /><div><p>{log.body}</p><span>{log.cropName ?? (locale === "sw" ? "Shughuli za shamba" : "Farm activity")} · {log.weather || (locale === "sw" ? "Hali ya hewa haijawekwa" : "Weather not recorded")} · {dateLabel(log.loggedAt, locale)}</span></div></article>)}</div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Kumbukumbu zako za shambani zitaonekana hapa." : "Your farm diary entries will appear here."} />}
      </section>
    </div>
  );
}

function InputsSection({
  data,
  locale,
  isOwner,
}: {
  data: DashboardData;
  locale: Locale;
  isOwner: boolean;
}) {
  const t = (key: string) => translate(locale, key);
  const movementOptions = isOwner
    ? [
        { value: "PURCHASE", label: locale === "sw" ? "Ununuzi" : "Purchase" },
        { value: "USAGE", label: locale === "sw" ? "Matumizi" : "Usage" },
        { value: "ADJUSTMENT", label: locale === "sw" ? "Marekebisho ya hesabu" : "Stock adjustment" },
      ]
    : [{ value: "USAGE", label: locale === "sw" ? "Matumizi" : "Usage" }];
  return (
    <div className="dashboard-content">
      <SectionHeading eyebrow="INPUTS & INVENTORY" title={t("inputs")} description={locale === "sw" ? "Rekodi manunuzi, makundi ya bidhaa na matumizi kwa zao." : "Track purchases, input lots and usage against crop cycles."} />
      <div className="three-panel-grid">
        {isOwner && <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Bidhaa mpya" : "Add stock item"}</h3><p>{locale === "sw" ? "Weka kipimo na kiwango cha tahadhari." : "Set a unit and optional low-stock threshold."}</p></div><Package size={20} /></div>
          <ActionForm action={createStockItemAction} submitLabel={t("save")} className="form-grid">
            <FormField label={locale === "sw" ? "Jina la bidhaa" : "Item name"} name="name" required />
            <FormSelect label={locale === "sw" ? "Kategoria ya gharama" : "Cost category"} name="category" options={expenseCategories.map((category) => ({ value: category, label: titleCase(category) }))} />
            <FormField label={locale === "sw" ? "Kipimo" : "Unit"} name="unit" placeholder="kg, bag, litre..." required />
            <FormField label={locale === "sw" ? "Tahadhari ya akiba" : "Low-stock alert at"} name="lowStockThreshold" type="number" min="0" step="any" />
          </ActionForm>
        </section>}
        {isOwner && <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Muuzaji mpya" : "Add supplier"}</h3><p>{locale === "sw" ? "Tumia rekodi moja kulinganisha makundi." : "Keep supplier names consistent for lot comparisons."}</p></div><Users size={20} /></div>
          <ActionForm action={createSupplierAction} submitLabel={t("save")} className="form-grid">
            <FormField label={locale === "sw" ? "Jina la muuzaji" : "Supplier name"} name="name" required />
            <FormField label={locale === "sw" ? "Mawasiliano" : "Contact"} name="contact" />
          </ActionForm>
        </section>}
        <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Rekodi mwendo wa bidhaa" : "Record stock movement"}</h3><p>{locale === "sw" ? "Matumizi yaingizwe kwenye mzunguko wa zao." : "Cycle-linked usage counts toward actual crop cost."}</p></div><ArrowDownRight size={20} /></div>
          <ActionForm action={createStockMovementAction} submitLabel={t("save")} className="form-grid">
            <FormSelect label={locale === "sw" ? "Bidhaa" : "Stock item"} name="itemId" options={data.stockItems.map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` }))} />
            <FormSelect label={locale === "sw" ? "Aina ya mwendo" : "Movement type"} name="type" options={movementOptions} />
            <FormField label={locale === "sw" ? "Kiasi" : "Quantity"} name="quantity" type="number" step="any" required />
            {isOwner && <FormField label={locale === "sw" ? "Gharama kwa kipimo (bei halisi)" : "Actual purchase cost per unit"} name="unitCost" type="number" min="0" step="any" />}
            <FormSelect label={locale === "sw" ? "Mzunguko wa zao" : "Crop cycle"} name="cycleId" required={false} options={data.cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.cropName} · ${cycle.plotName}` }))} />
            <FormSelect label={locale === "sw" ? "Muuzaji" : "Supplier"} name="supplierId" required={false} options={data.suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))} />
            <FormField label={locale === "sw" ? "Namba ya kundi" : "Input lot / batch"} name="lotReference" />
            <FormSelect label={locale === "sw" ? "Kazi inayohusiana" : "Related task"} name="taskId" required={false} options={data.tasks.map((task) => ({ value: task.id, label: `${task.titleEn} · ${task.plotName}` }))} />
            <FormField label={locale === "sw" ? "Tarehe" : "Date"} name="movedAt" type="date" />
            <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
            <p className="field-help field-wide">{isOwner
              ? locale === "sw" ? "Manunuzi yanahitaji gharama halisi kwa kipimo. Matumizi yanapaswa kuunganishwa na zao." : "Purchases need the actual cost per unit; usage should be linked to a cycle."
              : locale === "sw" ? "Ununuzi na marekebisho hufanywa na mmiliki. Gharama ya matumizi hutokana na manunuzi yaliyorekodiwa." : "Purchases and adjustments are owner-only. Usage cost is derived from recorded purchases."}</p>
          </ActionForm>
        </section>
      </div>
      <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Hali ya akiba" : "Stock on hand"}</h3><p>{data.stockItems.length} {locale === "sw" ? "bidhaa zinafuatiliwa" : "items tracked"}</p></div></div>
        {data.stockItems.length ? <div className="table-scroll"><table><thead><tr><th>{locale === "sw" ? "Bidhaa" : "Item"}</th><th>{locale === "sw" ? "Kategoria" : "Category"}</th><th>{locale === "sw" ? "Akiba" : "On hand"}</th><th>{locale === "sw" ? "Kiwango cha tahadhari" : "Alert threshold"}</th><th>{locale === "sw" ? "Hali" : "Status"}</th></tr></thead><tbody>{data.stockItems.map((item) => { const low = item.lowStockThreshold !== null && item.balance <= item.lowStockThreshold; return <tr key={item.id}><td><strong>{item.name}</strong></td><td>{titleCase(item.category)}</td><td>{number(item.balance, locale, 2)} {item.unit}</td><td>{item.lowStockThreshold === null ? "—" : `${number(item.lowStockThreshold, locale, 2)} ${item.unit}`}</td><td><span className={`status-pill ${low ? "status-warning" : "status-done"}`}>{low ? (locale === "sw" ? "Akiba ndogo" : "Low stock") : (locale === "sw" ? "Inapatikana" : "In stock")}</span></td></tr>; })}</tbody></table></div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Ongeza bidhaa ili kuanza kufuatilia akiba." : "Add an item to start tracking stock."} />}
      </section>
      <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Manunuzi na matumizi" : "Purchase and usage history"}</h3><p>{data.stockMovements.length} {locale === "sw" ? "mwendo wa bidhaa" : "recent stock movements"}</p></div></div>
        {data.stockMovements.length ? <div className="data-list">{data.stockMovements.map((movement) => <div className="data-row" key={movement.id}><span className="data-row-icon"><Package size={17} /></span><div><strong>{titleCase(movement.type)} · {movement.itemName}</strong><span>{movement.supplierName || (locale === "sw" ? "Muuzaji hajarekodiwa" : "Supplier not recorded")} · {movement.lotReference || (locale === "sw" ? "Kundi halijarekodiwa" : "Lot not recorded")} {movement.cropName ? `· ${movement.cropName}` : ""}</span></div><time>{number(movement.quantity, locale, 2)} {movement.unit} · {dateLabel(movement.movedAt, locale)}</time></div>)}</div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Historia ya manunuzi na matumizi itaonekana hapa." : "Purchase and usage history will appear here."} />}
      </section>
    </div>
  );
}

function LabourSection({
  data,
  locale,
  isOwner,
}: {
  data: DashboardData;
  locale: Locale;
  isOwner: boolean;
}) {
  const t = (key: string) => translate(locale, key);
  const weeklyPay = new Map<string, { name: string; hours: number; paid: number; owed: number }>();
  for (const entry of data.weeklyWorkEntries) {
    const current = weeklyPay.get(entry.workerName) ?? {
      name: entry.workerName,
      hours: 0,
      paid: 0,
      owed: 0,
    };
    current.hours += entry.hours;
    if (entry.amount !== null) {
      if (entry.paid) current.paid += entry.amount;
      else current.owed += entry.amount;
    }
    weeklyPay.set(entry.workerName, current);
  }
  const weeklyRows = [...weeklyPay.values()].sort((left, right) => left.name.localeCompare(right.name));
  const assetCostRows = summarizeAssetCosts(data.assets, data.assetUsages, data.assetMaintenances);
  const downloadAssetCosts = () => {
    const quoteCsv = (value: string | number) => {
      const text = String(value);
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = [
      ["Asset", "Type", "Hours", "Distance", "Distance unit", "Fuel cost", "Maintenance cost", "Total running cost"],
      ...assetCostRows.map((row) => [
        row.asset.name,
        row.asset.type,
        row.hours,
        row.distance,
        row.distanceUnit,
        row.fuelCost,
        row.maintenanceCost,
        row.fuelCost + row.maintenanceCost,
      ]),
    ];
    const csv = rows.map((row) => row.map(quoteCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "shamba-asset-cost-report.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="dashboard-content">
      <SectionHeading eyebrow="PEOPLE & COSTS" title={t("labour")} description={locale === "sw" ? "Rekodi saa kwa kazi na gharama ziunganishwe kwenye mzunguko." : "Record hours against farm work and connect labour cost to cycles."} />
      <div className="two-panel-grid">
        {isOwner && <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Ongeza mfanyakazi" : "Add worker"}</h3><p>{locale === "sw" ? "Wafanyakazi hawahitaji akaunti." : "Workers are recorded by name; they do not need logins."}</p></div><Users size={20} /></div>
          <ActionForm action={createWorkerAction} submitLabel={t("save")} className="form-grid">
            <FormField label={locale === "sw" ? "Jina la mfanyakazi" : "Worker name"} name="name" required />
            <FormField label={locale === "sw" ? `Kiwango cha saa (${data.farm.currency})` : `Hourly rate (${data.farm.currency})`} name="hourlyRate" type="number" min="0" step="0.01" />
          </ActionForm>
        </section>}
        <section className="panel form-panel"><div className="panel-header"><div><h3>{t("recordWork")}</h3><p>{isOwner ? (locale === "sw" ? "Hesabu ya gharama hutumia kiwango cha mfanyakazi." : "Labour cost is calculated from the worker's saved rate.") : (locale === "sw" ? "Rekodi saa; kiwango huwekwa na mmiliki." : "Record hours; the farm owner sets the wage rate.")}</p></div><Clock3 size={20} /></div>
          <ActionForm action={createWorkEntryAction} submitLabel={t("save")} className="form-grid" offlineActionKey="work-entry" workspaceId={data.farm.id} locale={locale}>
            <FormSelect label={locale === "sw" ? "Mfanyakazi" : "Worker"} name="workerId" options={data.workers.map((worker) => ({ value: worker.id, label: worker.name }))} />
            <FormSelect label={locale === "sw" ? "Mzunguko wa zao" : "Crop cycle"} name="cycleId" required={false} options={data.cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.cropName} · ${cycle.plotName}` }))} />
            <FormField label={locale === "sw" ? "Kazi" : "Task"} name="taskLabel" required />
            <FormField label={locale === "sw" ? "Mwanzo" : "Start time"} name="startedAt" type="datetime-local" required />
            <FormField label={locale === "sw" ? "Mwisho" : "End time"} name="endedAt" type="datetime-local" required />
            {isOwner && <FormField label={locale === "sw" ? "Kiwango cha saa (hiari)" : "Hourly rate override (optional)"} name="hourlyRate" type="number" min="0" step="0.01" />}
            <FormSelect label={locale === "sw" ? "Malipo" : "Payment status"} name="paid" options={[{ value: "no", label: locale === "sw" ? "Haijalipwa" : "Unpaid" }, { value: "yes", label: locale === "sw" ? "Imelipwa" : "Paid" }]} />
            {isOwner && <FormSelect label={locale === "sw" ? "Njia ya malipo" : "Payment method (required if paid)"} name="paymentMethod" required={false} options={[
              { value: "CASH", label: locale === "sw" ? "Fedha taslimu" : "Cash" },
              { value: "BANK", label: locale === "sw" ? "Benki" : "Bank" },
              { value: "MOBILE_MONEY", label: locale === "sw" ? "Pesa kwa simu" : "Mobile money" },
            ]} />}
            {isOwner && <FormField label={locale === "sw" ? "Namba ya kumbukumbu ya malipo" : "Payment reference"} name="paymentReference" />}
          </ActionForm>
        </section>
        {isOwner && <section className="panel form-panel"><div className="panel-header"><div><h3>{t("addExpense")}</h3><p>{locale === "sw" ? "Gawa gharama kwenye mzunguko unaohusika." : "Allocate each direct expense to a crop cycle."}</p></div><CircleDollarSign size={20} /></div>
          <ActionForm action={createExpenseAction} submitLabel={t("save")} className="form-grid" offlineActionKey="expense" workspaceId={data.farm.id} locale={locale}>
            <FormSelect label={locale === "sw" ? "Mzunguko wa zao" : "Crop cycle"} name="cycleId" required={false} options={data.cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.cropName} · ${cycle.plotName}` }))} />
            <FormSelect label={locale === "sw" ? "Kategoria" : "Category"} name="category" options={expenseCategories.map((category) => ({ value: category, label: titleCase(category) }))} />
            <FormField label={locale === "sw" ? `Kiasi (${data.farm.currency})` : `Amount (${data.farm.currency})`} name="amount" type="number" min="0.01" step="0.01" required />
            <FormField label={locale === "sw" ? "Tarehe" : "Date"} name="spentAt" type="date" />
            <FormTextArea label={locale === "sw" ? "Mgao wa gharama (hiari)" : "Split allocations (optional)"} name="allocations" placeholder="cycle:cycle-id | 12000&#10;plot:plot-id | 5000" />
            <p className="field-help field-wide">{locale === "sw" ? "Kila mstari: cycle:ID | kiasi au plot:ID | kiasi. Jumla lazima ilingane na gharama. Tumia mgao badala ya mzunguko mmoja." : "One line each: cycle:ID | amount or plot:ID | amount. Amounts must add up exactly; use this instead of selecting one cycle."}</p>
            <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
          </ActionForm>
        </section>}
        {isOwner && <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Rekodi kazi ya mashine" : "Record machinery job"}</h3><p>{locale === "sw" ? "Saa na gharama huunganishwa na mzunguko wa zao." : "Log machine hours and attribute fuel, hire and maintenance costs."}</p></div><Clock3 size={20} /></div>
          <ActionForm action={createMachineJobAction} submitLabel={t("save")} className="form-grid">
            <FormField label={locale === "sw" ? "Kazi / mashine" : "Job / equipment"} name="description" required />
            <FormSelect label={locale === "sw" ? "Mzunguko wa zao" : "Crop cycle"} name="cycleId" required={false} options={data.cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.cropName} · ${cycle.plotName}` }))} />
            <FormSelect label={locale === "sw" ? "Kitalu" : "Plot"} name="plotId" required={false} options={data.plots.map((plot) => ({ value: plot.id, label: plot.name }))} />
            <FormField label={locale === "sw" ? "Saa za mashine" : "Machine hours"} name="hours" type="number" min="0.01" step="0.01" required />
            <FormField label={locale === "sw" ? "Mafuta" : "Fuel cost"} name="fuelCost" type="number" min="0" step="0.01" />
            <FormField label={locale === "sw" ? "Kukodisha" : "Hire cost"} name="hireCost" type="number" min="0" step="0.01" />
            <FormField label={locale === "sw" ? "Matengenezo" : "Maintenance cost"} name="maintenanceCost" type="number" min="0" step="0.01" />
            <FormField label={locale === "sw" ? "Tarehe" : "Date"} name="performedAt" type="date" />
          </ActionForm>
        </section>}
        {isOwner && <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Sajili kifaa" : "Register asset"}</h3><p>{locale === "sw" ? "Rekodi vifaa vinavyomilikiwa au kutumika shambani." : "Track farm equipment and its purchase details."}</p></div><Wrench size={20} /></div>
          <ActionForm action={createAssetAction} submitLabel={t("save")} className="form-grid">
            <FormField label={locale === "sw" ? "Jina la kifaa" : "Asset name"} name="name" required />
            <FormField label={locale === "sw" ? "Aina" : "Type"} name="type" placeholder={locale === "sw" ? "Mfano: pampu" : "e.g. pump"} required />
            <FormField label={locale === "sw" ? "Tarehe ya ununuzi" : "Purchase date"} name="purchasedAt" type="date" />
            <FormField label={locale === "sw" ? `Gharama ya ununuzi (${data.farm.currency})` : `Purchase cost (${data.farm.currency})`} name="purchaseCost" type="number" min="0" step="0.01" />
            <FormField label={locale === "sw" ? "Muda wa matumizi (miezi)" : "Expected life (months)"} name="expectedLifeMonths" type="number" min="1" step="1" />
            <FormSelect label={locale === "sw" ? "Hali" : "Status"} name="status" options={[
              { value: "ACTIVE", label: locale === "sw" ? "Inatumika" : "Active" },
              { value: "IDLE", label: locale === "sw" ? "Haitumiki kwa sasa" : "Idle" },
              { value: "RETIRED", label: locale === "sw" ? "Imestaafishwa" : "Retired" },
            ]} />
            <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
          </ActionForm>
        </section>}
        <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Rekodi matumizi ya kifaa" : "Record asset usage"}</h3><p>{locale === "sw" ? "Weka saa au umbali na uunganishe na mzunguko inapohusika." : "Log operating hours or distance and link the work to a crop cycle."}</p></div><Wrench size={20} /></div>
          <ActionForm action={recordAssetUsageAction} submitLabel={t("save")} className="form-grid">
            <FormSelect label={locale === "sw" ? "Kifaa" : "Asset"} name="assetId" options={data.assets.filter((asset) => asset.status === "ACTIVE").map((asset) => ({ value: asset.id, label: `${asset.name} · ${asset.type}` }))} />
            <FormSelect label={locale === "sw" ? "Mzunguko wa zao" : "Crop cycle"} name="cycleId" required={false} options={data.cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.cropName} · ${cycle.plotName}` }))} />
            <FormSelect label={locale === "sw" ? "Kitalu" : "Plot"} name="plotId" required={false} options={data.plots.map((plot) => ({ value: plot.id, label: plot.name }))} />
            <FormField label={locale === "sw" ? "Saa zilizotumika" : "Hours used"} name="hours" type="number" min="0.01" step="0.01" />
            <FormField label={locale === "sw" ? "Umbali" : "Distance"} name="distance" type="number" min="0.01" step="0.01" />
            <FormField label={locale === "sw" ? "Kipimo cha umbali" : "Distance unit"} name="distanceUnit" placeholder="km" />
            <FormField label={locale === "sw" ? "Mwendeshaji" : "Operator"} name="operator" />
            {isOwner && <FormField label={locale === "sw" ? `Gharama ya mafuta (${data.farm.currency})` : `Fuel cost (${data.farm.currency})`} name="fuelCost" type="number" min="0" step="0.01" />}
            <FormField label={locale === "sw" ? "Tarehe" : "Date"} name="usedAt" type="date" />
            <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
          </ActionForm>
        </section>
        {isOwner && <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Rekodi matengenezo" : "Record maintenance"}</h3><p>{locale === "sw" ? "Gharama na tarehe inayofuata ya huduma zinaweza kuunganishwa na mzunguko." : "Track service costs and the next service date."}</p></div><Wrench size={20} /></div>
          <ActionForm action={createAssetMaintenanceAction} submitLabel={t("save")} className="form-grid">
            <FormSelect label={locale === "sw" ? "Kifaa" : "Asset"} name="assetId" options={data.assets.map((asset) => ({ value: asset.id, label: `${asset.name} · ${asset.type}` }))} />
            <FormSelect label={locale === "sw" ? "Mzunguko wa zao" : "Crop cycle (optional)"} name="cycleId" required={false} options={data.cycles.map((cycle) => ({ value: cycle.id, label: `${cycle.cropName} · ${cycle.plotName}` }))} />
            <FormField label={locale === "sw" ? "Huduma iliyofanyika" : "Maintenance performed"} name="description" required />
            <FormField label={locale === "sw" ? `Gharama (${data.farm.currency})` : `Cost (${data.farm.currency})`} name="cost" type="number" min="0" step="0.01" />
            <FormField label={locale === "sw" ? "Tarehe ya huduma" : "Service date"} name="performedAt" type="date" />
            <FormField label={locale === "sw" ? "Huduma inayofuata" : "Next service due"} name="nextServiceAt" type="date" />
            <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
          </ActionForm>
        </section>}
      </div>
      <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Daftari la vifaa" : "Asset register"}</h3><p>{data.assets.length} {locale === "sw" ? "vifaa hai" : "active assets"}</p></div></div>
        {data.assets.length ? <div className="table-scroll"><table><thead><tr><th>{locale === "sw" ? "Kifaa" : "Asset"}</th><th>{locale === "sw" ? "Aina" : "Type"}</th><th>{locale === "sw" ? "Hali" : "Status"}</th><th>{locale === "sw" ? "Ununuzi" : "Purchased"}</th>{isOwner && <th>{locale === "sw" ? "Gharama" : "Purchase cost"}</th>}<th>{locale === "sw" ? "Muda wa matumizi" : "Expected life"}</th>{isOwner && <th>{locale === "sw" ? "Kitendo" : "Action"}</th>}</tr></thead><tbody>{data.assets.map((asset) => <tr key={asset.id}><td><strong>{asset.name}</strong></td><td>{asset.type}</td><td>{titleCase(asset.status)}</td><td>{dateLabel(asset.purchasedAt, locale)}</td>{isOwner && <td>{asset.purchaseCost === null ? "—" : money(asset.purchaseCost, asset.currency, locale)}</td>}<td>{asset.expectedLifeMonths === null ? "—" : `${number(asset.expectedLifeMonths, locale, 0)} ${locale === "sw" ? "miezi" : "months"}`}</td>{isOwner && <td><ActionForm action={archiveAssetAction} submitLabel={locale === "sw" ? "Hifadhi" : "Archive"}><input name="assetId" type="hidden" value={asset.id} /></ActionForm></td>}</tr>)}</tbody></table></div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Sajili kifaa ili kuanza kufuatilia matumizi." : "Register an asset to track use and service."} />}
      </section>
      {isOwner && <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Ripoti ya gharama za vifaa" : "Asset cost report"}</h3><div className="button-row"><p>{locale === "sw" ? "Mafuta na matengenezo kwa kifaa." : "Fuel and maintenance costs by asset."}</p><button className="button button-quiet" onClick={downloadAssetCosts} type="button"><Download size={16} /> {locale === "sw" ? "Pakua CSV" : "Download CSV"}</button><button className="button button-quiet print-button" onClick={() => window.print()} type="button"><Printer size={16} /> {locale === "sw" ? "Chapisha / PDF" : "Print / PDF"}</button></div></div></div>
        {assetCostRows.length ? <div className="table-scroll"><table><thead><tr><th>{locale === "sw" ? "Kifaa" : "Asset"}</th><th>{locale === "sw" ? "Saa" : "Hours"}</th><th>{locale === "sw" ? "Umbali" : "Distance"}</th><th>{locale === "sw" ? "Mafuta" : "Fuel"}</th><th>{locale === "sw" ? "Matengenezo" : "Maintenance"}</th><th>{locale === "sw" ? "Jumla" : "Total"}</th></tr></thead><tbody>{assetCostRows.map((row) => <tr key={row.asset.id}><td>{row.asset.name}</td><td>{number(row.hours, locale, 2)}</td><td>{row.distance ? `${number(row.distance, locale, 2)} ${row.distanceUnit}` : "—"}</td><td>{money(row.fuelCost, data.farm.currency, locale)}</td><td>{money(row.maintenanceCost, data.farm.currency, locale)}</td><td>{money(row.fuelCost + row.maintenanceCost, data.farm.currency, locale)}</td></tr>)}</tbody></table></div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Gharama za vifaa zitaonekana baada ya kurekodi matumizi au matengenezo." : "Asset costs appear after usage or maintenance is recorded."} />}
      </section>}
      <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Matumizi na matengenezo ya hivi karibuni" : "Recent asset usage and maintenance"}</h3><p>{data.assetUsages.length + data.assetMaintenances.length} {locale === "sw" ? "rekodi" : "records"}</p></div></div>
        {data.assetUsages.length || data.assetMaintenances.length ? <div className="data-list">
          {data.assetUsages.map((usage) => <div className="data-row" key={`usage-${usage.id}`}><span className="data-row-icon"><Wrench size={17} /></span><div><strong>{usage.assetName} · {locale === "sw" ? "Matumizi" : "Usage"}</strong><span>{usage.cropName || usage.plotName || (locale === "sw" ? "Shughuli za shamba" : "Farm operation")}{usage.operator ? ` · ${usage.operator}` : ""}</span></div><time>{[usage.hours ? `${number(usage.hours, locale, 2)} h` : "", usage.distance ? `${number(usage.distance, locale, 2)} ${usage.distanceUnit}` : "", dateLabel(usage.usedAt, locale)].filter(Boolean).join(" · ")}</time></div>)}
          {data.assetMaintenances.map((entry) => <div className="data-row" key={`maintenance-${entry.id}`}><span className="data-row-icon"><Wrench size={17} /></span><div><strong>{entry.assetName} · {entry.description}</strong><span>{entry.cropName || (locale === "sw" ? "Matengenezo ya jumla" : "General maintenance")}{entry.nextServiceAt ? ` · ${locale === "sw" ? "Huduma inayofuata" : "Next service"}: ${dateLabel(entry.nextServiceAt, locale)}` : ""}</span></div><time>{dateLabel(entry.performedAt, locale)}{isOwner && entry.cost !== null ? ` · ${money(entry.cost, entry.currency, locale)}` : ""}</time></div>)}
        </div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Matumizi na matengenezo yataonekana hapa." : "Asset usage and service records will appear here."} />}
      </section>
      <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Wafanyakazi" : "Workers"}</h3><p>{data.workers.length} {locale === "sw" ? "wafanyakazi hai" : "active workers"}</p></div></div>
        {data.workers.length ? <div className="worker-card-grid">{data.workers.map((worker) => <article className="worker-card" key={worker.id}><span className="profile-avatar">{initials(worker.name)}</span><div><strong>{worker.name}</strong><span>{worker.hourlyRate === null ? (locale === "sw" ? "Kiwango hakijawekwa" : "Rate not set") : `${money(worker.hourlyRate, worker.currency, locale)} / ${locale === "sw" ? "saa" : "hour"}`}</span></div><span className="status-pill status-done">{locale === "sw" ? "Hai" : "Active"}</span></article>)}</div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Ongeza mfanyakazi ili kurekodi saa." : "Add a worker to start tracking hours."} />}
      </section>
      {isOwner && <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Kazi zilizorekodiwa" : "Recorded work"}</h3><p>{data.workEntries.length} {locale === "sw" ? "rekodi" : "entries"}</p></div></div>
        {data.workEntries.length ? <div className="table-scroll"><table><thead><tr><th>{locale === "sw" ? "Mfanyakazi" : "Worker"}</th><th>{locale === "sw" ? "Kazi" : "Task"}</th><th>{locale === "sw" ? "Zao" : "Crop"}</th><th>{locale === "sw" ? "Saa" : "Hours"}</th><th>{locale === "sw" ? "Gharama" : "Cost"}</th><th>{locale === "sw" ? "Malipo" : "Paid"}</th><th>{locale === "sw" ? "Njia / kumbukumbu" : "Method / reference"}</th></tr></thead><tbody>{data.workEntries.map((entry) => <tr key={entry.id}><td>{entry.workerName}</td><td>{entry.taskLabel}</td><td>{entry.cropName || "—"}</td><td>{number(entry.hours, locale, 2)}</td><td>{entry.amount === null ? "—" : money(entry.amount, entry.currency, locale)}</td><td><span className={`status-pill ${entry.paid ? "status-done" : "status-warning"}`}>{entry.paid ? (locale === "sw" ? "Imelipwa" : "Paid") : (locale === "sw" ? "Inadaiwa" : "Owed")}</span></td><td>{entry.paymentMethod ? `${titleCase(entry.paymentMethod)}${entry.paymentReference ? ` · ${entry.paymentReference}` : ""}` : "—"}</td></tr>)}</tbody></table></div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Rekodi za kazi zitaonekana hapa." : "Recorded work hours will appear here."} />}
      </section>}
      {isOwner && <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Muhtasari wa malipo ya siku 7" : "Last 7 days pay summary"}</h3><p>{locale === "sw" ? "Jumla kwa mfanyakazi, ikigawa kilicholipwa na kinachodaiwa." : "Hours and wages grouped by worker, split into paid and owed."}</p></div><Clock3 size={20} /></div>
        {weeklyRows.length ? <div className="table-scroll"><table><thead><tr><th>{locale === "sw" ? "Mfanyakazi" : "Worker"}</th><th>{locale === "sw" ? "Saa" : "Hours"}</th><th>{locale === "sw" ? "Imelipwa" : "Paid"}</th><th>{locale === "sw" ? "Inadaiwa" : "Owed"}</th></tr></thead><tbody>{weeklyRows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{number(row.hours, locale, 2)}</td><td>{money(row.paid, data.farm.currency, locale)}</td><td>{money(row.owed, data.farm.currency, locale)}</td></tr>)}</tbody></table></div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Hakuna saa zilizorekodiwa katika siku saba zilizopita." : "No work hours were recorded in the last 7 days."} />}
      </section>}
      {isOwner && <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Gharama za moja kwa moja" : "Direct expenses"}</h3><p>{data.expenses.length} {locale === "sw" ? "gharama" : "expenses"}</p></div></div>
        {data.expenses.length ? <div className="table-scroll"><table><thead><tr><th>{locale === "sw" ? "Tarehe" : "Date"}</th><th>{locale === "sw" ? "Kategoria" : "Category"}</th><th>{locale === "sw" ? "Zao" : "Crop"}</th><th>{locale === "sw" ? "Kiasi" : "Amount"}</th><th>{locale === "sw" ? "Maelezo" : "Notes"}</th></tr></thead><tbody>{data.expenses.map((expense) => <tr key={expense.id}><td>{dateLabel(expense.spentAt, locale)}</td><td>{titleCase(expense.category)}</td><td>{expense.cropName || (expense.allocations.length ? (locale === "sw" ? "Mgao wa pamoja" : "Split allocation") : "—")}</td><td>{money(expense.amount, expense.currency, locale)}</td><td>{expense.notes || "—"}</td></tr>)}</tbody></table></div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Gharama zitaonekana hapa." : "Direct expenses will appear here."} />}
      </section>}
      {isOwner && <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Kazi za mashine" : "Machinery jobs"}</h3><p>{data.machineJobs.length} {locale === "sw" ? "rekodi" : "records"}</p></div></div>
        {data.machineJobs.length ? <div className="table-scroll"><table><thead><tr><th>{locale === "sw" ? "Tarehe" : "Date"}</th><th>{locale === "sw" ? "Kazi" : "Job"}</th><th>{locale === "sw" ? "Zao / kitalu" : "Crop / plot"}</th><th>{locale === "sw" ? "Saa" : "Hours"}</th><th>{locale === "sw" ? "Gharama" : "Cost"}</th></tr></thead><tbody>{data.machineJobs.map((job) => <tr key={job.id}><td>{dateLabel(job.performedAt, locale)}</td><td>{job.description}</td><td>{job.cropName || job.plotName || "—"}</td><td>{number(job.hours, locale, 2)}</td><td>{money(job.fuelCost + job.hireCost + job.maintenanceCost, job.currency, locale)}</td></tr>)}</tbody></table></div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Kazi za mashine zitaonekana hapa." : "Machinery jobs will appear here."} />}
      </section>}
    </div>
  );
}

function ReportsSection({
  actualByCycle,
  data,
  locale,
}: {
  actualByCycle: Map<string, ReturnType<typeof calculateActuals>>;
  data: DashboardData;
  locale: Locale;
}) {
  const t = (key: string) => translate(locale, key);
  const [cycleId, setCycleId] = useState(data.cycles[0]?.id ?? "");
  const [scenario, setScenario] = useState("EXPECTED");
  const cycle = data.cycles.find((item) => item.id === cycleId);
  const plan = cycle?.plans.find((item) => item.scenario === scenario);
  const actual = cycle ? actualByCycle.get(cycle.id) : null;
  const planNumbers = plan
    ? {
        areaAcres: plan.areaAcres,
        seedGrams: plan.seedGrams,
        seedsPerGram: plan.seedsPerGram,
        germinationRate: plan.germinationRate,
        survivalRate: plan.survivalRate,
        plantsPerAcre: plan.plantsPerAcre,
        yieldPerPlant: plan.yieldPerPlant,
        farmgatePrice: plan.farmgatePrice,
        lines: plan.lines,
      }
    : null;
  const totals = planNumbers ? calculatePlan(planNumbers) : null;
  const monthly = planNumbers
    ? buildMonthlyCashFlow(planNumbers, plan?.harvestMonth ?? null, cycle?.cropName)
    : [];
  const plannedCosts = planNumbers ? calculatePlannedCostsByCategory(planNumbers) : new Map<string, number>();
  const profitDriver = planNumbers && actual
    ? calculateProfitVarianceDriver(planNumbers, actual)
    : null;
  const costCategories = [...new Set([
    ...plannedCosts.keys(),
    ...(actual ? [...actual.costsByCategory.keys()] : []),
  ])].sort();
  const planValue = (value: number | null | undefined) =>
    value === null || value === undefined ? "" : String(value);
  const actualPrice =
    cycle && cycle.sales.reduce((sum, sale) => sum + sale.quantity, 0) > 0
      ? cycle.sales.reduce((sum, sale) => sum + sale.quantity * sale.price, 0) /
        cycle.sales.reduce((sum, sale) => sum + sale.quantity, 0)
      : null;
  const downloadPlan = () => {
    if (!cycle || !plan || !planNumbers || !actual) return;
    const csv = buildPlanCsv({
      cropName: cycle.cropName,
      plotName: cycle.plotName,
      currency: plan.currency,
      yieldUnit: plan.yieldUnit,
      plan: planNumbers,
      harvestMonth: plan.harvestMonth,
      actuals: actual,
    });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `shamba-plan-${cycle.cropName.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="dashboard-content">
      <SectionHeading
        eyebrow="CYCLE ECONOMICS"
        title={t("reports")}
        description={locale === "sw"
          ? "Panga uchumi wa zao, linganisha na gharama zilizorekodiwa na hifadhi ripoti ya kuchapisha."
          : "Build a crop economics plan, compare it with recorded actuals and print a shareable report."}
        action={<div className="button-row">
          <button className="button button-quiet" disabled={!plan || !actual} onClick={downloadPlan} type="button"><Download size={16} /> {locale === "sw" ? "Pakua CSV" : "Download CSV"}</button>
          {cycle && plan
            ? <a className="button button-quiet" href={`/api/reports/plan?cycleId=${encodeURIComponent(cycle.id)}&scenario=${encodeURIComponent(plan.scenario)}`}><Download size={16} /> {locale === "sw" ? "Pakua Excel" : "Download Excel"}</a>
            : <button className="button button-quiet" disabled type="button"><Download size={16} /> {locale === "sw" ? "Pakua Excel" : "Download Excel"}</button>}
          <button className="button button-quiet print-button" onClick={() => window.print()} type="button"><Printer size={16} /> {locale === "sw" ? "Chapisha / PDF" : "Print / PDF"}</button>
        </div>}
      />
      <div className="report-controls">
        <label className="field">
          <span>{locale === "sw" ? "Mzunguko wa zao" : "Crop cycle"}</span>
          <select onChange={(event) => setCycleId(event.target.value)} value={cycleId}>
            {data.cycles.map((item) => (
              <option key={item.id} value={item.id}>{`${item.cropName} · ${item.plotName}`}</option>
            ))}
          </select>
        </label>
        <div className="scenario-control">
          <span>{locale === "sw" ? "Hali ya mpango" : "Plan scenario"}</span>
          <div className="scenario-tabs">
            {[
              ["EXPECTED", locale === "sw" ? "Msingi" : "Expected"],
              ["LOW_PRICE", locale === "sw" ? "Bei ndogo" : "Low price"],
              ["LOW_YIELD", locale === "sw" ? "Mavuno kidogo" : "Low yield"],
            ].map(([value, label]) => (
              <button className={scenario === value ? "selected" : ""} key={value} onClick={() => setScenario(value!)} type="button">{label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="report-grid">
        <section className="panel form-panel plan-form-panel">
          <div className="panel-header"><div><h3>{cycle ? `${cycle.cropName} · ${locale === "sw" ? "mpango wa uchumi" : "economics plan"}` : (locale === "sw" ? "Mpango wa uchumi wa zao" : "Crop economics plan")}</h3><p>{locale === "sw" ? "Jaza takwimu zako zilizothibitishwa; visivyojulikana viache wazi." : "Enter your verified farm figures; leave unknown assumptions blank."}</p></div><FileSpreadsheet size={20} /></div>
          {cycle ? (
            <ActionForm action={savePlanAction} submitLabel={locale === "sw" ? "Hifadhi mpango" : "Save plan"} className="form-grid" key={`${cycle.id}-${scenario}-${plan?.id ?? "new"}`}>
              <input name="cycleId" type="hidden" value={cycle.id} />
              <input name="scenario" type="hidden" value={scenario} />
              <FormField label={locale === "sw" ? "Eneo la mpango (ekari)" : "Planned area (acres)"} name="areaAcres" type="number" min="0.0001" step="0.0001" defaultValue={plan?.areaAcres} required />
              <FormField label={locale === "sw" ? "Mbegu (gramu)" : "Seed quantity (grams)"} name="seedGrams" type="number" min="0" step="any" defaultValue={planValue(plan?.seedGrams)} />
              <FormField label={locale === "sw" ? "Mbegu kwa gramu" : "Seeds per gram"} name="seedsPerGram" type="number" min="0" step="any" defaultValue={planValue(plan?.seedsPerGram)} />
              <FormField label={locale === "sw" ? "Kiwango cha kuota (0 hadi 1)" : "Germination rate (0 to 1)"} name="germinationRate" type="number" min="0" max="1" step="0.0001" defaultValue={planValue(plan?.germinationRate)} />
              <FormField label={locale === "sw" ? "Kiwango cha kuishi (0 hadi 1)" : "Survival rate (0 to 1)"} name="survivalRate" type="number" min="0" max="1" step="0.0001" defaultValue={planValue(plan?.survivalRate)} />
              <FormField label={locale === "sw" ? "Mimea kwa ekari" : "Plants per acre"} name="plantsPerAcre" type="number" min="0" step="any" defaultValue={planValue(plan?.plantsPerAcre)} />
              <FormField label={locale === "sw" ? "Mavuno kwa mmea" : "Yield per plant"} name="yieldPerPlant" type="number" min="0" step="any" defaultValue={planValue(plan?.yieldPerPlant)} />
              <FormField label={locale === "sw" ? "Kipimo cha mavuno" : "Yield unit"} name="yieldUnit" defaultValue={plan?.yieldUnit ?? cycle.yieldUnit} required />
              <FormField label={locale === "sw" ? `Bei ya shambani (${data.farm.currency})` : `Farmgate price (${data.farm.currency} / unit)`} name="farmgatePrice" type="number" min="0" step="any" defaultValue={planValue(plan?.farmgatePrice)} />
              <FormField label={locale === "sw" ? "Mwezi wa mavuno (1–12)" : "Harvest month (1–12)"} name="harvestMonth" type="number" min="1" max="12" step="1" defaultValue={planValue(plan?.harvestMonth)} />
              <FormSelect
                label={locale === "sw" ? "Chanzo cha makadirio" : "Assumption source"}
                name="figureLabel"
                defaultValue={plan?.figureLabel ?? "PLACEHOLDER_BENCHMARK"}
                options={[
                  { value: "PLACEHOLDER_BENCHMARK", label: locale === "sw" ? "Kigezo cha muda" : "Placeholder benchmark" },
                  { value: "BENCHMARK", label: "Benchmark" },
                  { value: "LOCAL_QUOTE", label: locale === "sw" ? "Bei ya eneo" : "Local quote" },
                  { value: "YOUR_ACTUAL", label: locale === "sw" ? "Takwimu zako halisi" : "Your actual" },
                ]}
              />
              <FormTextArea label={locale === "sw" ? "Gharama zilizopangwa" : "Planned costs (one per line)"} name="costLines" rows={5} defaultValue={(plan?.lines ?? []).map((line) => `${line.category} | ${line.amount} | ${line.timingMonth ?? ""} | ${line.figureLabel}`).join("\n")} placeholder={"SEED | 0 | 1\nLAND_PREP | 0 | 1\nHARVEST | 0 | | LOCAL_QUOTE"} />
              <FormTextArea label={locale === "sw" ? "Maelezo ya mpango" : "Plan notes"} name="notes" defaultValue={plan?.notes ?? ""} />
              <p className="field-help field-wide">{locale === "sw" ? "Muundo: KATEGORIA | gharama yote au bei kwa kipimo | mwezi | lebo ya chanzo. HARVEST, PACKAGING na TRANSPORT ni bei kwa kipimo; gharama nyingine ni jumla. Rudia mstari kugawa gharama kwa miezi. Lebo: BENCHMARK, LOCAL_QUOTE au YOUR_ACTUAL." : "Format: CATEGORY | total cost or rate per yield unit | month | source label. HARVEST, PACKAGING and TRANSPORT are unit rates; other lines are total costs. Repeat a line to split costs across months. Labels: BENCHMARK, LOCAL_QUOTE or YOUR_ACTUAL."}</p>
            </ActionForm>
          ) : <EmptyState title={t("noData")} detail={locale === "sw" ? "Anzisha mzunguko wa zao kabla ya kupanga gharama." : "Start a crop cycle before creating its economics plan."} />}
        </section>
        <section className="panel form-panel actual-entry-panel">
          <div className="panel-header"><div><h3>{locale === "sw" ? "Rekodi mavuno halisi" : "Capture crop actuals"}</h3><p>{locale === "sw" ? "Mavuno na mauzo hujaza matokeo halisi." : "Harvests and sales feed the plan-vs-actual report."}</p></div><Wheat size={20} /></div>
          {cycle && <>
            <ActionForm action={recordHarvestAction} submitLabel={locale === "sw" ? "Hifadhi mavuno" : "Record harvest"} className="form-grid">
              <input name="cycleId" type="hidden" value={cycle.id} />
              <FormField label={locale === "sw" ? "Kiasi kilichovunwa" : "Harvest quantity"} name="quantity" type="number" min="0.0001" step="any" required />
              <FormField label={locale === "sw" ? "Kipimo" : "Unit"} name="unit" defaultValue={cycle.yieldUnit} required />
              <FormField label={locale === "sw" ? "Daraja" : "Grade"} name="grade" />
              <FormField label={locale === "sw" ? "Kiasi kilichopotea" : "Loss quantity"} name="lossQty" type="number" min="0" step="any" />
              <FormField label={locale === "sw" ? "Tarehe" : "Harvest date"} name="harvestedAt" type="date" />
              <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
            </ActionForm>
            <ActionForm action={recordSaleAction} submitLabel={locale === "sw" ? "Hifadhi mauzo" : "Record sale"} className="form-grid sale-form">
              <input name="cycleId" type="hidden" value={cycle.id} />
              <FormField label={locale === "sw" ? "Kiasi kilichouzwa" : "Quantity sold"} name="quantity" type="number" min="0.0001" step="any" required />
              <FormField label={locale === "sw" ? "Kipimo" : "Unit"} name="unit" defaultValue={cycle.yieldUnit} required />
              <FormField label={locale === "sw" ? `Bei kwa kipimo (${data.farm.currency})` : `Price per unit (${data.farm.currency})`} name="price" type="number" min="0" step="any" required />
              <FormField label={locale === "sw" ? "Mnunuzi" : "Buyer"} name="buyer" />
              <FormField label={locale === "sw" ? "Tarehe" : "Sale date"} name="soldAt" type="date" />
            </ActionForm>
          </>}
        </section>
      </div>

      <section className="panel plan-summary-panel printable-plan">
        <div className="panel-header"><div><div className="eyebrow">{locale === "sw" ? "MUHTASARI WA MPANGO" : "PLAN SUMMARY"}</div><h3>{cycle ? `${cycle.cropName} · ${cycle.plotName}` : (locale === "sw" ? "Chagua mzunguko" : "Select a crop cycle")}</h3><p>{cycle ? `${number(plan?.areaAcres ?? cycle.areaValue, locale, 2)} ${plan ? (locale === "sw" ? "ekari zilizopangwa" : "planned acres") : cycle.areaUnit} · ${plan ? titleCase(plan.scenario) : (locale === "sw" ? "Hakuna mpango uliohifadhiwa" : "No saved plan yet")}` : ""}</p></div><span className="benchmark-label"><span /> {t("placeholder")}</span></div>
        {!plan || !totals || !actual ? <EmptyState title={locale === "sw" ? "Mpango unasubiri takwimu zako" : "Plan awaits your figures"} detail={locale === "sw" ? "Hifadhi mpango wenye thamani zako ili kuona makadirio na kulinganisha na matokeo halisi." : "Save a plan with your farm's values to see projections and compare with recorded actuals."} /> : <>
          <div className="plan-kpi-grid">
            <PlanKpi label={locale === "sw" ? "Mimea iliyokusudiwa" : "Intended plants"} value={totals.intendedPlants === null ? "—" : number(totals.intendedPlants, locale, 0)} note={totals.survivingSeedlings === null ? (locale === "sw" ? "Mbegu na uhai hazijakamilika" : "Seed/survival assumptions incomplete") : `${number(totals.plantsForYield ?? 0, locale, 0)} ${locale === "sw" ? "zinaotabiriwa" : "yielding plants"}`} />
            <PlanKpi label={locale === "sw" ? "Mavuno yaliyopangwa" : "Projected yield"} value={totals.projectedYield === null ? "—" : `${number(totals.projectedYield, locale)} ${plan.yieldUnit}`} note={locale === "sw" ? "Kutokana na mimea na mavuno kwa mmea" : "From planned plants × yield per plant"} />
            <PlanKpi label={locale === "sw" ? "Mapato yaliyopangwa" : "Projected revenue"} value={totals.projectedRevenue === null ? "—" : money(totals.projectedRevenue, plan.currency, locale)} note={plan.farmgatePrice === null ? (locale === "sw" ? "Bei haijawekwa" : "Price not entered") : `${money(plan.farmgatePrice, plan.currency, locale)} / ${plan.yieldUnit}`} />
            <PlanKpi label={locale === "sw" ? "Faida iliyopangwa" : "Projected profit"} value={totals.projectedProfit === null ? "—" : money(totals.projectedProfit, plan.currency, locale)} note={`${locale === "sw" ? "Gharama" : "Planned cost"} ${totals.totalCost === null ? "—" : money(totals.totalCost, plan.currency, locale)}`} />
          </div>
          <div className="report-grid report-grid-lower">
            <div className="report-table-block"><h4>{locale === "sw" ? "Mpango dhidi ya halisi" : "Plan vs actual"}</h4><div className="table-scroll"><table><thead><tr><th>{locale === "sw" ? "Kipengele" : "Line item"}</th><th>{locale === "sw" ? "Mpango" : "Plan"}</th><th>{locale === "sw" ? "Halisi" : "Actual"}</th><th>{locale === "sw" ? "Tofauti" : "Variance"}</th></tr></thead><tbody>
              {costCategories.map((category) => { const planned = plannedCosts.get(category) ?? 0; const actualCost = actual.costsByCategory.get(category) ?? 0; return <tr key={category}><td>{titleCase(category)}</td><td>{money(planned, plan.currency, locale)}</td><td>{money(actualCost, plan.currency, locale)}</td><td className={actualCost > planned ? "variance-negative" : "variance-positive"}>{money(actualCost - planned, plan.currency, locale)}</td></tr>; })}
              <tr className="total-row"><td>{locale === "sw" ? "Jumla ya gharama" : "Total cost"}</td><td>{totals.totalCost === null ? "—" : money(totals.totalCost, plan.currency, locale)}</td><td>{money(actual.totalCost, plan.currency, locale)}</td><td>{totals.totalCost === null ? "—" : money(actual.totalCost - totals.totalCost, plan.currency, locale)}</td></tr>
              <tr><td>{locale === "sw" ? "Mavuno" : "Harvested yield"}</td><td>{totals.projectedYield === null ? "—" : `${number(totals.projectedYield, locale)} ${plan.yieldUnit}`}</td><td>{number(actual.harvestedQuantity, locale)} {plan.yieldUnit}</td><td>{totals.projectedYield === null ? "—" : `${number(actual.harvestedQuantity - totals.projectedYield, locale)} ${plan.yieldUnit}`}</td></tr>
              <tr><td>{locale === "sw" ? "Mapato" : "Sales revenue"}</td><td>{totals.projectedRevenue === null ? "—" : money(totals.projectedRevenue, plan.currency, locale)}</td><td>{money(actual.revenue, plan.currency, locale)}</td><td>{totals.projectedRevenue === null ? "—" : money(actual.revenue - totals.projectedRevenue, plan.currency, locale)}</td></tr>
              <tr className="total-row"><td>{locale === "sw" ? "Faida / hasara" : "Profit / loss"}</td><td>{totals.projectedProfit === null ? "—" : money(totals.projectedProfit, plan.currency, locale)}</td><td>{money(actual.profit, plan.currency, locale)}</td><td>{totals.projectedProfit === null ? "—" : money(actual.profit - totals.projectedProfit, plan.currency, locale)}</td></tr>
              {actualPrice !== null && <tr><td>{locale === "sw" ? "Bei halisi ya mauzo" : "Realized sale price"}</td><td>{plan.farmgatePrice === null ? "—" : money(plan.farmgatePrice, plan.currency, locale)}</td><td>{money(actualPrice, plan.currency, locale)} / {plan.yieldUnit}</td><td>{plan.farmgatePrice === null ? "—" : money(actualPrice - plan.farmgatePrice, plan.currency, locale)}</td></tr>}
            </tbody></table></div></div>
            <div className="report-table-block"><h4>{locale === "sw" ? "Mtiririko wa fedha kwa miezi ya mzunguko" : "Cash flow by cycle month"}</h4><div className="table-scroll"><table><thead><tr><th>{locale === "sw" ? "Mwezi wa mzunguko" : "Cycle month"}</th><th>{locale === "sw" ? "Gharama" : "Costs"}</th><th>{locale === "sw" ? "Mapato" : "Income"}</th><th>{locale === "sw" ? "Salio" : "Net"}</th></tr></thead><tbody>{monthly.map((month) => <tr key={month.month}><td>{locale === "sw" ? `Mwezi ${month.month}` : `Month ${month.month}`}</td><td>{month.cost ? money(month.cost, plan.currency, locale) : "—"}</td><td>{month.revenue ? money(month.revenue, plan.currency, locale) : "—"}</td><td className={month.net < 0 ? "variance-negative" : ""}>{month.net ? money(month.net, plan.currency, locale) : "—"}</td></tr>)}</tbody></table></div>
              <div className="break-even-box"><span>{locale === "sw" ? "Bei ya kuvunja hasara" : "Break-even price"}</span><strong>{totals.breakEvenPrice === null ? "—" : `${money(totals.breakEvenPrice, plan.currency, locale)} / ${plan.yieldUnit}`}</strong><span>{locale === "sw" ? "Gharama kwa kipimo" : "Cost per unit"}</span><strong>{totals.costPerUnit === null ? "—" : `${money(totals.costPerUnit, plan.currency, locale)} / ${plan.yieldUnit}`}</strong></div>
            </div>
          </div>
          {profitDriver && <p className="field-help" role="status">
            {locale === "sw" ? "Sababu kuu inayokadiriwa ya tofauti ya faida" : "Largest estimated profit-variance driver"}: {titleCase(profitDriver.label)} ({money(profitDriver.impact, plan.currency, locale)})
          </p>}
          <div className="plan-disclaimer"><ShieldCheck size={16} /><span>{locale === "sw" ? "Mpango ni makadirio yanayotegemea taarifa za mtumiaji, si ushauri wa kifedha. Thamani zote zilizowekwa zinalindwa kwa lebo ya makadirio hadi zithibitishwe." : "This is an estimate from user-entered figures, not financial advice. Values are marked placeholder benchmarks until verified; review all assumptions before making decisions."}</span></div>
        </>}
      </section>
      <FileAttachments
        attachments={data.attachments}
        targets={[
          ...data.holdings.map((record) => ({ id: record.id, type: "holding", label: `${locale === "sw" ? "Umiliki" : "Holding"} · ${record.name}` })),
          ...data.plots.map((record) => ({ id: record.id, type: "plot", label: `${locale === "sw" ? "Kitalu" : "Plot"} · ${record.name}` })),
          ...data.cropTypes.map((record) => ({ id: record.id, type: "cropType", label: `${locale === "sw" ? "Zao" : "Crop"} · ${record.name}` })),
          ...data.cycles.map((record) => ({ id: record.id, type: "cycle", label: `${locale === "sw" ? "Mzunguko" : "Cycle"} · ${record.cropName} · ${record.plotName}` })),
          ...data.tasks.map((record) => ({ id: record.id, type: "task", label: `${locale === "sw" ? "Kazi" : "Task"} · ${locale === "sw" ? record.titleSw : record.titleEn}` })),
        ]}
        locale={locale}
      />
    </div>
  );
}

function PlanKpi({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="plan-kpi"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function SettingsSection({
  data,
  locale,
  isOwner,
}: {
  data: DashboardData;
  locale: Locale;
  isOwner: boolean;
}) {
  const t = (key: string) => translate(locale, key);
  const latestConsent = data.consents.find((consent) => consent.purpose === "anonymised_farm_benchmarks");
  return (
    <div className="dashboard-content">
      <SectionHeading eyebrow="WORKSPACE & PRIVACY" title={t("settings")} description={locale === "sw" ? "Dhibiti maelezo ya shamba, majukumu na data zako." : "Manage farm details, roles, language and your data choices."} />
      <div className="two-panel-grid">
        {data.memberships.length > 1 && <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Badili eneo la shamba" : "Switch farm workspace"}</h3><p>{locale === "sw" ? "Chagua eneo lingine unaloweza kusimamia." : "Choose another workspace you have access to."}</p></div><Building2 size={20} /></div>
          <ActionForm action={switchWorkspaceAction} submitLabel={locale === "sw" ? "Badili shamba" : "Switch farm"} className="form-grid">
            <FormSelect label={locale === "sw" ? "Chagua shamba" : "Choose workspace"} name="farmId" defaultValue={data.farm.id} options={data.memberships.map((member) => ({ value: member.farm.id, label: member.farm.name }))} />
          </ActionForm>
        </section>}
        {isOwner && <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Maelezo ya shamba" : "Farm details"}</h3><p>{locale === "sw" ? "Mipangilio huonekana kwa wanachama wa shamba." : "Workspace settings are visible to farm members."}</p></div><Settings2 size={20} /></div>
          <ActionForm action={updateFarmSettingsAction} submitLabel={locale === "sw" ? "Hifadhi mabadiliko" : "Save changes"} className="form-grid">
            <FormField label={locale === "sw" ? "Jina la shamba" : "Farm name"} name="name" defaultValue={data.farm.name} required />
            <FormField label={locale === "sw" ? "Mkoa" : "Region"} name="region" defaultValue={data.farm.region ?? ""} />
            <FormField label={locale === "sw" ? "Wilaya" : "District"} name="district" defaultValue={data.farm.district ?? ""} />
            <FormField label={locale === "sw" ? "Ukubwa wa shamba" : "Farm size"} name="totalAreaValue" type="number" min="0.0001" step="any" defaultValue={data.farm.totalAreaValue?.toString() ?? ""} />
            <FormSelect label={locale === "sw" ? "Kipimo cha ukubwa wa shamba" : "Farm size unit"} name="totalAreaUnit" defaultValue={data.farm.totalAreaUnit} options={[{ value: "acre", label: locale === "sw" ? "Ekari" : "Acres" }, { value: "hectare", label: locale === "sw" ? "Hekta" : "Hectares" }]} />
            <FormSelect label={locale === "sw" ? "Sarafu" : "Currency"} name="currency" defaultValue={data.farm.currency} options={[{ value: "TZS", label: "TZS" }, { value: "USD", label: "USD" }]} />
            <FormSelect label={locale === "sw" ? "Kipimo cha eneo" : "Default area unit"} name="areaUnit" defaultValue={data.farm.areaUnit} options={[{ value: "acre", label: locale === "sw" ? "Ekari" : "Acre" }, { value: "hectare", label: locale === "sw" ? "Hekta" : "Hectare" }, { value: "square metre", label: locale === "sw" ? "Mita ya mraba" : "Square metre" }]} />
            <FormField label={locale === "sw" ? "Saa za eneo (timezone)" : "Timezone"} name="timezone" defaultValue={data.farm.timezone} required />
            <FormField label={locale === "sw" ? "Namba ya mkulima ya taifa (si lazima)" : "National farmer ID (optional)"} name="nationalFarmerId" defaultValue={data.farm.nationalFarmerId ?? ""} />
          </ActionForm>
        </section>}
        {isOwner && <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Fungua eneo jingine la shamba" : "Create another farm workspace"}</h3><p>{locale === "sw" ? "Akaunti moja inaweza kuwa na maeneo mengi." : "One account can own more than one farm workspace."}</p></div><Plus size={20} /></div>
          <ActionForm action={createWorkspaceAction} submitLabel={t("createWorkspace")} className="form-grid">
            <FormField label={locale === "sw" ? "Jina la shamba" : "Farm name"} name="name" required />
            <FormField label={locale === "sw" ? "Mkoa" : "Region"} name="region" />
            <FormField label={locale === "sw" ? "Wilaya" : "District"} name="district" />
            <FormField label={locale === "sw" ? "Ukubwa wa shamba" : "Farm size (optional)"} name="totalAreaValue" type="number" min="0.0001" step="any" />
            <FormSelect label={locale === "sw" ? "Kipimo cha ukubwa wa shamba" : "Farm size unit"} name="totalAreaUnit" defaultValue="acre" options={[{ value: "acre", label: locale === "sw" ? "Ekari" : "Acres" }, { value: "hectare", label: locale === "sw" ? "Hekta" : "Hectares" }]} />
            <FormSelect label={locale === "sw" ? "Sarafu" : "Currency"} name="currency" options={[{ value: "TZS", label: "TZS" }, { value: "USD", label: "USD" }]} />
            <FormSelect label={locale === "sw" ? "Kipimo cha eneo" : "Default area unit"} name="areaUnit" options={[{ value: "acre", label: locale === "sw" ? "Ekari" : "Acre" }, { value: "hectare", label: locale === "sw" ? "Hekta" : "Hectare" }, { value: "square metre", label: locale === "sw" ? "Mita ya mraba" : "Square metre" }]} />
            <FormField label={locale === "sw" ? "Saa za eneo (timezone)" : "Timezone"} name="timezone" defaultValue="Africa/Dar_es_Salaam" required />
          </ActionForm>
        </section>}
        {isOwner && <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Alika msimamizi wa shamba" : "Invite a farm manager"}</h3><p>{t("managerInviteHelp")}</p></div><Users size={20} /></div>
          <ManagerInviteForm locale={locale} />
        </section>}
        <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Kushiriki takwimu za shamba" : "Optional farm benchmark sharing"}</h3><p>{locale === "sw" ? "Chaguo hili halihitajiki kwa kutumia mfumo." : "This choice is optional and does not affect use of the platform."}</p></div><ShieldCheck size={20} /></div>
          <div className="consent-current"><span className={`consent-dot ${latestConsent?.granted ? "granted" : ""}`} /><div><strong>{latestConsent?.granted ? (locale === "sw" ? "Umeruhusu kushiriki" : "Sharing allowed") : latestConsent ? (locale === "sw" ? "Huruhusu kushiriki" : "Sharing withdrawn") : (locale === "sw" ? "Hakuna ridhaa iliyotolewa" : "No sharing consent given")}</strong><span>{latestConsent ? `${locale === "sw" ? "Ilirekodiwa" : "Recorded"} ${dateLabel(latestConsent.recordedAt, locale)}` : (locale === "sw" ? "Takwimu zako hazitumiki kuboresha viwango vya mfumo." : "Your actuals are not used to improve platform benchmarks.")}</span></div></div>
          <p className="field-help">{locale === "sw" ? "Ukiamua kuruhusu baadaye, ni takwimu zisizotambulisha mtu tu ndizo zinaweza kutumika. Ridhaa inaweza kuondolewa." : "If enabled, only anonymised farm data may inform future benchmarks. You can withdraw permission at any time."}</p>
          <ActionForm action={recordBenchmarkConsentAction} submitLabel={locale === "sw" ? "Hifadhi chaguo" : "Save sharing choice"} className="form-grid">
            <FormSelect label={locale === "sw" ? "Chaguo" : "Choice"} name="choice" options={[{ value: "grant", label: locale === "sw" ? "Ninaruhusu matumizi ya takwimu zisizotambulisha" : "Allow anonymised benchmark use" }, { value: "withdraw", label: locale === "sw" ? "Ondoa ruhusa ya matumizi" : "Withdraw permission" }]} />
          </ActionForm>
        </section>
      </div>

      {isOwner && <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Rekodi pembejeo za ruzuku" : "Record subsidised inputs"}</h3><p>{locale === "sw" ? "Taarifa ni za hiari; usiweke namba za utambulisho hapa." : "Optional input receipt record; do not enter identity numbers here."}</p></div><Package size={20} /></div>
        <ActionForm action={recordSubsidyReceiptAction} submitLabel={t("save")} className="form-grid">
          <FormField label={locale === "sw" ? "Pembejeo" : "Input"} name="input" required />
          <FormField label={locale === "sw" ? "Kiasi" : "Quantity"} name="quantity" type="number" min="0.0001" step="any" required />
          <FormField label={locale === "sw" ? "Kipimo" : "Unit"} name="unit" placeholder="kg, bag, litre" required />
          <FormField label={locale === "sw" ? `Bei halisi (${data.farm.currency})` : `Actual price (${data.farm.currency})`} name="price" type="number" min="0" step="0.01" />
          <FormField label={locale === "sw" ? "Chanzo cha ruzuku" : "Subsidy source"} name="source" />
          <FormField label={locale === "sw" ? "Tarehe ya kupokea" : "Received date"} name="receivedAt" type="date" />
          <FormTextArea label={locale === "sw" ? "Maelezo" : "Notes"} name="notes" />
        </ActionForm>
        {data.subsidies.length > 0 && <div className="recent-list">{data.subsidies.slice(0, 10).map((receipt) => <article className="recent-item" key={receipt.id}><span className="recent-dot" /><div><p><strong>{receipt.input}</strong> · {number(receipt.quantity, locale, 2)} {receipt.unit}</p><span>{dateLabel(receipt.receivedAt, locale)}{receipt.source ? ` · ${receipt.source}` : ""}{receipt.price === null ? "" : ` · ${money(receipt.price, receipt.currency, locale)}`}</span></div></article>)}</div>}
      </section>}

      {isOwner && <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Wanachama wa shamba" : "Farm members"}</h3><p>{data.members.length} {locale === "sw" ? "wanachama" : "members"}</p></div></div>
        {data.members.length ? <div className="table-scroll"><table><thead><tr><th>{locale === "sw" ? "Jina" : "Name"}</th><th>{locale === "sw" ? "Barua pepe" : "Email"}</th><th>{locale === "sw" ? "Jukumu" : "Role"}</th></tr></thead><tbody>{data.members.map((member) => <tr key={member.id}><td>{member.name}</td><td>{member.email}</td><td><span className="status-pill">{member.role === "OWNER" ? t("owner") : t("manager")}</span></td></tr>)}</tbody></table></div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Wanachama wa shamba wataonekana hapa." : "Farm members will appear here."} />}
      </section>}

      <div className="two-panel-grid">
        <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Data yako" : "Your farm data"}</h3><p>{locale === "sw" ? "Omba nakala ya data au kufutwa kwa data." : "Request a copy or ask for deletion review."}</p></div><Download size={20} /></div>
          {isOwner && <ActionForm action={requestDataAction} submitLabel={locale === "sw" ? "Rekodi ombi" : "Record request"} className="form-grid">
            <FormSelect label={locale === "sw" ? "Ombi" : "Request"} name="type" options={[{ value: "EXPORT", label: locale === "sw" ? "Kuomba nakala" : "Export a copy" }, { value: "DELETION", label: locale === "sw" ? "Kuomba kufutwa (ukaguzi unahitajika)" : "Request deletion (review required)" }]} />
            <FormSelect label={locale === "sw" ? "Wigo wa ombi la kufuta" : "Deletion request scope"} name="scope" required={false} options={[{ value: "FARM", label: locale === "sw" ? "Data yote ya shamba" : "All farm data" }, { value: "PERSON", label: locale === "sw" ? "Data ya mtu mmoja" : "One person's data" }]} />
            <FormSelect label={locale === "sw" ? "Mwanachama (kwa ombi la mtu)" : "Person (for person-data request)"} name="subjectUserId" required={false} options={data.members.map((member) => ({ value: member.userId, label: `${member.name} · ${member.email}` }))} />
          </ActionForm>}
          {data.dataRequests.some((request) => request.type === "EXPORT" && request.status === "REQUESTED") && <div className="export-link">
            <a className="button button-quiet" href="/api/data/export?format=json"><Download size={16} /> {locale === "sw" ? "Pakua JSON" : "Download JSON"}</a>
            <a className="button button-quiet" href="/api/data/export?format=csv"><Download size={16} /> {locale === "sw" ? "Pakua CSV" : "Download CSV"}</a>
          </div>}
          <p className="field-help">{locale === "sw" ? "Ombi la kufuta haliondoi taarifa moja kwa moja; litapitiwa kwanza." : "Deletion is a request for review, not an immediate destructive action."}</p>
          {data.dataRequests.length > 0 && <div className="data-request-list">{data.dataRequests.slice(0, 5).map((request) => <div className="data-request-row" key={request.id}><span>{titleCase([request.type, request.scope].filter(Boolean).join("_"))}{request.subject ? ` · ${request.subject}` : ""}</span><span>{titleCase(request.status)}</span><time>{dateLabel(request.requestedAt, locale)}</time></div>)}</div>}
        </section>
        <section className="panel form-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Taarifa za akaunti" : "Account profile"}</h3><p>{locale === "sw" ? "Mmiliki wa akaunti na eneo linalotumika." : "Signed-in person and active workspace."}</p></div><BadgeCheck size={20} /></div>
          <div className="profile-detail"><span className="profile-avatar">{initials(data.user.name)}</span><div><strong>{data.user.name}</strong><span>{data.user.email}</span></div></div>
          <div className="detail-row"><span>{locale === "sw" ? "Jukumu kwenye shamba hili" : "Role in this farm"}</span><strong>{isOwner ? t("owner") : t("manager")}</strong></div>
          <div className="detail-row"><span>{locale === "sw" ? "Sarafu ya shamba" : "Farm currency"}</span><strong>{data.farm.currency}</strong></div>
          <div className="detail-row"><span>{locale === "sw" ? "Lugha ya kiolesura" : "Interface language"}</span><strong>{locale === "sw" ? "Kiswahili" : "English"}</strong></div>
        </section>
      </div>
      {isOwner && <section className="panel data-panel"><div className="panel-header"><div><h3>{locale === "sw" ? "Rekodi ya ukaguzi" : "Farm audit log"}</h3><p>{locale === "sw" ? "Mabadiliko ya hivi karibuni kwenye rekodi za shamba." : "Recent record changes, with actor and time."}</p></div><ShieldCheck size={20} /></div>
        {data.auditLog.length ? <div className="table-scroll"><table><thead><tr><th>{locale === "sw" ? "Nani" : "Who"}</th><th>{locale === "sw" ? "Kitendo" : "Action"}</th><th>{locale === "sw" ? "Rekodi" : "Record type"}</th><th>{locale === "sw" ? "Muda" : "When"}</th></tr></thead><tbody>{data.auditLog.map((entry) => <tr key={entry.id}><td>{entry.actorName}</td><td>{titleCase(entry.action)}</td><td>{entry.entity}{entry.recordId ? ` · ${entry.recordId.slice(0, 8)}` : ""}</td><td>{dateLabel(entry.occurredAt, locale)}</td></tr>)}</tbody></table></div> : <EmptyState title={t("noData")} detail={locale === "sw" ? "Mabadiliko ya rekodi yataonekana hapa." : "Audited farm record changes will appear here."} />}
      </section>}
    </div>
  );
}
