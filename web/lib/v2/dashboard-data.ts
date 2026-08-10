import type { OrderSummary, Paginated } from "@/lib/types";
import { dashboardMonths, type DashboardMonth } from "./dashboard-model";

export interface DashboardData {
  draftCount: number;
  confirmedCount: number;
  confirmedValue: number;
  months: DashboardMonth[];
  recentOrders: OrderSummary[];
}

export type DashboardGet = <T>(path: string) => Promise<T>;

/**
 * Load only approved dashboard sources. Confirmed orders are paged to
 * completion before the UTC six-month value is summed.
 */
export async function loadDashboardData(
  get: DashboardGet,
  now: Date = new Date(),
): Promise<DashboardData> {
  const [drafts, confirmed, recent, confirmedFirstPage] = await Promise.all([
    get<Paginated<OrderSummary>>("/api/orders?status=draft&page=1&limit=1"),
    get<Paginated<OrderSummary>>("/api/orders?status=confirmed&page=1&limit=1"),
    get<Paginated<OrderSummary>>("/api/orders?page=1&limit=5"),
    get<Paginated<OrderSummary>>("/api/orders?status=confirmed&page=1&limit=100"),
  ]);

  const confirmedOrders = [...confirmedFirstPage.data];
  for (let page = 2; page <= confirmedFirstPage.pagination.pages; page += 1) {
    const nextPage = await get<Paginated<OrderSummary>>(
      `/api/orders?status=confirmed&page=${page}&limit=100`,
    );
    confirmedOrders.push(...nextPage.data);
  }

  const months = dashboardMonths(confirmedOrders, now);

  return {
    draftCount: drafts.pagination.total,
    confirmedCount: confirmed.pagination.total,
    confirmedValue: months.reduce((sum, month) => sum + month.value, 0),
    months,
    recentOrders: recent.data.slice(0, 5),
  };
}
