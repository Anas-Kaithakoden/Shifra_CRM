import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CalendarCheck2,
  CalendarClock,
  FileText,
  FolderKanban,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  UserRound,
  Users,
  UserX,
  Wallet,
} from "lucide-react";
import {
  PIPELINE_STAGE_LABELS,
  type LeadSource,
} from "../../shared/constants/leads";
import type { LeadDashboardStatsDto } from "../../shared/types/leads";
import type { Role } from "../../shared/types/roles";
import { ROLE_LABELS } from "../../shared/types/roles";
import { UPCOMING_MODULES } from "../../shared/constants/modules";
import { PERMISSIONS } from "../../shared/types/permissions";
import { useAuth } from "../hooks/useAuth";
import { dashboardService } from "../services/dashboard.service";
import { hasPermission } from "../lib/permissions";
import {
  firstName,
  formatCrmDate,
  formatCrmDateTime,
  formatCurrencyInr,
  greeting,
  isPastDateTime,
  longDate,
} from "../lib/format";
import {
  ActivityList,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
} from "../components/ui";
import { StageBadge } from "../components/leads";
import {
  CustomerStatusBadge,
  CustomerTimeline,
  CustomerTypeBadge,
} from "../components/customers";

const ROLE_ORDER: Role[] = ["owner", "admin", "employee"];

