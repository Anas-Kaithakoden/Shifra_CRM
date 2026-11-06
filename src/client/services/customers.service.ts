import type { Paginated } from "../../shared/types/api";
import type {
  CustomerActivityType,
  CustomerServiceCategory,
  CustomerSortField,
  CustomerStatus,
  CustomerType,
  ManualCustomerActivityType,
} from "../../shared/constants/customers";
import type {
  ConvertLeadInput,
  ConvertLeadResultDto,
  CustomerActivityDto,
  CustomerContactDto,
  CustomerDashboardStatsDto,
  CustomerServiceDto,
  CustomerServiceInput,
  CustomerDetailDto,
  CustomerLeadDto,
  CustomerListItemDto,
  CustomerRenewalListDto,
  DuplicateCustomerDto,
} from "../../shared/types/customers";
import { apiRequest } from "../lib/api";

export interface CustomerListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CustomerStatus;
  type?: CustomerType;
  assignedTo?: string;
  scope?: "all" | "my";
  sortBy?: CustomerSortField;
  sortDir?: "asc" | "desc";
  includeArchived?: boolean;
}

export interface CustomerCreateInput {
  type: CustomerType;
  name: string;
  businessName?: string;
  phone: string;
  email?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  serviceName?: string;
  serviceCategory?: CustomerServiceCategory;
  totalCost?: number;
  profit?: number;
  serviceDeliveredOn?: string;
  renewalOn?: string;
  status?: "active" | "inactive";
  assignedTo?: string;
  allowDuplicate?: boolean;
}

export interface CustomerUpdateInput {
  type?: CustomerType;
  name?: string;
  businessName?: string | null;
  phone?: string;
  email?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  notes?: string | null;
  serviceName?: string | null;
  serviceCategory?: CustomerServiceCategory | null;
  totalCost?: number | null;
  profit?: number | null;
  serviceDeliveredOn?: string | null;
  renewalOn?: string | null;
  status?: "active" | "inactive";
  assignedTo?: string | null;
  allowDuplicate?: boolean;
}

export interface CustomerContactInput {
  fullName: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
  notes?: string;
}

export interface CustomerContactUpdateInput {
  fullName?: string;
  jobTitle?: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

export interface CustomerActivityInput {
  activityType: ManualCustomerActivityType;
  title: string;
  description?: string;
  occurredAt?: string;
}

function toQuery(params: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === false) {
      continue;
    }
    searchParams.set(key, String(value));
  }
  return searchParams.toString();
}

