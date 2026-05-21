import { useEffect } from "react";

type BackBtn = {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
};

function parseBackButton(tg: unknown): BackBtn | null {
  const bb = (tg as { BackButton?: Partial<BackBtn> } | undefined)?.BackButton;
  if (
    bb &&
    typeof bb.show === "function" &&
    typeof bb.hide === "function" &&
    typeof bb.onClick === "function" &&
    typeof bb.offClick === "function"
  ) {
    return bb as BackBtn;
  }
  return null;
}

/** Show Telegram OS back button when `visible`; calls `onBack` on click. */
export function useTelegramBackButton(
  visible: boolean,
  onBack: () => void,
): void {
  useEffect(() => {
    const tg = (window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp;
    const bb = parseBackButton(tg);
    if (!bb) return;

    const handler = () => onBack();
    if (visible) {
      bb.show();
      bb.onClick(handler);
    } else {
      bb.hide();
    }
    return () => {
      bb.offClick(handler);
      bb.hide();
    };
  }, [visible, onBack]);
}
