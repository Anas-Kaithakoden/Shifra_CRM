import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarClock,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Lock,
  ScrollText,
  Settings,
  Target,
  UserCheck,
  Users,
  UserX,
  Wallet,
  X,
} from "lucide-react";
import type { AuthUserDto } from "../../../shared/types/api";
import type { Permission } from "../../../shared/types/permissions";
import { UPCOMING_MODULES } from "../../../shared/constants/modules";
import { ROLE_LABELS } from "../../../shared/types/roles";
import { cn } from "../../lib/cn";
import { Avatar } from "../ui";

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard:view",
  },
  {
    label: "Employees",
    to: "/employees",
    icon: Users,
    permission: "users:read",
  },
  {
    label: "Audit Logs",
    to: "/audit-logs",
    icon: ScrollText,
    permission: "audit:read",
  },
  {
    label: "Settings",
    to: "/settings",
    icon: Settings,
    permission: "settings:manage",
  },
];

const LEAD_NAV_ITEMS: NavItem[] = [
  {
    label: "All Leads",
    to: "/leads",
    icon: Target,
    permission: "leads:read",
  },
  {
    label: "My Leads",
    to: "/leads/my",
    icon: Users,
    permission: "leads:read",
  },
  {
    label: "Follow-ups",
    to: "/follow-ups",
    icon: CalendarClock,
    permission: "followups:read",
  },
  {
    label: "Pipeline",
    to: "/leads/pipeline",
    icon: FolderKanban,
    permission: "leads:read",
  },
];

const CUSTOMER_NAV_ITEMS: NavItem[] = [
  {
    label: "All Customers",
    to: "/customers",
    icon: Building2,
    permission: "customers:read",
  },
  {
    label: "Active Customers",
    to: "/customers?status=active",
    icon: UserCheck,
    permission: "customers:read",
  },
  {
    label: "Inactive Customers",
    to: "/customers?status=inactive",
    icon: UserX,
    permission: "customers:read",
  },
];

const UPCOMING_ICONS: Record<string, typeof Target> = {
  projects: FolderKanban,
  tasks: Briefcase,
  payments: Wallet,
  documents: FileText,
  reports: BarChart3,
};

export function Sidebar({
  user,
  mobileOpen,
  onClose,
}: {
  user: AuthUserDto;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || user.permissions.includes(item.permission),
  );
  const visibleLeadItems = LEAD_NAV_ITEMS.filter(
    (item) => !item.permission || user.permissions.includes(item.permission),
  );
  const visibleCustomerItems = CUSTOMER_NAV_ITEMS.filter(
    (item) => !item.permission || user.permissions.includes(item.permission),
  );
  const location = useLocation();
  const activeCustomerStatus =
    new URLSearchParams(location.search).get("status") ?? "all";

  const isCustomerItemActive = (to: string, pathActive: boolean) => {
    if (!pathActive) {
      return false;
    }
    if (location.pathname !== "/customers") {
      return to === "/customers";
    }
    const target = new URLSearchParams(to.split("?")[1] ?? "");
    return (target.get("status") ?? "all") === activeCustomerStatus;
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-30 bg-slate-950/40 transition-opacity lg:hidden",
          mobileOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-100 px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white shadow-sm">
              SN
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                Shifra Nuha
              </p>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                CRM
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </p>
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-brand-50 text-brand-800"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>

          {visibleLeadItems.length > 0 ? (
            <>
              <p className="mt-6 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Leads
              </p>
              <ul className="space-y-1">
                {visibleLeadItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === "/leads"}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-brand-50 text-brand-800"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                          )
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {visibleCustomerItems.length > 0 ? (
            <>
              <p className="mt-6 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Customers
              </p>
              <ul className="space-y-1">
                {visibleCustomerItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                            isCustomerItemActive(item.to, isActive)
                              ? "bg-brand-50 text-brand-800"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                          )
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          <p className="mt-6 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Coming soon
          </p>
          <ul className="space-y-1">
            {UPCOMING_MODULES.map((module) => {
              const Icon = UPCOMING_ICONS[module.key] ?? Target;
              return (
                <li key={module.key}>
                  <div
                    className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-400"
                    title={`${module.label} — coming soon`}
                    aria-disabled="true"
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1 truncate">{module.label}</span>
                    <Lock className="h-3 w-3" aria-hidden="true" />
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-slate-100 p-3">
          <NavLink
            to="/profile"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg p-2 transition-colors",
                isActive ? "bg-brand-50" : "hover:bg-slate-50",
              )
            }
          >
            <Avatar name={user.fullName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {user.fullName}
              </p>
              <p className="text-xs text-slate-500">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
          </NavLink>
          <p className="px-2 pt-2 text-[10px] text-slate-400">
            Version 3.0 · Internal use only
          </p>
        </div>
      </aside>
    </>
  );
}
