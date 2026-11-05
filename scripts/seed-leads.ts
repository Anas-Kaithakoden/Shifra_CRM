import { findServiceCategory } from "../src/shared/constants/services";
import type {
  ContactStatus,
  LeadPriority,
  LeadSource,
  PipelineStage,
} from "../src/shared/constants/leads";
import { getCrmDayBounds, getCrmDateKey } from "../src/server/lib/time";
import { normalizeEmail, normalizePhone } from "../src/server/lib/phone";
import { runD1File, runD1Query, sqlJson, sqlString } from "./d1";

/**
 * Local-only demo data for the Lead Management module.
 *
 * Re-running this script refreshes the demo leads (same deterministic IDs) so
 * that relative follow-up dates stay useful. It never writes to a remote
 * database and never touches leads created through the application.
 */

type SeedRole = "owner" | "admin" | "employee";

interface SeedUser {
  id: string;
  fullName: string;
  email: string;
  role: SeedRole;
}

const SEED_USER_EMAILS = [
  "owner@shifranuha.dev",
  "admin@shifranuha.dev",
  "employee@shifranuha.dev",
] as const;

interface SeedActivity {
  type:
    | "call"
    | "whatsapp"
    | "email"
    | "meeting"
    | "note"
    | "stage_changed"
    | "assignment_changed"
    | "follow_up_scheduled"
    | "follow_up_completed"
    | "lead_won"
    | "lead_lost"
    | "lead_reopened";
  title: string;
  description?: string;
  hoursAgo: number;
  user: SeedRole | null;
  previousStage?: PipelineStage;
  newStage?: PipelineStage;
}

interface SeedLead {
  key: string;
  name: string;
  phone: string;
  email?: string;
  businessName?: string;
  location?: string;
  serviceInterest?: string;
  source: LeadSource;
  pipelineStage: PipelineStage;
  contactStatus: ContactStatus;
  priority: LeadPriority;
  assignedTo: SeedRole | null;
  createdBy: SeedRole;
  estimatedValue?: number;
  description?: string;
  lostReason?: string;
  createdDaysAgo: number;
  lastContactedDaysAgo?: number;
  convertedDaysAgo?: number;
  activities: SeedActivity[];
}

