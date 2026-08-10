import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { serverApiGet } from "@/lib/server-api";
import type { OrderDetail } from "@/lib/types";

export async function getV2Order(id: string): Promise<OrderDetail> {
  try {
    return await serverApiGet<OrderDetail>(`/api/orders/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
