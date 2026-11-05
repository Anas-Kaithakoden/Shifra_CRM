/**
 * Shifra Nuha Technologies service catalogue.
 *
 * Kept in the shared layer so the future Projects module can reuse the same
 * categories and services. UI code must read from this catalogue instead of
 * hardcoding service names.
 */

export interface ServiceCategory {
  key: string;
  label: string;
  services: readonly string[];
}

export const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  {
    key: "business_solutions",
    label: "Business Solutions",
    services: [
      "LLP Registration",
      "Private Limited Company Registration",
      "GST Registration",
      "Income Tax Filing",
      "Accounting",
      "Bookkeeping",
      "Auditing",
      "Trademark Registration",
      "MSME Registration",
      "Project Reports",
    ],
  },
  {
    key: "digital_solutions",
    label: "Digital Solutions",
    services: [
      "Website Design & Development",
      "ERP & Business Management Software",
      "Billing & Inventory Systems",
      "CRM & Lead Management",
      "WhatsApp Automation & Chatbots",
      "Cloud Hosting & Technical Support",
      "Custom Business Applications",
      "AI Solutions & Workflow Automation",
    ],
  },
  {
    key: "branding_creative",
    label: "Branding & Creative",
    services: [
      "Logo Design",
      "Brand Identity & Guidelines",
      "Business Cards & Letterheads",
      "Company Profiles & Brochures",
      "Product Catalogues",
      "Promotional Creatives",
    ],
  },
] as const;

export const OTHER_SERVICE = "Other";

export const SERVICE_OPTIONS: readonly {
  value: string;
  label: string;
  category: string;
}[] = [
  ...SERVICE_CATEGORIES.flatMap((category) =>
    category.services.map((service) => ({
      value: service,
      label: service,
      category: category.label,
    })),
  ),
  {
    value: OTHER_SERVICE,
    label: OTHER_SERVICE,
    category: "Other",
  },
];

export function findServiceCategory(service: string): string | null {
  return (
    SERVICE_OPTIONS.find((option) => option.value === service)?.category ?? null
  );
}

export function isKnownService(service: string): boolean {
  return SERVICE_OPTIONS.some((option) => option.value === service);
}
