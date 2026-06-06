import { useEffect, useState } from "react";
import { OpenInTelegramCta } from "./OpenInTelegramCta";
import { OPEN_IN_TELEGRAM_MODAL_EVENT } from "../../../storefront/openInTelegramModal";
import { useBodyScrollLock } from "../../../utils/bodyScrollLock";
import "./openInTelegramModal.css";

type ModalState = {
  open: boolean;
  telegramOpenUrl: string | null;
};

export function OpenInTelegramModal(props: {
  defaultTelegramOpenUrl?: string | null;
}): React.ReactElement | null {
  const [state, setState] = useState<ModalState>({
    open: false,
    telegramOpenUrl: props.defaultTelegramOpenUrl ?? null,
  });

  useBodyScrollLock(state.open);

  useEffect(() => {
    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ telegramOpenUrl?: string | null }>)
        .detail;
      setState({
        open: true,
        telegramOpenUrl:
          typeof detail?.telegramOpenUrl === "string"
            ? detail.telegramOpenUrl
            : props.defaultTelegramOpenUrl ?? null,
      });
    };
    window.addEventListener(
      OPEN_IN_TELEGRAM_MODAL_EVENT,
      onOpen as EventListener,
    );
    return () =>
      window.removeEventListener(
        OPEN_IN_TELEGRAM_MODAL_EVENT,
        onOpen as EventListener,
      );
  }, [props.defaultTelegramOpenUrl]);

  if (!state.open) return null;

  const close = () => setState((s) => ({ ...s, open: false }));

  return (
    <div
      className="sf-tg-modal-backdrop"
      role="presentation"
      onClick={close}
    >
      <div
        className="sf-tg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf-tg-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sf-tg-modal-title" className="sf-tg-modal__title">
          Для оформления заказа откройте магазин в Telegram
        </h2>
        <p className="sf-tg-modal__text">
          ARCHA использует Telegram Mini App для безопасной оплаты и
          отслеживания заказов.
        </p>
        <div className="sf-tg-modal__actions">
          <OpenInTelegramCta
            telegramOpenUrl={state.telegramOpenUrl}
            variant="hero"
            className="sf-tg-modal__open"
          />
          <button type="button" className="sf-tg-modal__close" onClick={close}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
