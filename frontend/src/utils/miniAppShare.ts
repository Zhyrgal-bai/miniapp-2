import { getTelegramWebApp } from "./telegram";

type TgShareWebApp = {
  shareUrl?: (url: string, callback?: (success: boolean) => void) => void;
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string) => void;
  HapticFeedback?: { impactOccurred?: (style: string) => void };
};

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* WebView may block async clipboard */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function hapticLight(): void {
  try {
    (getTelegramWebApp() as TgShareWebApp | undefined)?.HapticFeedback?.impactOccurred?.(
      "light",
    );
  } catch {
    /* ignore */
  }
}

export type MiniAppShareResult = "shared" | "copied" | "cancelled" | "failed";

/**
 * Share Mini App storefront link: Telegram share sheet first, then Web Share / clipboard.
 */
export async function shareMiniAppLink(
  url: string,
  text: string,
): Promise<MiniAppShareResult> {
  const trimmed = url.trim();
  if (trimmed === "") return "failed";

  const tg = getTelegramWebApp() as TgShareWebApp | undefined;
  const shareText = text.trim() || "Откройте наш магазин";

  if (typeof tg?.shareUrl === "function") {
    return new Promise((resolve) => {
      try {
        tg.shareUrl!(trimmed, (ok) => {
          if (ok) {
            hapticLight();
            resolve("shared");
          } else {
            resolve("cancelled");
          }
        });
      } catch {
        resolve("failed");
      }
    });
  }

  const telegramShareHref = `https://t.me/share/url?url=${encodeURIComponent(trimmed)}&text=${encodeURIComponent(shareText)}`;
  try {
    if (typeof tg?.openTelegramLink === "function") {
      tg.openTelegramLink(telegramShareHref);
      hapticLight();
      return "shared";
    }
    if (typeof tg?.openLink === "function") {
      tg.openLink(telegramShareHref);
      hapticLight();
      return "shared";
    }
  } catch {
    /* fall through */
  }

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: shareText, text: shareText, url: trimmed });
      hapticLight();
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }

  if (await copyTextToClipboard(trimmed)) {
    hapticLight();
    return "copied";
  }

  return "failed";
}