interface SeedFollowUp {
  key: string;
  leadKey: string;
  title: string;
  notes?: string;
  scheduledAt: string;
  status: "pending" | "completed" | "cancelled";
  completedAt?: string;
  assignedTo: SeedRole | null;
  createdBy: SeedRole;
  createdDaysAgo: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const now = Date.now();
const dayBounds = getCrmDayBounds(new Date(now));
const dayStartMs = Date.parse(dayBounds.start);
const dayEndMs = Date.parse(dayBounds.end);
const todayFollowUp = new Date(
  Math.min(
    Math.max(now + 45 * 60 * 1000, dayStartMs + 11 * HOUR_MS),
    dayEndMs - 5 * 60 * 1000,
  ),
).toISOString();

const isoDaysAgo = (days: number): string =>
  new Date(now - days * DAY_MS).toISOString();
const isoHoursAgo = (hours: number): string =>
  new Date(now - hours * HOUR_MS).toISOString();
const isoDaysFromNow = (days: number): string =>
  new Date(now + days * DAY_MS).toISOString();

const SEED_LEADS: SeedLead[] = [
  {
    key: "brightline",
    name: "Priya Menon",
    phone: "+91 98470 22118",
    email: "priya@brightlineinteriors.in",
    businessName: "Brightline Interiors",
    location: "Kochi, Kerala",
    serviceInterest: "Website Design & Development",
    source: "Phone Call",
    pipelineStage: "qualified",
    contactStatus: "contacted",
    priority: "high",
    assignedTo: "employee",
    createdBy: "employee",
    estimatedValue: 85000,
    description:
      "Wants a portfolio site with project galleries and an enquiry form. Decision expected after the partner review.",
    createdDaysAgo: 12,
    lastContactedDaysAgo: 3,
    activities: [
      {
        type: "call",
        title: "Discovery call with Priya",
        description:
          "Discussed current website gaps, target audience and the project gallery structure.",
        hoursAgo: 12 * 24 - 2,
        user: "employee",
      },
      {
        type: "stage_changed",
        title: "Moved to Qualified",
        description: "Budget and timeline confirmed in the second call.",
        hoursAgo: 5 * 24,
        user: "employee",
        previousStage: "contacted",
        newStage: "qualified",
      },
      {
        type: "note",
        title: "Partner review scheduled",
        description:
          "Priya will review the proposal with her business partner on Friday.",
        hoursAgo: 3 * 24,
        user: "employee",
      },
    ],
  },
  {
    key: "rao-logistics",
    name: "Arjun Rao",
    phone: "+91 99001 44872",
    email: "arjun@raologistics.com",
    businessName: "Rao Logistics",
    location: "Bengaluru, Karnataka",
    serviceInterest: "ERP & Business Management Software",
    source: "WhatsApp",
    pipelineStage: "proposal_sent",
    contactStatus: "contacted",
    priority: "high",
    assignedTo: "admin",
    createdBy: "admin",
    estimatedValue: 240000,
    description:
      "Needs dispatch tracking, driver records and a simple customer portal. Proposal shared with a 30-day validity.",
    createdDaysAgo: 9,
    lastContactedDaysAgo: 1,
    activities: [
      {
        type: "whatsapp",
        title: "Shared requirement checklist on WhatsApp",
        hoursAgo: 7 * 24,
        user: "admin",
      },
      {
        type: "stage_changed",
        title: "Moved to Proposal Sent",
        description:
          "Proposal sent for the first phase covering dispatch and billing.",
        hoursAgo: 4 * 24,
        user: "admin",
        previousStage: "qualified",
        newStage: "proposal_sent",
      },
      {
        type: "call",
        title: "Proposal walkthrough call",
        description:
          "Arjun asked for a phased rollout and a revised implementation timeline.",
        hoursAgo: 1 * 24,
        user: "admin",
      },
    ],
  },
  {
    key: "crescent-boutique",
    name: "Fatima Sheikh",
    phone: "+91 98202 11763",
    email: "fatima@crescentboutique.in",
    businessName: "Crescent Boutique",
    location: "Mumbai, Maharashtra",
    serviceInterest: "Logo Design",
    source: "Instagram Ads",
    pipelineStage: "negotiation",
    contactStatus: "contacted",
    priority: "medium",
    assignedTo: "employee",
    createdBy: "employee",
    estimatedValue: 45000,
    description:
      "Rebranding an established boutique. Comparing two logo directions; price negotiation in progress.",
    createdDaysAgo: 6,
    lastContactedDaysAgo: 1,
    activities: [
      {
        type: "call",
        title: "Brand discovery call",
        description:
          "Reviewed the current identity, preferred colours and competitor references.",
        hoursAgo: 5 * 24,
        user: "employee",
      },
      {
        type: "stage_changed",
        title: "Moved to Negotiation",
        hoursAgo: 2 * 24,
        user: "employee",
        previousStage: "proposal_sent",
        newStage: "negotiation",
      },
      {
        type: "email",
        title: "Sent revised quote",
        description: "Revised package includes logo, business cards and social kits.",
        hoursAgo: 1 * 24,
        user: "employee",
      },
    ],
  },
  {
    key: "nova-dental",
    name: "Karan Patel",
    phone: "+91 97250 33409",
    email: "karan@novadentalclinic.com",
    businessName: "Nova Dental Clinic",
    location: "Ahmedabad, Gujarat",
    serviceInterest: "CRM & Lead Management",
    source: "Website",
    pipelineStage: "contacted",
    contactStatus: "attempted",
    priority: "medium",
    assignedTo: "admin",
    createdBy: "admin",
    estimatedValue: 120000,
    description:
      "Enquiry came through the website contact form. First callback was missed; retry planned.",
    createdDaysAgo: 4,
    activities: [
      {
        type: "call",
        title: "Missed callback",
        description: "No answer. Left a voicemail and sent a WhatsApp follow-up.",
        hoursAgo: 2 * 24,
        user: "admin",
      },
      {
        type: "stage_changed",
        title: "Moved to Contacted",
        hoursAgo: 2 * 24,
        user: "admin",
        previousStage: "new",
        newStage: "contacted",
      },
    ],
  },
  {
    key: "greenleaf",
    name: "Meera Iyer",
    phone: "+91 94440 78215",
    email: "meera@greenleaforganics.in",
    businessName: "Greenleaf Organics",
    location: "Chennai, Tamil Nadu",
    serviceInterest: "Billing & Inventory Systems",
    source: "Referral",
    pipelineStage: "new",
    contactStatus: "not_contacted",
    priority: "low",
    assignedTo: "employee",
    createdBy: "owner",
    estimatedValue: 65000,
    description:
      "Referred by Rao Logistics. Needs a lean billing and stock system for two retail outlets.",
    createdDaysAgo: 1,
    activities: [],
  },
  {
    key: "gupta-textiles",
    name: "Rohan Gupta",
    phone: "+91 98300 55124",
    email: "rohan@guptatextiles.in",
    businessName: "Gupta Textiles",
    location: "Kolkata, West Bengal",
    serviceInterest: "GST Registration",
    source: "Facebook Ads",
    pipelineStage: "lost",
    contactStatus: "contacted",
    priority: "medium",
    assignedTo: "employee",
    createdBy: "employee",
    estimatedValue: 25000,
    description:
      "Wanted GST registration and first-year filing support. Chose an in-house accountant.",
    lostReason: "Chose an in-house accountant",
    createdDaysAgo: 18,
    lastContactedDaysAgo: 8,
    activities: [
      {
        type: "call",
        title: "Requirement call",
        hoursAgo: 15 * 24,
        user: "employee",
      },
      {
        type: "stage_changed",
        title: "Moved to Lost",
        description: "Lost to an in-house accountant recommendation.",
        hoursAgo: 8 * 24,
        user: "employee",
        previousStage: "proposal_sent",
        newStage: "lost",
      },
    ],
  },
  {
    key: "paper-lantern",
    name: "Sana Khan",
    phone: "+91 98711 66230",
    email: "sana@thepaperlantern.in",
    businessName: "The Paper Lantern",
    location: "New Delhi, Delhi",
    serviceInterest: "Brand Identity & Guidelines",
    source: "Walk-in",
    pipelineStage: "won",
    contactStatus: "contacted",
    priority: "high",
    assignedTo: "admin",
    createdBy: "admin",
    estimatedValue: 95000,
    description:
      "Full identity refresh for a stationery brand. Advance received; project handover to delivery team.",
    createdDaysAgo: 22,
    lastContactedDaysAgo: 6,
    convertedDaysAgo: 6,
    activities: [
      {
        type: "meeting",
        title: "Brand workshop at the studio",
        hoursAgo: 18 * 24,
        user: "admin",
      },
      {
        type: "stage_changed",
        title: "Moved to Won",
        description: "Advance payment received and scope signed off.",
        hoursAgo: 6 * 24,
        user: "admin",
        previousStage: "negotiation",
        newStage: "won",
      },
    ],
  },
  {
    key: "singh-motors",
    name: "Vikram Singh",
    phone: "+91 98110 40786",
    email: "vikram@singhmotors.in",
    businessName: "Singh Motors",
    location: "Ludhiana, Punjab",
    serviceInterest: "Custom Business Applications",
    source: "Phone Call",
    pipelineStage: "contacted",
    contactStatus: "contacted",
    priority: "high",
    assignedTo: "owner",
    createdBy: "owner",
    estimatedValue: 350000,
    description:
      "Service-centre job cards, parts inventory and customer history. Technical scoping call completed.",
    createdDaysAgo: 5,
    lastContactedDaysAgo: 2,
    activities: [
      {
        type: "call",
        title: "Technical scoping call",
        description:
          "Mapped job-card workflow, parts catalogue and reporting requirements.",
        hoursAgo: 2 * 24,
        user: "owner",
      },
      {
        type: "note",
        title: "Site visit requested",
        description: "Vikram wants a short on-site walkthrough before the proposal.",
        hoursAgo: 2 * 24,
        user: "owner",
      },
    ],
  },
  {
    key: "lotus-wellness",
    name: "Ananya Das",
    phone: "+91 98301 22945",
    email: "ananya@lotuswellness.in",
    businessName: "Lotus Wellness Studio",
    location: "Kolkata, West Bengal",
    serviceInterest: "Website Design & Development",
    source: "Website",
    pipelineStage: "qualified",
    contactStatus: "contacted",
    priority: "medium",
    assignedTo: "employee",
    createdBy: "employee",
    estimatedValue: 60000,
    description:
      "Class schedule, instructor profiles and online booking integration. Comparing booking plugins.",
    createdDaysAgo: 7,
    lastContactedDaysAgo: 1,
    activities: [
      {
        type: "meeting",
        title: "Studio walkthrough",
        hoursAgo: 4 * 24,
        user: "employee",
      },
      {
        type: "stage_changed",
        title: "Moved to Qualified",
        hoursAgo: 3 * 24,
        user: "employee",
        previousStage: "contacted",
        newStage: "qualified",
      },
    ],
  },
  {
    key: "sheikh-exports",
    name: "Imran Sheikh",
    phone: "+91 99203 71864",
    email: "imran@sheikhexports.in",
    businessName: "Sheikh Exports",
    location: "Surat, Gujarat",
    serviceInterest: "Trademark Registration",
    source: "Referral",
    pipelineStage: "new",
    contactStatus: "not_contacted",
    priority: "high",
    assignedTo: "admin",
    createdBy: "admin",
    estimatedValue: 40000,
    description:
      "Referred by an existing client. Needs a word-mark search and filing for two classes.",
    createdDaysAgo: 0,
    activities: [],
  },
  {
    key: "verma-caterers",
    name: "Neha Verma",
    phone: "+91 97177 83201",
    email: "neha@vermacaterers.in",
    businessName: "Verma Caterers",
    location: "Gurugram, Haryana",
    serviceInterest: "Logo Design",
    source: "Instagram Ads",
    pipelineStage: "contacted",
    contactStatus: "attempted",
    priority: "low",
    assignedTo: "employee",
    createdBy: "employee",
    estimatedValue: 18000,
    description:
      "Small logo refresh for packaging and social profiles. Two callbacks went unanswered.",
    createdDaysAgo: 14,
    activities: [
      {
        type: "call",
        title: "First callback attempt",
        description: "No answer; left a WhatsApp message with the service overview.",
        hoursAgo: 9 * 24,
        user: "employee",
      },
      {
        type: "call",
        title: "Second callback attempt",
        description: "Number busy. Try again after 6 pm.",
        hoursAgo: 4 * 24,
        user: "employee",
      },
    ],
  },
  {
    key: "nair-constructions",
    name: "Aditya Nair",
    phone: "+91 94470 19035",
    email: "aditya@nairconstructions.in",
    businessName: "Nair Constructions",
    location: "Thiruvananthapuram, Kerala",
    serviceInterest: "ERP & Business Management Software",
    source: "Other",
    pipelineStage: "proposal_sent",
    contactStatus: "contacted",
    priority: "high",
    assignedTo: "admin",
    createdBy: "admin",
    estimatedValue: 420000,
    description:
      "Project costing, site material tracking and vendor payments. Proposal under review by their finance team.",
    createdDaysAgo: 11,
    lastContactedDaysAgo: 2,
    activities: [
      {
        type: "stage_changed",
        title: "Moved to Proposal Sent",
        hoursAgo: 6 * 24,
        user: "admin",
        previousStage: "qualified",
        newStage: "proposal_sent",
      },
      {
        type: "email",
        title: "Sent implementation plan",
        description:
          "Attached the phase-wise plan and commercial comparison for 20 users.",
        hoursAgo: 2 * 24,
        user: "admin",
      },
    ],
  },
  {
    key: "ahmed-fashion",
    name: "Zoya Ahmed",
    phone: "+91 98209 44571",
    email: "zoya@ahmedfashionhouse.in",
    businessName: "Ahmed Fashion House",
    location: "Mumbai, Maharashtra",
    serviceInterest: "Brand Identity & Guidelines",
    source: "Facebook Ads",
    pipelineStage: "qualified",
    contactStatus: "contacted",
    priority: "medium",
    assignedTo: "employee",
    createdBy: "employee",
    estimatedValue: 70000,
    description:
      "Identity refresh across retail packaging, lookbooks and store signage. Awaiting their brand questionnaire.",
    createdDaysAgo: 10,
    lastContactedDaysAgo: 2,
    activities: [
      {
        type: "call",
        title: "Brand questionnaire walkthrough",
        hoursAgo: 6 * 24,
        user: "employee",
      },
      {
        type: "stage_changed",
        title: "Moved to Qualified",
        hoursAgo: 4 * 24,
        user: "employee",
        previousStage: "contacted",
        newStage: "qualified",
      },
    ],
  },
  {
    key: "kapoor-electronics",
    name: "Sahil Kapoor",
    phone: "+91 98101 30892",
    email: "sahil@kapoorelectronics.in",
    businessName: "Kapoor Electronics",
    location: "Chandigarh, Chandigarh",
    serviceInterest: "Billing & Inventory Systems",
    source: "WhatsApp",
    pipelineStage: "new",
    contactStatus: "attempted",
    priority: "low",
    assignedTo: null,
    createdBy: "admin",
    estimatedValue: 55000,
    description:
      "WhatsApp enquiry for a single-counter billing setup. Not yet assigned; needs qualification.",
    createdDaysAgo: 2,
    activities: [
      {
        type: "whatsapp",
        title: "Inbound WhatsApp enquiry",
        description:
          "Asked about pricing for one billing counter with barcode support.",
        hoursAgo: 2 * 24,
        user: null,
      },
    ],
  },
  {
    key: "rao-consulting",
    name: "Lakshmi Rao",
    phone: "+91 98860 73204",
    email: "lakshmi@raoconsulting.in",
    businessName: "Rao Consulting",
    location: "Hyderabad, Telangana",
    serviceInterest: "LLP Registration",
    source: "Website",
    pipelineStage: "won",
    contactStatus: "contacted",
    priority: "medium",
    assignedTo: "employee",
    createdBy: "employee",
    estimatedValue: 30000,
    description:
      "LLP registration for a two-partner consulting firm. Completed and converted to a client engagement.",
    createdDaysAgo: 40,
    lastContactedDaysAgo: 20,
    convertedDaysAgo: 20,
    activities: [
      {
        type: "stage_changed",
        title: "Moved to Won",
        description: "Registration completed and final invoice settled.",
        hoursAgo: 20 * 24,
        user: "employee",
        previousStage: "negotiation",
        newStage: "won",
      },
    ],
  },
  {
    key: "joshi-pharma",
    name: "Manish Joshi",
    phone: "+91 98220 26317",
    email: "manish@joshipharma.in",
    businessName: "Joshi Pharma",
    location: "Pune, Maharashtra",
    serviceInterest: "GST Registration",
    source: "Phone Call",
    pipelineStage: "lost",
    contactStatus: "contacted",
    priority: "low",
    assignedTo: "admin",
    createdBy: "admin",
    estimatedValue: 15000,
    description:
      "GST registration enquiry for a new distribution unit. Deferred the decision due to budget.",
    lostReason: "Budget constraints",
    createdDaysAgo: 30,
    lastContactedDaysAgo: 22,
    activities: [
      {
        type: "call",
        title: "Pricing discussion",
        hoursAgo: 25 * 24,
        user: "admin",
      },
      {
        type: "stage_changed",
        title: "Moved to Lost",
        hoursAgo: 22 * 24,
        user: "admin",
        previousStage: "contacted",
        newStage: "lost",
      },
    ],
  },
];

const SEED_FOLLOW_UPS: SeedFollowUp[] = [
  {
    key: "brightline-overdue",
    leadKey: "brightline",
    title: "Confirm proposal review outcome",
    notes:
      "Priya was waiting for her partner's feedback. Ask for a decision date or a joint call.",
    scheduledAt: isoDaysAgo(2),
    status: "pending",
    assignedTo: "employee",
    createdBy: "employee",
    createdDaysAgo: 5,
  },
  {
    key: "rao-logistics-today",
    leadKey: "rao-logistics",
    title: "Follow up on revised timeline",
    notes:
      "Share the phased rollout plan and answer the driver-app questions from the last call.",
    scheduledAt: todayFollowUp,
    status: "pending",
    assignedTo: "admin",
    createdBy: "admin",
    createdDaysAgo: 1,
  },
  {
    key: "crescent-upcoming",
    leadKey: "crescent-boutique",
    title: "Close logo direction and pricing",
    notes:
      "Fatima is comparing two directions. Send the third option with the final package price.",
    scheduledAt: isoDaysFromNow(2),
    status: "pending",
    assignedTo: "employee",
    createdBy: "employee",
    createdDaysAgo: 2,
  },
  {
    key: "nova-completed",
    leadKey: "nova-dental",
    title: "Retry callback",
    notes: "No answer on the first attempt. Try the clinic reception after 4 pm.",
    scheduledAt: isoDaysAgo(1),
    status: "completed",
    completedAt: isoDaysAgo(1),
    assignedTo: "admin",
    createdBy: "admin",
    createdDaysAgo: 3,
  },
  {
    key: "gupta-cancelled",
    leadKey: "gupta-textiles",
    title: "GST filing support check-in",
    notes: "Cancelled after the lead was marked lost.",
    scheduledAt: isoDaysAgo(6),
    status: "cancelled",
    assignedTo: "employee",
    createdBy: "employee",
    createdDaysAgo: 10,
  },
  {
    key: "singh-upcoming",
    leadKey: "singh-motors",
    title: "On-site workflow walkthrough",
    notes:
      "Visit the service centre with the workflow questionnaire and confirm the proposal scope.",
    scheduledAt: isoDaysFromNow(5),
    status: "pending",
    assignedTo: "owner",
    createdBy: "owner",
    createdDaysAgo: 1,
  },
  {
    key: "lotus-today",
    leadKey: "lotus-wellness",
    title: "Review booking plugin options",
    notes:
      "Ananya wants a comparison of two booking plugins and their monthly costs.",
    scheduledAt: todayFollowUp,
    status: "pending",
    assignedTo: "employee",
    createdBy: "employee",
    createdDaysAgo: 1,
  },
  {
    key: "verma-overdue",
    leadKey: "verma-caterers",
    title: "Third callback attempt",
    notes: "Try the alternate number if the primary number is still busy.",
    scheduledAt: isoDaysAgo(5),
    status: "pending",
    assignedTo: "employee",
    createdBy: "employee",
    createdDaysAgo: 7,
  },
  {
    key: "nair-upcoming",
    leadKey: "nair-constructions",
    title: "Finance team proposal review",
    notes:
      "Aditya's finance team is reviewing the 20-user plan. Confirm the review meeting.",
    scheduledAt: isoDaysFromNow(1),
    status: "pending",
    assignedTo: "admin",
    createdBy: "admin",
    createdDaysAgo: 2,
  },
  {
    key: "ahmed-completed",
    leadKey: "ahmed-fashion",
    title: "Collect brand questionnaire",
    notes: "Questionnaire received. Logo references still pending.",
    scheduledAt: isoDaysAgo(2),
    status: "completed",
    completedAt: isoDaysAgo(2),
    assignedTo: "employee",
    createdBy: "employee",
    createdDaysAgo: 4,
  },
  {
    key: "kapoor-upcoming",
    leadKey: "kapoor-electronics",
    title: "Qualify WhatsApp enquiry",
    notes:
      "Confirm counter count, barcode needs and whether they need GST invoicing.",
    scheduledAt: isoDaysFromNow(3),
    status: "pending",
    assignedTo: "admin",
    createdBy: "admin",
    createdDaysAgo: 2,
  },
  {
    key: "rao-consulting-completed",
    leadKey: "rao-consulting",
    title: "Collect incorporation documents",
    notes: "All documents received; engagement converted to a client project.",
    scheduledAt: isoDaysAgo(24),
    status: "completed",
    completedAt: isoDaysAgo(23),
    assignedTo: "employee",
    createdBy: "employee",
    createdDaysAgo: 28,
  },
];

function fail(message: string): never {
  throw new Error(message);
}

function ensureLeadTablesExist(): void {
  const rows = runD1Query<{ name: string }>(
    [
      "SELECT name FROM sqlite_master WHERE type = 'table'",
      "AND name IN ('leads', 'lead_activities', 'lead_follow_ups');",
    ].join(" "),
    { local: true },
  );

  if (rows.length < 3) {
    fail(
      [
        "The lead tables do not exist in the local D1 database.",
        "Apply migrations first:",
        "  npm run db:migrate:local",
      ].join("\n"),
    );
  }
}

function loadSeedUsers(): Map<SeedRole, SeedUser> {
  const emailList = SEED_USER_EMAILS.map((email) => sqlString(email)).join(", ");
  const rows = runD1Query<{
    id: string;
    full_name: string;
    email: string;
    role: string;
  }>(
    `SELECT id, full_name, email, role FROM users WHERE email IN (${emailList});`,
    { local: true },
  );

  const byRole = new Map<SeedRole, SeedUser>();
  for (const row of rows) {
    if (
      row.role === "owner" ||
      row.role === "admin" ||
      row.role === "employee"
    ) {
      byRole.set(row.role, {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
      });
    }
  }

  if (byRole.size < 3) {
    fail(
      [
        "The development seed users are missing.",
        "Run the base seed first:",
        "  npm run db:seed",
      ].join("\n"),
    );
  }

  return byRole;
}

function leadId(key: string): string {
  const index = SEED_LEADS.findIndex((lead) => lead.key === key);
  if (index === -1) {
    throw new Error(`Unknown seed lead key: ${key}`);
  }
  return `1d000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function userIdFor(
  users: Map<SeedRole, SeedUser>,
  role: SeedRole | null,
): string | null {
  if (!role) {
    return null;
  }
  return users.get(role)?.id ?? null;
}

function nullable(value: string | null | undefined): string {
  return value === null || value === undefined ? "NULL" : sqlString(value);
}

function main(): void {
  if (process.argv.includes("--remote")) {
    fail(
      "The lead demo seed is local-only. It refuses to write to a remote database.",
    );
  }

  ensureLeadTablesExist();
  const users = loadSeedUsers();
  const owner = users.get("owner");
  if (!owner) {
    fail("The owner seed user is missing. Run `npm run db:seed` first.");
  }

  const dateKey = getCrmDateKey();
  const statements: string[] = [];

  const seedLeadIds = SEED_LEADS.map((lead) => leadId(lead.key));
  const seedLeadIdList = seedLeadIds.map((id) => sqlString(id)).join(", ");
  const seedFollowUpIds = SEED_FOLLOW_UPS.map(
    (_, index) =>
      `f0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  );

