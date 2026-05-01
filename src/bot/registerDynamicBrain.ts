/**
 * Сайд‑эффект при старте процесса: связывает SaaS-ботов из `dynamicBots.ts` с полным телом из `attachBotHandlers`
 * без циклического `dynamic import("./bot.js")` изнутри `registerDynamicUserBot` (там экспорт мог быть ещё пустым).
 */
import type { Telegraf } from "telegraf";
import { attachBotHandlers } from "./bot.js";
import { setAttachDynamicHandlers } from "./dynamicBots.js";

setAttachDynamicHandlers((tg: Telegraf, businessId: number) => {
  attachBotHandlers(tg, { type: "dynamic", businessId });
});
