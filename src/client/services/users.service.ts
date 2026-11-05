import type { Paginated, UserDto } from "../../shared/types/api";
import type { Role } from "../../shared/types/roles";
import type { CreateEmployeeFormValues } from "../types/forms";
import { apiRequest } from "../lib/api";

export interface ListUsersParams {
  page: number;
  pageSize: number;
  search?: string;
  role?: Role | "";
  status?: "active" | "inactive" | "";
}

export const usersService = {
  list(params: ListUsersParams): Promise<Paginated<UserDto>> {
    const searchParams = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
    });

    if (params.search) {
      searchParams.set("search", params.search);
    }
    if (params.role) {
      searchParams.set("role", params.role);
    }
    if (params.status) {
      searchParams.set("status", params.status);
    }

    return apiRequest<Paginated<UserDto>>(
      `/users?${searchParams.toString()}`,
    );
  },

  get(id: string): Promise<UserDto> {
    return apiRequest<{ user: UserDto }>(`/users/${id}`).then(
      (result) => result.user,
    );
  },

  create(input: CreateEmployeeFormValues): Promise<UserDto> {
    return apiRequest<{ user: UserDto }>("/users", {
      method: "POST",
      body: input,
    }).then((result) => result.user);
  },

  update(
    id: string,
    input: { fullName?: string; role?: "admin" | "employee" },
  ): Promise<UserDto> {
    return apiRequest<{ user: UserDto }>(`/users/${id}`, {
      method: "PATCH",
      body: input,
    }).then((result) => result.user);
  },

  setActive(id: string, active: boolean): Promise<UserDto> {
    return apiRequest<{ user: UserDto }>(
      `/users/${id}/${active ? "activate" : "deactivate"}`,
      { method: "POST" },
    ).then((result) => result.user);
  },
};
