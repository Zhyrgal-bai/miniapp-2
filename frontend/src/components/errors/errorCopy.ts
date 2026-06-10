/** ARCHA universal error copy — presentation only (Phase 17.4). */

export type ErrorKind =
  | "not_found"
  | "no_tenant"
  | "merchant_not_found"
  | "crash"
  | "load_failed";

export type ErrorCopy = {
  code: string;
  title: string;
  hint: string;
};

export const ARCHA_ERROR_COPY: Record<ErrorKind, ErrorCopy> = {
  not_found: {
    code: "404",
    title: "Страница не найдена",
    hint: "Проверьте ссылку или вернитесь на главную ARCHA.",
  },
  no_tenant: {
    code: "—",
    title: "Не удалось открыть витрину",
    hint:
      "Откройте Mini App через кнопку «Открыть» в Telegram. Старые ссылки ?shop=ID и ?businessId=ID поддерживаются и будут перенаправлены на /s/slug.",
  },
  merchant_not_found: {
    code: "404",
    title: "Магазин не найден",
    hint: "Магазин не найден. Проверьте ссылку или откройте витрину через Telegram.",
  },
  crash: {
    code: "—",
    title: "Не удалось открыть приложение",
    hint: "Произошла ошибка при загрузке. Закройте Mini App и откройте снова из бота.",
  },
  load_failed: {
    code: "—",
    title: "Что-то пошло не так",
    hint: "Не удалось загрузить данные. Попробуйте ещё раз.",
  },
};

export function storeNotFoundCopy(slug?: string | null): ErrorCopy {
  const base = ARCHA_ERROR_COPY.merchant_not_found;
  if (slug?.trim()) {
    return {
      ...base,
      hint: `Магазин «${slug.trim()}» не найден. Проверьте ссылку или откройте витрину через Telegram.`,
    };
  }
  return base;
}