  // Refresh only this script's deterministic demo rows. Application-created
  // leads are never touched.
  statements.push(`DELETE FROM leads WHERE id IN (${seedLeadIdList});`);
  statements.push(
    `DELETE FROM audit_logs WHERE id LIKE 'ad000000-0000-4000-8000-%';`,
  );

  const nextFollowUpByLead = new Map<string, string>();
  SEED_FOLLOW_UPS.forEach((followUp) => {
    if (followUp.status !== "pending") {
      return;
    }
    const leadKey = followUp.leadKey;
    const current = nextFollowUpByLead.get(leadKey);
    if (!current || Date.parse(followUp.scheduledAt) < Date.parse(current)) {
      nextFollowUpByLead.set(leadKey, followUp.scheduledAt);
    }
  });

  let activityCounter = 0;
  let auditCounter = 0;

  SEED_LEADS.forEach((lead, leadIndex) => {
    const id = leadId(lead.key);
    const createdAt = isoDaysAgo(lead.createdDaysAgo);
    const lastContactedAt =
      lead.lastContactedDaysAgo === undefined
        ? null
        : isoDaysAgo(lead.lastContactedDaysAgo);
    const convertedAt =
      lead.convertedDaysAgo === undefined
        ? null
        : isoDaysAgo(lead.convertedDaysAgo);
    const updatedAt =
      convertedAt ??
      lastContactedAt ??
      isoHoursAgo(
        Math.min(
          ...lead.activities.map((activity) => activity.hoursAgo),
          lead.createdDaysAgo * 24,
        ),
      );
    const serviceCategory = lead.serviceInterest
      ? findServiceCategory(lead.serviceInterest)
      : null;
    const leadNumber = `LD-${dateKey}-D${String(leadIndex + 1).padStart(5, "0")}`;

    statements.push(
      [
        "INSERT INTO leads (",
        "  id, lead_number, name, phone, phone_normalized, email, email_normalized,",
        "  business_name, location, service_interest, service_category, source,",
        "  pipeline_stage, contact_status, assigned_to, estimated_value, priority,",
        "  description, lost_reason, next_follow_up_at, last_contacted_at,",
        "  converted_at, created_by, created_at, updated_at, deleted_at",
        ") VALUES (",
        [
          sqlString(id),
          sqlString(leadNumber),
          sqlString(lead.name),
          sqlString(normalizePhone(lead.phone).display),
          sqlString(normalizePhone(lead.phone).normalized),
          nullable(lead.email),
          lead.email ? sqlString(normalizeEmail(lead.email)) : "NULL",
          nullable(lead.businessName),
          nullable(lead.location),
          nullable(lead.serviceInterest),
          nullable(serviceCategory),
          sqlString(lead.source),
          sqlString(lead.pipelineStage),
          sqlString(lead.contactStatus),
          nullable(userIdFor(users, lead.assignedTo)),
          lead.estimatedValue === undefined
            ? "NULL"
            : String(lead.estimatedValue),
          sqlString(lead.priority),
          nullable(lead.description),
          nullable(lead.lostReason),
          nullable(nextFollowUpByLead.get(lead.key)),
          nullable(lastContactedAt),
          nullable(convertedAt),
          nullable(userIdFor(users, lead.createdBy)),
          sqlString(createdAt),
          sqlString(updatedAt),
          "NULL",
        ].join(", "),
        ");",
      ].join("\n"),
    );

    const createdActivityId = `ac000000-0000-4000-8000-${String(
      ++activityCounter,
    ).padStart(12, "0")}`;
    statements.push(
      [
        "INSERT INTO lead_activities (",
        "  id, lead_id, user_id, activity_type, title, description,",
        "  previous_stage, new_stage, created_at",
        ") VALUES (",
        [
          sqlString(createdActivityId),
          sqlString(id),
          nullable(userIdFor(users, lead.createdBy)),
          "'lead_created'",
          sqlString(`Lead created from ${lead.source}`),
          nullable(
            lead.businessName
              ? `${lead.name} at ${lead.businessName}`
              : lead.name,
          ),
          "NULL",
          "NULL",
          sqlString(createdAt),
        ].join(", "),
        ");",
      ].join("\n"),
    );

    for (const activity of lead.activities) {
      const activityId = `ac000000-0000-4000-8000-${String(
        ++activityCounter,
      ).padStart(12, "0")}`;
      statements.push(
        [
          "INSERT INTO lead_activities (",
          "  id, lead_id, user_id, activity_type, title, description,",
          "  previous_stage, new_stage, created_at",
          ") VALUES (",
          [
            sqlString(activityId),
            sqlString(id),
            nullable(userIdFor(users, activity.user)),
            sqlString(activity.type),
            sqlString(activity.title),
            nullable(activity.description),
            nullable(activity.previousStage),
            nullable(activity.newStage),
            sqlString(isoHoursAgo(activity.hoursAgo)),
          ].join(", "),
          ");",
        ].join("\n"),
      );
    }

    const auditId = `ad000000-0000-4000-8000-${String(++auditCounter).padStart(
      12,
      "0",
    )}`;
    statements.push(
      [
        "INSERT INTO audit_logs (",
        "  id, user_id, action, entity_type, entity_id, metadata,",
        "  ip_address, created_at",
        ") VALUES (",
        [
          sqlString(auditId),
          nullable(userIdFor(users, lead.createdBy)),
          "'lead.created'",
          "'lead'",
          sqlString(id),
          sqlJson({
            leadNumber,
            source: lead.source,
            assignedTo: userIdFor(users, lead.assignedTo),
            seeded: true,
          }),
          "NULL",
          sqlString(createdAt),
        ].join(", "),
        ");",
      ].join("\n"),
    );

    if (lead.pipelineStage === "won" || lead.pipelineStage === "lost") {
      const closedAuditId = `ad000000-0000-4000-8000-${String(
        ++auditCounter,
      ).padStart(12, "0")}`;
      statements.push(
        [
          "INSERT INTO audit_logs (",
          "  id, user_id, action, entity_type, entity_id, metadata,",
          "  ip_address, created_at",
          ") VALUES (",
          [
            sqlString(closedAuditId),
            nullable(userIdFor(users, lead.assignedTo ?? lead.createdBy)),
            sqlString(
              lead.pipelineStage === "won" ? "lead.won" : "lead.lost",
            ),
            "'lead'",
            sqlString(id),
            sqlJson({
              leadNumber,
              newStage: lead.pipelineStage,
              lostReason: lead.lostReason ?? null,
              seeded: true,
            }),
            "NULL",
            sqlString(updatedAt),
          ].join(", "),
          ");",
        ].join("\n"),
      );
    }
  });

