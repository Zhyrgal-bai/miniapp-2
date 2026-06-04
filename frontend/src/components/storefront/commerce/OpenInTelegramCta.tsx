import type { ReactElement } from "react";
import { openTelegramExternalLink } from "../../../utils/telegramWebAppBootstrap";
import "./openInTelegramCta.css";

export function OpenInTelegramCta(props: {
  telegramOpenUrl: string | null | undefined;
  variant?: "hero" | "inline" | "sticky";
  className?: string;
}): ReactElement {
  const url = typeof props.telegramOpenUrl === "string" ? props.telegramOpenUrl.trim() : "";
  const variant = props.variant ?? "inline";
  const cls = [
    "sf-open-tg",
    `sf-open-tg--${variant}`,
    props.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (url === "") {
    return (
      <div className={`${cls} sf-open-tg--disabled`} role="status">
        <span className="sf-open-tg__label">Магазин в Telegram</span>
        <span className="sf-open-tg__hint">
          Ссылка на бота пока недоступна. Откройте магазин через бота в Telegram.
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      onClick={() => openTelegramExternalLink(url)}
    >
      <span className="sf-open-tg__icon" aria-hidden>
        ✈
      </span>
      <span className="sf-open-tg__label">Открыть в Telegram</span>
    </button>
  );
}
