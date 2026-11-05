import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  KeyRound,
  LogOut,
  Menu,
  UserRound,
} from "lucide-react";
import type { AuthUserDto } from "../../../shared/types/api";
import { ROLE_LABELS } from "../../../shared/types/roles";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../lib/cn";
import { Avatar } from "../ui";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "All Leads",
  "/leads/my": "My Leads",
  "/leads/pipeline": "Pipeline",
  "/follow-ups": "Follow-ups",
  "/employees": "Employees",
  "/audit-logs": "Audit Logs",
  "/settings": "Settings",
  "/profile": "Profile",
  "/change-password": "Change Password",
};

function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }
  if (pathname.startsWith("/leads/")) {
    return "Lead Details";
  }
  if (pathname.startsWith("/employees/")) {
    return "Employee Details";
  }
  return "Shifra Nuha CRM";
}

export function Topbar({
  user,
  onOpenMenu,
}: {
  user: AuthUserDto;
  onOpenMenu: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, isLoggingOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {pageTitle(location.pathname)}
            </p>
            <p className="hidden text-xs text-slate-400 sm:block">
              Shifra Nuha Technologies
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-2" ref={menuRef}>
          <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 sm:inline-flex">
            {ROLE_LABELS[user.role]}
          </span>

          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar name={user.fullName} size="sm" />
            <span className="hidden max-w-40 truncate text-sm font-medium text-slate-700 sm:block">
              {user.fullName}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-slate-400 transition-transform",
                menuOpen ? "rotate-180" : undefined,
              )}
              aria-hidden="true"
            />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {user.fullName}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <div className="p-1.5">
                <Link
                  to="/profile"
                  role="menuitem"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                  My profile
                </Link>
                <Link
                  to="/change-password"
                  role="menuitem"
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Change password
                </Link>
              </div>
              <div className="border-t border-slate-100 p-1.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    void handleLogout();
                  }}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {isLoggingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
