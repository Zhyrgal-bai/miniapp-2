/** Режим query статуса платежа (совпадает с FINIK_CREATE_API_MODE). */
export type FinikStatusApiMode = "legacy" | "official";

export type FinikStatusBusinessCredentials = {
  finikApiKey: string | null;
  finikAccountId: string | null;
  finikSecret: string | null;
};

export type FinikPaymentStatusResult =
  | {
      ok: true;
      status: string;
      amount: number | null;
      apiMode: FinikStatusApiMode;
    }
  | {
      ok: false;
      error: string;
      apiMode?: FinikStatusApiMode;
      retryable?: boolean;
    };
