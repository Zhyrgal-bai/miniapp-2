import { useEffect, useState } from "react";
import {
  hasVerifiedTelegramInitData,
  waitForTelegramInitData,
} from "../../utils/waitForTelegramInitData";
import { getTelegramWebApp } from "../../utils/telegram";

type GateState = "checking" | "ready" | "missing";

type Props = {
  children: React.ReactNode;
};

export default function TelegramSessionGate({ children }: Props) {
  const [state, setState] = useState<GateState>("checking");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const initData = await waitForTelegramInitData();
      if (cancelled) return;
      setState(
        hasVerifiedTelegramInitData(initData) ? "ready" : "missing",
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="telegram-session-gate">
        <p className="muted">Подключение к Telegram…</p>
      </div>
    );
  }

  if (state === "missing") {
    const tg = getTelegramWebApp();
    return (
      <div className="telegram-session-gate">
        <h2 className="telegram-session-gate__title">Нужна сессия Telegram</h2>
        <p className="telegram-session-gate__text">
          Для админ-панели нужны данные Mini App. Закройте это окно и откройте
          магазин снова из бота в Telegram.
        </p>
        <div className="telegram-session-gate__actions">
          <button
            type="button"
            className="admin-submit-btn"
            onClick={() => window.location.reload()}
          >
            Обновить
          </button>
          {typeof (tg as unknown as { close?: () => void } | undefined)
            ?.close === "function" ? (
            <button
              type="button"
              className="admin-secondary-btn"
              onClick={() =>
                (tg as unknown as { close: () => void }).close()
              }
            >
              Закрыть Mini App
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
