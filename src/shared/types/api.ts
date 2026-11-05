import type { Permission } from "./permissions";
import type { Role } from "./roles";
import type { LeadDashboardStatsDto } from "./leads";
import type { CustomerDashboardStatsDto } from "./customers";

export interface UserDto {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AuthUserDto extends UserDto {
  permissions: Permission[];
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface LoginResponse {
  user: AuthUserDto;
  csrfToken: string;
}

export interface MeResponse {
  user: AuthUserDto;
  csrfToken: string;
}

export interface AuditActorDto {
  id: string;
  fullName: string;
  email: string;
}

export interface AuditLogDto {
  id: string;
  userId: string | null;
  actor: AuditActorDto | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export type ModuleStatus = "available" | "coming_soon";

export interface ModuleStat {
  value: number | null;
  status: ModuleStatus;
}

export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<Role, number>;
}

export interface DashboardStatsDto {
  employees: EmployeeStats;
  leads: ModuleStat;
  leadStats: LeadDashboardStatsDto;
  customerStats: CustomerDashboardStatsDto;
  activeProjects: ModuleStat;
  pendingPayments: ModuleStat;
  recentActivity: AuditLogDto[];
  recentActivityScope: "organization" | "personal";
  generatedAt: string;
}

export interface AppSettingsDto {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  timezone: string;
  currency: string;
  updatedAt: string | null;
}

export interface HealthDto {
  status: "ok";
  environment: string;
  timestamp: string;
}
