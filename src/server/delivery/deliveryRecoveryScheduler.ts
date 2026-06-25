import { runDeliveryRecoveryOnce } from "./services/deliveryRecoveryService.js";
import {
  getDeliveryRecoveryIntervalMs,
  isDeliveryRecoveryEnabled,
} from "./services/deliveryRecoveryConfig.js";

/** Periodic polling for missed Yandex webhooks and recovery retries. */
export function startDeliveryRecoveryScheduler(): void {
  if (!isDeliveryRecoveryEnabled()) {
    console.log("deliveryRecovery: disabled (DELIVERY_RECOVERY_ENABLED)");
    return;
  }

  const intervalMs = getDeliveryRecoveryIntervalMs();

  const run = async () => {
    try {
      await runDeliveryRecoveryOnce();
    } catch (e) {
      console.error("deliveryRecovery:", e);
    }
  };

  void run();
  setInterval(() => void run(), intervalMs);

  console.log(
    `deliveryRecovery: scheduler every ${Math.round(intervalMs / 1000)}s`,
  );
}
