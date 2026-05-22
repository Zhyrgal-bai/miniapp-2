import { useEffect, useState } from "react";
import {
  refreshTelegramSessionAssessment,
  telegramSessionFailureMessage,
  type TelegramInitDataAssessment,
  type TelegramSessionFailureReason,
  waitForTelegramInitDataResult,
} from "../../utils/telegramSession";
import { getTelegramWebApp } from "../../utils/telegram";

type GateState =
  | "checking"
  | "ready"
  | "missing"
  | "stale"
  | "invalid"
  | "timeout";

type Props = {
  children: React.ReactNode;
};

function gateStateFromFailure(
  assessment: TelegramInitDataAssessment,
  reason: TelegramSessionFailureReason,
): GateState {
  if (assessment === "stale" || reason === "stale") return "stale";
  if (assessment === "invalid" || reason === "invalid") return "invalid";
  if (reason === "timeout" || assessment === "loading") return "timeout";
  return "missing";
}

function gateCopy(state: GateState): { title: string; text: string } {
  switch (state) {
    case "stale":
      return {
        title: "Сессия Telegram устарела",
        text: telegramSessionFailureMessage("stale"),
      };
    case "invalid":
      return {
        title: "Ошибка данных Telegram",
        text: telegramSessionFailureMessage("invalid"),
      };
    case "timeout":
      return {
        title: "Подключение к Telegram",
        text: telegramSessionFailureMessage("timeout"),
      };
    case "missing":
    default:
      return {
        title: "Нужна сессия Telegram",
        text: telegramSessionFailureMessage("empty"),
      };
  }
}

export default function TelegramSessionGate({ children }: Props) {
  const [state, setState] = useState<GateState>("checking");

  useEffect(() => {
    let cancelled = false;

    const check = async (quick: boolean) => {
      setState("checking");
      const out = quick
        ? await refreshTelegramSessionAssessment()
        : await (async () => {
            const wait = await waitForTelegramInitDataResult({
              timeoutMs: 4_500,
              pollMs: 100,
              stableTicks: 2,
            });
            return {
              assessment: wait.ok ? ("ready" as const) : wait.assessment,
              wait,
            };
          })();

      if (cancelled) return;

      if (out.wait.ok || out.assessment === "ready") {
        setState("ready");
        return;
      }

      setState(gateStateFromFailure(out.assessment, out.wait.reason));
    };

    void check(false);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void check(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="telegram-session-gate">
        <p className="muted">Подключение к Telegram…</p>
      </div>
    );
  }

  if (state === "ready") {
    return <>{children}</>;
  }

  const copy = gateCopy(state);
  const tg = getTelegramWebApp();

  return (
    <div className="telegram-session-gate">
      <h2 className="telegram-session-gate__title">{copy.title}</h2>
      <p className="telegram-session-gate__text">{copy.text}</p>
      <div className="telegram-session-gate__actions">
        <button
          type="button"
          className="admin-submit-btn"
          onClick={() => window.location.reload()}
        >
          Обновить
        </button>
        {typeof (tg as { close?: () => void } | undefined)?.close ===
        "function" ? (
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
