export interface UpcomingModule {
  key: string;
  label: string;
  description: string;
}

/**
 * Modules that are deliberately not implemented yet. They are shown in
 * navigation as disabled "Soon" items and never rendered as functional pages.
 */
export const UPCOMING_MODULES: readonly UpcomingModule[] = [
  {
    key: "projects",
    label: "Projects",
    description: "Track delivery, milestones and project ownership.",
  },
  {
    key: "payments",
    label: "Payments",
    description: "Record invoices, payments and outstanding balances.",
  },
  {
    key: "documents",
    label: "Documents",
    description: "Store proposals, contracts and client files.",
  },
  {
    key: "reports",
    label: "Reports",
    description: "Understand pipeline, delivery and revenue performance.",
  },
] as const;
