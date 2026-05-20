import { MESSAGE_SENDER_CUSTOMER_RU } from "@repo-shared/supportLabels";
import type { SupportMessageRow } from "../../services/supportCustomerApi";
import "./supportUi.css";

function senderLabel(senderType: string): string {
  const key = String(senderType ?? "").trim().toUpperCase();
  return MESSAGE_SENDER_CUSTOMER_RU[key] ?? "Поддержка";
}

function displayWho(
  senderType: string,
  perspective: "customer" | "merchant",
  customerAvatarName: string,
  merchantAvatarName: string
): string {
  const st = String(senderType ?? "").trim().toUpperCase();
  if (st === "SYSTEM") return MESSAGE_SENDER_CUSTOMER_RU.SYSTEM ?? "Поддержка";
  if (perspective === "merchant") {
    if (st === "CUSTOMER") return customerAvatarName;
    if (st === "MERCHANT") return "Вы";
  }
  if (st === "MERCHANT") return merchantAvatarName;
  return senderLabel(st);
}

function attachmentUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

type SupportChatMessagesProps = {
  messages: SupportMessageRow[];
  merchantAvatarName?: string | null;
  merchantPhotoUrl?: string | null;
  customerAvatarName?: string | null;
  /** Who sees their messages on the right (default: customer). */
  perspective?: "customer" | "merchant";
};

export function SupportChatMessages({
  messages,
  merchantAvatarName = "Магазин",
  merchantPhotoUrl,
  customerAvatarName = "Покупатель",
  perspective = "customer",
}: SupportChatMessagesProps) {
  return (
    <ul className="sf-support-chat" aria-live="polite">
      {messages.map((m, i) => {
        const st = String(m.senderType ?? "").toUpperCase();
        const isMine =
          perspective === "merchant"
            ? st === "MERCHANT"
            : st === "CUSTOMER";
        const isSystem = st === "SYSTEM";
        const photos = attachmentUrls(m.attachments);
        return (
          <li
            key={m.id ?? `m-${i}`}
            className={`sf-support-chat__row${isMine ? " sf-support-chat__row--mine" : ""}${isSystem ? " sf-support-chat__row--system" : ""}`}
          >
            {!isMine && !isSystem ? (
              <span className="sf-support-chat__avatar" aria-hidden>
                {perspective === "merchant" && st === "CUSTOMER" ? (
                  <span>{customerAvatarName?.charAt(0).toUpperCase() ?? "П"}</span>
                ) : merchantPhotoUrl ? (
                  <img src={merchantPhotoUrl} alt="" />
                ) : (
                  <span>{merchantAvatarName?.charAt(0).toUpperCase() ?? "М"}</span>
                )}
              </span>
            ) : null}
            <div className="sf-support-chat__bubble-wrap">
              {!isMine ? (
                <span className="sf-support-chat__who">
                  {displayWho(
                    st,
                    perspective,
                    customerAvatarName ?? "Покупатель",
                    merchantAvatarName ?? "Магазин"
                  )}
                </span>
              ) : null}
              <div className="sf-support-chat__bubble">
                <p className="sf-support-chat__text">{m.text}</p>
                {photos.length > 0 ? (
                  <div className="sf-support-chat__photos">
                    {photos.map((url) => (
                      <a
                        key={url}
                        className="sf-support-chat__photo"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img src={url} alt="Вложение" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
