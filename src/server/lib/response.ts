import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { PaginationMeta } from "../../shared/types/api";

export function ok<T>(
  c: Context,
  data: T,
  status: ContentfulStatusCode = 200,
): Response {
  return c.json({ data }, status);
}

export function paginated<T>(
  c: Context,
  items: T[],
  pagination: PaginationMeta,
): Response {
  return c.json({ data: { items, pagination } });
}

export function buildPagination(
  page: number,
  pageSize: number,
  total: number,
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}
