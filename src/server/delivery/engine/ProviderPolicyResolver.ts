import { prisma } from "../../db.js";
import {
  defaultMerchantDeliveryProviderPolicy,
  extractProviderPolicyFromDeliverySettings,
  type MerchantDeliveryProviderPolicy,
} from "../../../shared/merchantDeliveryProviderPolicy.js";
import { listDeliveryEnginePlugins } from "./ProviderRegistry.js";

export type ProviderPolicyResolver = {
  resolve(merchantId: number): Promise<MerchantDeliveryProviderPolicy>;
  resolveProviderOrder(merchantId: number): Promise<string[]>;
};

export function createProviderPolicyResolver(): ProviderPolicyResolver {
  async function resolve(merchantId: number): Promise<MerchantDeliveryProviderPolicy> {
    const business = await prisma.business.findUnique({
      where: { id: merchantId },
      select: { deliverySettings: true },
    });
    if (!business) return defaultMerchantDeliveryProviderPolicy();
    return extractProviderPolicyFromDeliverySettings(business.deliverySettings);
  }

  async function resolveProviderOrder(merchantId: number): Promise<string[]> {
    const policy = await resolve(merchantId);
    const registered = new Set(listDeliveryEnginePlugins().map((p) => p.providerId));
    const ordered = policy.preferredProviders.filter((id) => registered.has(id));

    if (ordered.length > 0) return ordered;

    return [...registered];
  }

  return { resolve, resolveProviderOrder };
}

export const defaultProviderPolicyResolver = createProviderPolicyResolver();
