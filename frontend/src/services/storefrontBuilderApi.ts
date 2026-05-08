import { api } from "./api";
import type { ResolvedStoreTheme } from "@repo-shared/storeTheme";

export type BuilderSection = {
  id: string;
  type: string;
  enabled?: boolean;
  order?: number;
  config: Record<string, unknown>;
};

export type BuilderConfig = {
  version: number;
  sections: BuilderSection[];
  storefrontHeaderConfig?: Record<string, unknown>;
  storefrontCardConfig?: Record<string, unknown>;
};

export type StorefrontBuilderState = {
  businessId: number;
  draft: BuilderConfig;
  published: BuilderConfig;
  publishedAt: string | null;
  themeConfig: Record<string, unknown>;
  templateId: string | null;
  featureFlags: Record<string, unknown>;
  preview: unknown;
  ux?: { errors?: unknown[]; warnings?: unknown[] };
};

export async function fetchStorefrontBuilderState(params: {
  userId: number;
}): Promise<StorefrontBuilderState> {
  const res = await api.get<StorefrontBuilderState>("/api/merchant/storefront-builder", {
    params: { userId: params.userId },
  });
  return res.data as StorefrontBuilderState;
}

export async function saveStorefrontBuilderDraft(params: {
  userId: number;
  draftConfig: BuilderConfig;
  themePatch?: Partial<ResolvedStoreTheme> | null;
}): Promise<{ ok: true; draftVersion: number; ux?: unknown }> {
  const res = await api.put("/api/merchant/storefront-builder/draft", {
    userId: params.userId,
    draftConfig: params.draftConfig,
    ...(params.themePatch ? { themePatch: params.themePatch } : {}),
  });
  return res.data as { ok: true; draftVersion: number; ux?: unknown };
}

export async function publishStorefrontBuilderDraft(params: {
  userId: number;
}): Promise<{ ok: true; publishedAt: string; ux?: unknown }> {
  const res = await api.post("/api/merchant/storefront-builder/publish", {
    userId: params.userId,
  });
  return res.data as { ok: true; publishedAt: string; ux?: unknown };
}

export async function resetStorefrontBuilderDraft(params: {
  userId: number;
}): Promise<{ ok: true; draft: unknown }> {
  const res = await api.post("/api/merchant/storefront-builder/reset", {
    userId: params.userId,
  });
  return res.data as { ok: true; draft: unknown };
}

