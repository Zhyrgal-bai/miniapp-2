import type {
  DeliveryProviderPort,
  ProviderCreateDeliveryInput,
  ProviderCreateDeliveryResult,
} from "../deliveryProviderPort.js";
import {
  defaultYandexClaimsAcceptService,
  type YandexClaimsAcceptService,
} from "./services/YandexClaimsAcceptService.js";
import {
  defaultYandexClaimsCreateService,
  type YandexClaimsCreateService,
} from "./services/YandexClaimsCreateService.js";
import type { YandexHttpFetch } from "./client/yandexHttpClient.js";
import type { YandexClaimsCreateFailure } from "./adapters/yandexClaimsAdapter.js";
import type { ProviderDeliveryFailureCode } from "../../types/providerDeliveryTypes.js";

function mapClaimsCode(
  code: YandexClaimsCreateFailure["code"],
): ProviderDeliveryFailureCode {
  switch (code) {
    case "validation_error":
      return "invalid_order";
    case "timeout":
      return "provider_timeout";
    case "rate_limited":
      return "provider_rate_limit";
    case "network_error":
    case "not_configured":
      return "provider_unavailable";
    default:
      return "unknown_provider_error";
  }
}

const CLAIMS_ERROR_MESSAGES: Record<YandexClaimsCreateFailure["code"], string> = {
  validation_error: "Некорректные данные для создания доставки.",
  timeout: "Сервис доставки не ответил вовремя.",
  rate_limited: "Сервис доставки временно перегружен.",
  network_error: "Сервис доставки временно недоступен.",
  not_configured: "Сервис доставки не настроен.",
  api_error: "Не удалось создать доставку.",
};

export type YandexDeliveryProviderDeps = {
  createService?: YandexClaimsCreateService;
  acceptService?: YandexClaimsAcceptService;
  fetchImpl?: YandexHttpFetch;
};

export class YandexDeliveryProvider implements DeliveryProviderPort {
  readonly providerId = "yandex" as const;

  private readonly createService: YandexClaimsCreateService;
  private readonly acceptService: YandexClaimsAcceptService;
  private readonly fetchImpl: YandexHttpFetch | undefined;

  constructor(deps: YandexDeliveryProviderDeps = {}) {
    this.createService = deps.createService ?? defaultYandexClaimsCreateService;
    this.acceptService = deps.acceptService ?? defaultYandexClaimsAcceptService;
    this.fetchImpl = deps.fetchImpl;
  }

  async createAndAccept(
    input: ProviderCreateDeliveryInput,
  ): Promise<ProviderCreateDeliveryResult> {
    const ctx = {
      merchantId: input.merchantId,
      orderId: input.orderId,
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    };

    const createResult = await this.createService.create(
      {
        offerPayload: input.offerPayload,
        pickup: input.pickup,
        delivery: input.delivery,
        weightKg: input.weightKg,
      },
      ctx,
      { ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}) },
    );

    if (!createResult.ok) {
      const code = mapClaimsCode(createResult.code);
      return {
        ok: false,
        code,
        message: CLAIMS_ERROR_MESSAGES[createResult.code] ?? "Не удалось создать доставку.",
      };
    }

    const acceptResult = await this.acceptService.accept(
      createResult.providerClaimId,
      ctx,
      { ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}) },
    );

    if (!acceptResult.ok) {
      const code = mapClaimsCode(acceptResult.code);
      return {
        ok: false,
        code,
        message: CLAIMS_ERROR_MESSAGES[acceptResult.code] ?? "Не удалось подтвердить доставку.",
      };
    }

    return {
      ok: true,
      providerClaimId: acceptResult.providerClaimId,
      status: "SEARCHING_COURIER",
      price: input.price,
      currency: input.currency,
      internalPayload: {
        ...createResult.internalPayload,
        ...acceptResult.internalPayload,
      },
    };
  }
}