  SEED_FOLLOW_UPS.forEach((followUp, index) => {
    const id = seedFollowUpIds[index];
    if (!id) {
      throw new Error("Missing follow-up seed ID.");
    }
    const leadIdValue = leadId(followUp.leadKey);
    const createdAt = isoDaysAgo(followUp.createdDaysAgo);

    statements.push(
      [
        "INSERT INTO lead_follow_ups (",
        "  id, lead_id, assigned_to, title, notes, scheduled_at, status,",
        "  completed_at, created_by, created_at, updated_at",
        ") VALUES (",
        [
          sqlString(id),
          sqlString(leadIdValue),
          nullable(userIdFor(users, followUp.assignedTo)),
          sqlString(followUp.title),
          nullable(followUp.notes),
          sqlString(followUp.scheduledAt),
          sqlString(followUp.status),
          nullable(followUp.completedAt),
          nullable(userIdFor(users, followUp.createdBy)),
          sqlString(createdAt),
          sqlString(followUp.completedAt ?? createdAt),
        ].join(", "),
        ");",
      ].join("\n"),
    );

    const activityType =
      followUp.status === "completed"
        ? "follow_up_completed"
        : followUp.status === "cancelled"
          ? "follow_up_cancelled"
          : "follow_up_scheduled";
    const activityId = `ac000000-0000-4000-8000-${String(
      ++activityCounter,
    ).padStart(12, "0")}`;
    statements.push(
      [
        "INSERT INTO lead_activities (",
        "  id, lead_id, user_id, activity_type, title, description,",
        "  previous_stage, new_stage, created_at",
        ") VALUES (",
        [
          sqlString(activityId),
          sqlString(leadIdValue),
          nullable(userIdFor(users, followUp.createdBy)),
          sqlString(activityType),
          sqlString(
            followUp.status === "completed"
              ? `Follow-up completed: ${followUp.title}`
              : followUp.status === "cancelled"
                ? `Follow-up cancelled: ${followUp.title}`
                : `Follow-up scheduled: ${followUp.title}`,
          ),
          nullable(followUp.notes),
          "NULL",
          "NULL",
          sqlString(followUp.completedAt ?? createdAt),
        ].join(", "),
        ");",
      ].join("\n"),
    );

    const auditAction =
      followUp.status === "completed"
        ? "lead.follow_up_completed"
        : followUp.status === "cancelled"
          ? "lead.follow_up_cancelled"
          : "lead.follow_up_scheduled";
    const auditId = `ad000000-0000-4000-8000-${String(++auditCounter).padStart(
      12,
      "0",
    )}`;
    statements.push(
      [
        "INSERT INTO audit_logs (",
        "  id, user_id, action, entity_type, entity_id, metadata,",
        "  ip_address, created_at",
        ") VALUES (",
        [
          sqlString(auditId),
          nullable(userIdFor(users, followUp.createdBy)),
          sqlString(auditAction),
          "'lead'",
          sqlString(leadIdValue),
          sqlJson({
            leadNumber: `LD-${dateKey}-D${String(
              SEED_LEADS.findIndex((lead) => lead.key === followUp.leadKey) + 1,
            ).padStart(5, "0")}`,
            followUpId: id,
            scheduledAt: followUp.scheduledAt,
            status: followUp.status,
            seeded: true,
          }),
          "NULL",
          sqlString(followUp.completedAt ?? createdAt),
        ].join(", "),
        ");",
      ].join("\n"),
    );
  });

  runD1File(statements.join("\n"), { local: true });

  console.log("");
  console.log("Lead demo data seeded into the LOCAL D1 database.");
  console.log("");
  console.log(`  Leads:        ${SEED_LEADS.length}`);
  console.log(`  Follow-ups:   ${SEED_FOLLOW_UPS.length}`);
  console.log(`  Activities:   ${activityCounter}`);
  console.log(`  Audit events: ${auditCounter}`);
  console.log("");
  console.log("Sign in with one of the development accounts to explore the data:");
  console.log("  owner@shifranuha.dev   / Owner#12345!");
  console.log("  admin@shifranuha.dev   / Admin#12345!");
  console.log("  employee@shifranuha.dev / Employee#12345!");
  console.log("");
  console.log(
    "Re-running this script refreshes only these demo leads; app-created leads are untouched.",
  );
  console.log("These records are for local development only.");
}

try {
  main();
} catch (error) {
  console.error("");
  console.error(
    error instanceof Error ? error.message : "Lead demo seed failed.",
  );
  process.exitCode = 1;
}
