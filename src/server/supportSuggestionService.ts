import type { SupportTicketType } from "@prisma/client";
import { orderSupportPhase, type SupportPhase } from "../shared/supportPhase.js";

export type SupportSuggestion = {
  id: string;
  label: string;
  text: string;
};

const PHASE_REPLIES: Record<SupportPhase, SupportSuggestion[]> = {
  PROCESSING: [
    {
      id: "proc_ack",
      label: "Приняли заказ",
      text: "Здравствуйте! Мы получили ваш заказ и уже обрабатываем его. Сообщим, когда будет готов к отправке.",
    },
    {
      id: "proc_eta",
      label: "Уточнить срок",
      text: "Здравствуйте! Заказ в обработке. Ориентировочный срок — 1–2 рабочих дня. Если нужно быстрее — напишите.",
    },
  ],
  SHIPPING: [
    {
      id: "ship_sent",
      label: "Отправлен",
      text: "Здравствуйте! Заказ отправлен. Трек-номер и детали доставки — в карточке заказа. Если не получите в срок — напишите.",
    },
    {
      id: "ship_delay",
      label: "Задержка",
      text: "Здравствуйте! Доставка немного задерживается. Мы на связи с курьером и сообщим обновление в течение дня.",
    },
  ],
  DELIVERED: [
    {
      id: "del_thanks",
      label: "Благодарность",
      text: "Спасибо за покупку! Если всё в порядке — будем рады отзыву. По любым вопросам — мы на связи.",
    },
    {
      id: "del_issue",
      label: "Проблема с заказом",
      text: "Здравствуйте! Опишите, пожалуйста, что не так с заказом (фото при необходимости). Разберёмся и предложим решение.",
    },
  ],
  CANCELLED: [
    {
      id: "cancel_info",
      label: "Заказ отменён",
      text: "Здравствуйте! Заказ отменён. Если отмена была ошибочной или нужна помощь с новым заказом — напишите.",
    },
  ],
};

const TYPE_REPLIES: Partial<Record<SupportTicketType, SupportSuggestion[]>> = {
  DELIVERY: [
    {
      id: "del_addr",
      label: "Уточнить адрес",
      text: "Здравствуйте! Уточните, пожалуйста, актуальный адрес и удобное время доставки.",
    },
    {
      id: "del_track",
      label: "Трекинг",
      text: "Здравствуйте! Статус доставки можно посмотреть в карточке заказа. Если трек не обновляется — проверим с курьером.",
    },
  ],
  RETURN: [
    {
      id: "ret_start",
      label: "Начало возврата",
      text: "Здравствуйте! Мы получили заявку на возврат. Подтвердите, пожалуйста, причину и состояние товара — подскажем следующие шаги.",
    },
    {
      id: "ret_approve",
      label: "Одобрен",
      text: "Здравствуйте! Возврат одобрен. Инструкция по отправке/передаче товара — в сообщении ниже.",
    },
  ],
  QUALITY: [
    {
      id: "qual_photo",
      label: "Запрос фото",
      text: "Здравствуйте! Пришлите, пожалуйста, фото проблемы — так быстрее решим вопрос (замена или возврат).",
    },
  ],
  TRACKING: [
    {
      id: "track_check",
      label: "Проверяем трек",
      text: "Здравствуйте! Проверяем статус отправления. Ответим с обновлением в ближайшее время.",
    },
  ],
};

export function buildSupportSuggestions(input: {
  ticketType: SupportTicketType;
  orderStatus?: string | null;
  lastCustomerText?: string | null;
}): SupportSuggestion[] {
  const out: SupportSuggestion[] = [];
  const phase = input.orderStatus
    ? orderSupportPhase(input.orderStatus)
    : "PROCESSING";
  out.push(...(PHASE_REPLIES[phase] ?? []));
  out.push(...(TYPE_REPLIES[input.ticketType] ?? []));

  const generic: SupportSuggestion[] = [
    {
      id: "gen_thanks",
      label: "Спасибо за обращение",
      text: "Здравствуйте! Спасибо за сообщение. Мы уже смотрим ваш вопрос и ответим в ближайшее время.",
    },
  ];
  out.push(...generic);

  const seen = new Set<string>();
  const deduped: SupportSuggestion[] = [];
  for (const s of out) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    deduped.push(s);
  }
  return deduped.slice(0, 6);
}
