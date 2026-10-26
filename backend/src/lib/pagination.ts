import type { Request } from "express";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export type PageParams = {
  page: number;
  limit: number;
  skip: number;
};

export function parsePage(req: Request, defaults?: { limit?: number; max?: number }): PageParams {
  const max = defaults?.max ?? MAX_LIMIT;
  const fallback = defaults?.limit ?? DEFAULT_LIMIT;
  const rawPage = Number(req.query.page);
  const rawLimit = Number(req.query.limit);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1
    ? Math.min(Math.floor(rawLimit), max)
    : Math.min(fallback, max);
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
