// =====================================================================
// api/pagination.ts — shared list pagination (page/limit → skip/take).
// =====================================================================

import type { Request } from "express";

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export function parsePagination(query: Request["query"]): Pagination {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function paginated<T>(data: T[], total: number, p: Pagination) {
  return {
    data,
    pagination: {
      total,
      page: p.page,
      limit: p.limit,
      pages: Math.ceil(total / p.limit),
    },
  };
}