export const customersService = {
  list(params: CustomerListParams = {}): Promise<Paginated<CustomerListItemDto>> {
    return apiRequest<Paginated<CustomerListItemDto>>(
      `/customers?${toQuery({ ...params })}`,
    );
  },

  get(id: string): Promise<CustomerDetailDto> {
    return apiRequest<{ customer: CustomerDetailDto }>(`/customers/${id}`).then(
      (result) => result.customer,
    );
  },

  create(input: CustomerCreateInput): Promise<CustomerDetailDto> {
    return apiRequest<{ customer: CustomerDetailDto }>("/customers", {
      method: "POST",
      body: input,
    }).then((result) => result.customer);
  },

  update(id: string, input: CustomerUpdateInput): Promise<CustomerDetailDto> {
    return apiRequest<{ customer: CustomerDetailDto }>(`/customers/${id}`, {
      method: "PATCH",
      body: input,
    }).then((result) => result.customer);
  },

  archive(id: string): Promise<CustomerDetailDto> {
    return apiRequest<{ customer: CustomerDetailDto }>(
      `/customers/${id}/archive`,
      { method: "POST" },
    ).then((result) => result.customer);
  },

  deletePermanently(id: string): Promise<void> {
    return apiRequest<{ deleted: boolean }>(`/customers/${id}/permanent`, {
      method: "DELETE",
    }).then(() => undefined);
  },

  restore(id: string): Promise<CustomerDetailDto> {
    return apiRequest<{ customer: CustomerDetailDto }>(
      `/customers/${id}/restore`,
      { method: "POST" },
    ).then((result) => result.customer);
  },

  checkDuplicates(params: {
    phone?: string;
    email?: string;
    businessName?: string;
    excludeId?: string;
  }): Promise<DuplicateCustomerDto[]> {
    return apiRequest<{ duplicates: DuplicateCustomerDto[] }>(
      `/customers/duplicates?${toQuery({ ...params })}`,
    ).then((result) => result.duplicates);
  },

  listContacts(id: string): Promise<CustomerContactDto[]> {
    return apiRequest<{ contacts: CustomerContactDto[] }>(
      `/customers/${id}/contacts`,
    ).then((result) => result.contacts);
  },

  addContact(
    id: string,
    input: CustomerContactInput,
  ): Promise<CustomerContactDto> {
    return apiRequest<{ contact: CustomerContactDto }>(
      `/customers/${id}/contacts`,
      { method: "POST", body: input },
    ).then((result) => result.contact);
  },

  updateContact(
    id: string,
    contactId: string,
    input: CustomerContactUpdateInput,
  ): Promise<CustomerContactDto> {
    return apiRequest<{ contact: CustomerContactDto }>(
      `/customers/${id}/contacts/${contactId}`,
      { method: "PATCH", body: input },
    ).then((result) => result.contact);
  },

  removeContact(id: string, contactId: string): Promise<void> {
    return apiRequest<{ removed: boolean }>(
      `/customers/${id}/contacts/${contactId}`,
      { method: "DELETE" },
    ).then(() => undefined);
  },

  listActivities(
    id: string,
    params: { page?: number; pageSize?: number; activityType?: CustomerActivityType } = {},
  ): Promise<Paginated<CustomerActivityDto>> {
    return apiRequest<Paginated<CustomerActivityDto>>(
      `/customers/${id}/activities?${toQuery({
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 50,
        activityType: params.activityType,
      })}`,
    );
  },

  addActivity(
    id: string,
    input: CustomerActivityInput,
  ): Promise<CustomerActivityDto> {
    return apiRequest<{ activity: CustomerActivityDto }>(
      `/customers/${id}/activities`,
      { method: "POST", body: input },
    ).then((result) => result.activity);
  },

  addNote(id: string, note: string): Promise<CustomerActivityDto> {
    return apiRequest<{ note: CustomerActivityDto }>(
      `/customers/${id}/notes`,
      { method: "POST", body: { note } },
    ).then((result) => result.note);
  },

  listLeads(id: string): Promise<CustomerLeadDto[]> {
    return apiRequest<{ leads: CustomerLeadDto[] }>(
      `/customers/${id}/leads`,
    ).then((result) => result.leads);
  },

  linkLead(
    id: string,
    leadId: string,
  ): Promise<{ customer: CustomerDetailDto; alreadyLinked: boolean }> {
    return apiRequest<{ customer: CustomerDetailDto; alreadyLinked: boolean }>(
      `/customers/${id}/leads`,
      { method: "POST", body: { leadId } },
    );
  },

  convertLead(
    leadId: string,
    input: ConvertLeadInput,
  ): Promise<ConvertLeadResultDto> {
    return apiRequest<ConvertLeadResultDto>(
      `/leads/${leadId}/convert-to-customer`,
      { method: "POST", body: input },
    );
  },

  addService(
    id: string,
    input: CustomerServiceInput,
  ): Promise<CustomerServiceDto> {
    return apiRequest<{ service: CustomerServiceDto }>(
      `/customers/${id}/services`,
      { method: "POST", body: input },
    ).then((result) => result.service);
  },

  listRenewals(params: {
    filter?: "all" | "overdue" | "due_soon" | "upcoming" | "next_30";
    page?: number;
    pageSize?: number;
  } = {}): Promise<CustomerRenewalListDto> {
    return apiRequest<CustomerRenewalListDto>(
      `/customers/renewals?${toQuery({
        filter: params.filter ?? "all",
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      })}`,
    );
  },

  dashboardStats(): Promise<CustomerDashboardStatsDto> {
    return apiRequest<CustomerDashboardStatsDto>("/dashboard/customer-stats");
  },
};
