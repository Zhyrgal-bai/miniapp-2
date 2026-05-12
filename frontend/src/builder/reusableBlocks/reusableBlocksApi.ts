import { api } from "../../services/api";

export type ReusableBlockDTO = {
  id: number;
  businessId: number;
  storefrontId: number | null;
  type: string;
  name: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function fetchReusableBlocks(params?: {
  type?: string;
}): Promise<ReusableBlockDTO[]> {
  const res = await api.get("/api/merchant/reusable-blocks", {
    params: params?.type ? { type: params.type } : {},
  });
  const data = res.data as { blocks?: unknown };
  return Array.isArray(data?.blocks) ? (data.blocks as ReusableBlockDTO[]) : [];
}

export async function createReusableBlock(input: {
  name: string;
  type: string;
  config: Record<string, unknown>;
}): Promise<ReusableBlockDTO> {
  const res = await api.post("/api/merchant/reusable-blocks", input);
  const data = res.data as { block?: ReusableBlockDTO };
  if (!data.block) throw new Error("Некорректный ответ сервера");
  return data.block;
}

export async function deleteReusableBlock(id: number): Promise<void> {
  await api.delete(`/api/merchant/reusable-blocks/${id}`);
}