const UPCOMING_ICONS: Record<string, typeof Target> = {
  projects: FolderKanban,
  tasks: Briefcase,
  payments: Wallet,
  documents: FileText,
  reports: BarChart3,
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

function FollowUpMiniList({
  title,
  description,
  items,
  tone,
}: {
  title: string;
  description: string;
  items: LeadDashboardStatsDto["followUps"]["dueToday"];
  tone: "warning" | "danger";
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <Badge variant={tone}>{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
          Nothing here right now.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((followUp) => (
            <li key={followUp.id}>
              <Link
                to={`/leads/${followUp.leadId}`}
                className="block rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {followUp.leadName ?? followUp.title}
                  </p>
                  <span
                    className={
                      isPastDateTime(followUp.scheduledAt)
                        ? "shrink-0 text-[11px] font-medium text-rose-600"
                        : "shrink-0 text-[11px] font-medium text-slate-500"
                    }
                  >
                    {formatCrmDateTime(followUp.scheduledAt)}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-500">
                  {followUp.title}
                  {followUp.assignedToName
                    ? ` · ${followUp.assignedToName}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => dashboardService.stats(),
  });

  if (!user) {
    return null;
  }

  if (statsQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (statsQuery.isError || !statsQuery.data) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        message="We could not load your dashboard statistics."
        onRetry={() => {
          void statsQuery.refetch();
        }}
      />
    );
  }

  const stats = statsQuery.data;
  const leads = stats.leadStats;
  const customers = stats.customerStats;
  const canCreateEmployees = hasPermission(user, PERMISSIONS.USERS_CREATE);
  const canCreateLeads = hasPermission(user, PERMISSIONS.LEADS_CREATE);
  const canViewAudit = hasPermission(user, PERMISSIONS.AUDIT_READ);
  const canManageSettings = hasPermission(user, PERMISSIONS.SETTINGS_MANAGE);
  const canViewCustomers = hasPermission(user, PERMISSIONS.CUSTOMERS_READ);

  const maxRoleCount = Math.max(
    1,
    ...ROLE_ORDER.map((role) => stats.employees.byRole[role]),
  );
  const maxPipelineCount = Math.max(
    1,
    ...leads.pipeline.map((row) => row.count),
  );
  const maxSourceCount = Math.max(
    1,
    ...leads.sources.map((row) => row.count),
  );
  const maxCustomerGrowth = Math.max(
    1,
    ...customers.monthlyGrowth.map((row) => row.count),
  );
  const customerTotal = Math.max(customers.counts.total, 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${firstName(user.fullName)}`}
        description={`${longDate()} · Here is a snapshot of your ${
          leads.scope === "personal" ? "lead book" : "organization"
        }.`}
        actions={
          <>
            <Link to="/leads">
              <Button
                leftIcon={<Target className="h-4 w-4" aria-hidden="true" />}
              >
                {canCreateLeads ? "Manage leads" : "View leads"}
              </Button>
            </Link>
            {canViewCustomers ? (
              <Link to="/customers">
                <Button
                  variant="outline"
                  leftIcon={<Users className="h-4 w-4" aria-hidden="true" />}
                >
                  Customers
                </Button>
              </Link>
            ) : null}
            <Link to="/follow-ups">
              <Button
                variant="outline"
                leftIcon={
                  <CalendarClock className="h-4 w-4" aria-hidden="true" />
                }
              >
                Follow-ups
              </Button>
            </Link>
            {canViewAudit ? (
              <Link to="/audit-logs">
                <Button
                  variant="outline"
                  leftIcon={
                    <ScrollText className="h-4 w-4" aria-hidden="true" />
                  }
                >
                  Audit logs
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <section aria-labelledby="lead-snapshot-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="lead-snapshot-heading"
              className="text-sm font-semibold text-slate-900"
            >
              Lead snapshot
            </h2>
            <p className="text-xs text-slate-500">
              {leads.scope === "personal"
                ? "Leads assigned to you or created by you."
                : "Live pipeline across the whole organization."}
            </p>
          </div>
          <Badge variant="brand">
            {leads.scope === "personal" ? "Personal" : "Organization"}
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total leads"
            value={leads.counts.total}
            icon={<Target className="h-4 w-4" aria-hidden="true" />}
            hint={`${leads.counts.notContacted} not contacted · ${leads.counts.contacted} contacted`}
          />
          <StatCard
            label="Won leads"
            value={leads.counts.won}
            icon={<Trophy className="h-4 w-4" aria-hidden="true" />}
            hint={`${formatCurrencyInr(leads.conversion.wonValue)} closed value`}
          />
          <StatCard
            label="Follow-ups due today"
            value={leads.counts.dueTodayFollowUps}
            icon={<CalendarCheck2 className="h-4 w-4" aria-hidden="true" />}
            hint="Scheduled for today in Asia/Kolkata"
          />
          <StatCard
            label="Overdue follow-ups"
            value={leads.counts.overdueFollowUps}
            icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
            hint="Past their scheduled time"
          />
        </div>
      </section>

      {canViewCustomers ? (
        <section aria-labelledby="customer-snapshot-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2
                id="customer-snapshot-heading"
                className="text-sm font-semibold text-slate-900"
              >
                Customer snapshot
              </h2>
              <p className="text-xs text-slate-500">
                {customers.scope === "personal"
                  ? "Customers assigned to you or created by you."
                  : "Customer accounts across the whole organization."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="brand">
                {customers.scope === "personal" ? "Personal" : "Organization"}
              </Badge>
              <Link
                to="/customers"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                All customers
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total customers"
              value={customers.counts.total}
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              hint={`${customers.counts.business} business · ${customers.counts.individual} individual`}
            />
            <StatCard
              label="Active customers"
              value={customers.counts.active}
              icon={<UserCheck className="h-4 w-4" aria-hidden="true" />}
              hint={`${customers.counts.archived} archived records`}
            />
            <StatCard
              label="Inactive customers"
              value={customers.counts.inactive}
              icon={<UserX className="h-4 w-4" aria-hidden="true" />}
              hint="Available for re-engagement"
            />
            <StatCard
              label="New this month"
              value={customers.counts.newThisMonth}
              icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
              hint="New customer records created this month"
            />
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Customer growth"
                description="New customers added over the last six months."
              />
              <CardBody className="space-y-3">
                {customers.monthlyGrowth.map((row) => (
                  <div key={row.month}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-slate-700">
                        {row.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {row.count} new
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{
                          width: `${Math.round(
                            (row.count / maxCustomerGrowth) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Customer mix"
                description="Business and individual accounts."
              />
              <CardBody className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                      <Building2 className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                      Business
                    </span>
                    <span className="text-slate-500">
                      {customers.counts.business} ·{" "}
                      {Math.round((customers.counts.business / customerTotal) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{
                        width: `${Math.round(
                          (customers.counts.business / customerTotal) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                      <UserRound className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
                      Individual
                    </span>
                    <span className="text-slate-500">
                      {customers.counts.individual} ·{" "}
                      {Math.round((customers.counts.individual / customerTotal) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-sky-500"
                      style={{
                        width: `${Math.round(
                          (customers.counts.individual / customerTotal) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {customers.counts.active}
                  </span>{" "}
                  active of {customers.counts.total} customer records.
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Recently added customers"
                description="The latest five customer records in your scope."
                action={
                  <Link
                    to="/customers"
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                  >
                    View all
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                }
              />
              <CardBody className="p-0">
                {customers.recentCustomers.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-slate-500">
                    No customer records yet. Won leads can be converted from the
                    lead page.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {customers.recentCustomers.slice(0, 5).map((customer) => (
                      <li key={customer.id}>
                        <Link
                          to={`/customers/${customer.id}`}
                          className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {customer.businessName ?? customer.name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                              <span>{customer.customerNumber}</span>
                              <span className="text-slate-300">·</span>
                              <span>{customer.assignedToName ?? "Unassigned"}</span>
                              <span className="text-slate-300">·</span>
                              <span>{formatCrmDate(customer.createdAt)}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                            <CustomerTypeBadge type={customer.type} />
                            <CustomerStatusBadge status={customer.status} />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Recent customer activity"
                description="Notes, interactions and record changes."
              />
              <CardBody>
                {customers.recentActivity.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                    Customer activity will appear once records are added or
                    updated.
                  </p>
                ) : (
                  <CustomerTimeline
                    activities={customers.recentActivity.slice(0, 4)}
                  />
                )}
              </CardBody>
            </Card>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Pipeline overview"
            description={`${leads.conversion.open} open · ${leads.conversion.won} won · ${leads.conversion.lost} lost`}
            action={
              <Link
                to="/leads/pipeline"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                Open board
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            }
          />
          <CardBody className="space-y-3">
            {leads.pipeline.map((row) => (
              <div key={row.stage}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-700">
                    {PIPELINE_STAGE_LABELS[row.stage]}
                  </span>
                  <span className="text-xs text-slate-500">
                    {row.count} · {formatCurrencyInr(row.estimatedValue)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={
                      row.stage === "won"
                        ? "h-full rounded-full bg-emerald-500"
                        : row.stage === "lost"
                          ? "h-full rounded-full bg-rose-400"
                          : "h-full rounded-full bg-brand-500"
                    }
                    style={{
                      width: `${Math.round((row.count / maxPipelineCount) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                <span className="font-semibold text-slate-800">
                  {leads.conversion.conversionRate}%
                </span>
                win rate of closed leads
              </span>
              <span className="text-slate-300">·</span>
              <span>
                <span className="font-semibold text-slate-800">
                  {formatCurrencyInr(leads.conversion.wonValue)}
                </span>{" "}
                won value
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Follow-ups"
            description="Today and overdue."
            action={
              <Link
                to="/follow-ups"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                View all
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            }
          />
          <CardBody className="space-y-5">
            <FollowUpMiniList
              title="Due today"
              description="Keep today's conversations on track."
              items={leads.followUps.dueToday}
              tone="warning"
            />
            <FollowUpMiniList
              title="Overdue"
              description="Catch up on these first."
              items={leads.followUps.overdue}
              tone="danger"
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent leads"
            description="The latest enquiries captured."
            action={
              <Link
                to="/leads"
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                All leads
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            }
          />
          <CardBody className="p-0">
            {leads.recentLeads.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No leads captured yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {canCreateLeads
                    ? "Add your first enquiry to start tracking the pipeline."
                    : "Leads assigned to you will appear here."}
                </p>
                {canCreateLeads ? (
                  <Link to="/leads" className="mt-3 inline-block">
                    <Button
                      size="sm"
                      leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                    >
                      Add lead
                    </Button>
                  </Link>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {leads.recentLeads.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      to={`/leads/${lead.id}`}
                      className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {lead.name}
                          {lead.businessName ? (
                            <span className="font-normal text-slate-400">
                              {" "}
                              · {lead.businessName}
                            </span>
                          ) : null}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span>{lead.leadNumber}</span>
                          <span className="text-slate-300">·</span>
                          <span>{lead.assignedToName ?? "Unassigned"}</span>
                          <span className="text-slate-300">·</span>
                          <span>{formatCrmDate(lead.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StageBadge stage={lead.pipelineStage} />
                        <span className="text-xs font-medium text-slate-600">
                          {formatCurrencyInr(lead.estimatedValue)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Lead sources"
            description="Where enquiries come from."
          />
          <CardBody className="space-y-3">
            {leads.sources.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                Source performance appears once leads are captured.
              </p>
            ) : (
              leads.sources.map((row: { source: LeadSource; count: number; won: number }) => (
                <div key={row.source}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-700">
                      {row.source}
                    </span>
                    <span className="text-slate-500">
                      {row.count} lead{row.count === 1 ? "" : "s"} · {row.won} won
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-400"
                      style={{
                        width: `${Math.round((row.count / maxSourceCount) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <section aria-labelledby="team-heading">
        <div className="mb-3">
          <h2
            id="team-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Team
          </h2>
          <p className="text-xs text-slate-500">
            Account access is managed separately from leads.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total employees"
            value={stats.employees.total}
            icon={<Users className="h-4 w-4" aria-hidden="true" />}
            hint="All accounts in the workspace"
          />
          <StatCard
            label="Active employees"
            value={stats.employees.active}
            icon={<UserCheck className="h-4 w-4" aria-hidden="true" />}
            hint="Can currently sign in"
          />
          <StatCard
            label="Inactive employees"
            value={stats.employees.inactive}
            icon={<UserX className="h-4 w-4" aria-hidden="true" />}
            hint="Access has been revoked"
          />
          <StatCard
            label="Administrators"
            value={stats.employees.byRole.admin}
            icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
            hint="Admin accounts excluding the owner"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent activity"
            description={
              stats.recentActivityScope === "organization"
                ? "The latest account and system events across the organization."
                : "Your latest account activity."
            }
            action={
              canViewAudit ? (
                <Link
                  to="/audit-logs"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                >
                  View all
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              ) : null
            }
          />
          <ActivityList
            logs={stats.recentActivity}
            emptyDescription={
              stats.recentActivityScope === "organization"
                ? "Sign-ins and account changes will appear here."
                : "Your sign-ins and account changes will appear here."
            }
          />
        </Card>

        <Card>
          <CardHeader
            title="Team composition"
            description="Accounts grouped by role."
          />
          <CardBody className="space-y-4">
            {ROLE_ORDER.map((role) => {
              const count = stats.employees.byRole[role];
              const width = Math.round((count / maxRoleCount) * 100);

              return (
                <div key={role}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {ROLE_LABELS[role]}
                    </span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              <span className="font-medium text-slate-700">
                {stats.employees.active}
              </span>{" "}
              of {stats.employees.total} accounts are active.
            </div>
          </CardBody>
        </Card>
      </div>

      <section aria-labelledby="coming-soon-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="coming-soon-heading"
              className="text-sm font-semibold text-slate-900"
            >
              More modules coming soon
            </h2>
            <p className="text-xs text-slate-500">
              These areas are not connected to data yet.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Roadmap
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Active projects"
            value="—"
            comingSoon
            icon={<FolderKanban className="h-4 w-4" aria-hidden="true" />}
          />
          <StatCard
            label="Pending payments"
            value="—"
            comingSoon
            icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
          />
          <StatCard
            label="Reports"
            value="—"
            comingSoon
            icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="What's on the roadmap"
            description="Planned modules that will extend the CRM beyond leads and employee management."
          />
          <CardBody>
            <ul className="grid gap-3 sm:grid-cols-2">
              {UPCOMING_MODULES.map((module) => {
                const Icon = UPCOMING_ICONS[module.key] ?? Target;
                return (
                  <li
                    key={module.key}
                    className="flex items-start gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">
                        {module.label}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {module.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Quick actions"
            description="Shortcuts available to your role."
          />
          <CardBody className="space-y-2">
            {canViewCustomers ? (
              <Link
                to="/customers"
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50/50"
              >
                <Users className="h-4 w-4 text-brand-600" aria-hidden="true" />
                Manage customers
                <ArrowRight
                  className="ml-auto h-3.5 w-3.5 text-slate-400"
                  aria-hidden="true"
                />
              </Link>
            ) : null}
            <Link
              to="/leads"
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50/50"
            >
              <Target className="h-4 w-4 text-brand-600" aria-hidden="true" />
              {canCreateLeads ? "Add or manage leads" : "View leads"}
              <ArrowRight
                className="ml-auto h-3.5 w-3.5 text-slate-400"
                aria-hidden="true"
              />
            </Link>
            <Link
              to="/follow-ups"
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50/50"
            >
              <CalendarClock
                className="h-4 w-4 text-brand-600"
                aria-hidden="true"
              />
              Review follow-ups
              <ArrowRight
                className="ml-auto h-3.5 w-3.5 text-slate-400"
                aria-hidden="true"
              />
            </Link>
            {canCreateEmployees ? (
              <Link
                to="/employees"
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50/50"
              >
                <Users className="h-4 w-4 text-brand-600" aria-hidden="true" />
                Manage employees
                <ArrowRight
                  className="ml-auto h-3.5 w-3.5 text-slate-400"
                  aria-hidden="true"
                />
              </Link>
            ) : null}
            {canViewAudit ? (
              <Link
                to="/audit-logs"
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50/50"
              >
                <ScrollText
                  className="h-4 w-4 text-brand-600"
                  aria-hidden="true"
                />
                Review audit logs
                <ArrowRight
                  className="ml-auto h-3.5 w-3.5 text-slate-400"
                  aria-hidden="true"
                />
              </Link>
            ) : null}
            {canManageSettings ? (
              <Link
                to="/settings"
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50/50"
              >
                <Settings
                  className="h-4 w-4 text-brand-600"
                  aria-hidden="true"
                />
                CRM settings
                <ArrowRight
                  className="ml-auto h-3.5 w-3.5 text-slate-400"
                  aria-hidden="true"
                />
              </Link>
            ) : null}
            <Link
              to="/profile"
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50/50"
            >
              <ShieldCheck
                className="h-4 w-4 text-brand-600"
                aria-hidden="true"
              />
              My profile & security
              <ArrowRight
                className="ml-auto h-3.5 w-3.5 text-slate-400"
                aria-hidden="true"
              />
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
