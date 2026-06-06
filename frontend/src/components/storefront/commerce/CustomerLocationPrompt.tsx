import type { ReactElement } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import "./customerLocationPrompt.css";

export function CustomerLocationPrompt(props: {
  open: boolean;
  requesting: boolean;
  error: string | null;
  storeName?: string | null;
  onAllow: () => void;
  onDismiss: () => void;
}): ReactElement | null {
  const portalRoot =
    typeof document !== "undefined"
      ? (document.getElementById("sf-theme-portal-root") ?? document.body)
      : null;

  if (portalRoot == null) return null;

  const shopLabel =
    props.storeName != null && props.storeName.trim() !== ""
      ? props.storeName.trim()
      : "магазин";

  return createPortal(
    <AnimatePresence>
      {props.open ? (
        <>
          <motion.div
            key="geo-backdrop"
            className="sf-geo-prompt-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={props.requesting ? undefined : props.onDismiss}
          />
          <motion.div
            key="geo-dialog"
            className="sf-geo-prompt-wrap"
            role="presentation"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
          >
            <div
              className="sf-geo-prompt archa-glass archa-glass--glow"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sf-geo-prompt-title"
            >
              <div className="sf-geo-prompt__glow" aria-hidden />
              <h2 id="sf-geo-prompt-title" className="sf-geo-prompt__title">
                Добро пожаловать в {shopLabel}
              </h2>
              <p className="sf-geo-prompt__text">
                Чтобы быстрее оформить заказ, разрешите доступ к местоположению.
              </p>
              <ul className="sf-geo-prompt__benefits">
                <li>
                  <span aria-hidden>📍</span>
                  <span>автоматически заполнить адрес</span>
                </li>
                <li>
                  <span aria-hidden>🚚</span>
                  <span>посчитать доставку</span>
                </li>
                <li>
                  <span aria-hidden>⚡</span>
                  <span>ускорить оформление заказа</span>
                </li>
              </ul>
              {props.error ? (
                <p className="sf-geo-prompt__error" role="alert">
                  {props.error}
                </p>
              ) : null}
              <div className="sf-geo-prompt__actions">
                <motion.button
                  type="button"
                  className="sf-geo-prompt__btn sf-geo-prompt__btn--primary archa-btn-primary"
                  disabled={props.requesting}
                  onClick={props.onAllow}
                  whileTap={{ scale: 0.97 }}
                >
                  {props.requesting ? "Определяем…" : "Разрешить"}
                </motion.button>
                <motion.button
                  type="button"
                  className="sf-geo-prompt__btn sf-geo-prompt__btn--ghost archa-btn-ghost"
                  disabled={props.requesting}
                  onClick={props.onDismiss}
                  whileTap={{ scale: 0.97 }}
                >
                  Позже
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    portalRoot,
  );
}
