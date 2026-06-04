import { useState, type ReactElement } from "react";

function readTitle(config: Record<string, unknown>, fallback: string): string {
  const v = config.title;
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

function readItems(config: Record<string, unknown>): Array<Record<string, unknown>> {
  const v = config.items;
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x != null && typeof x === "object" && !Array.isArray(x))
    .map((x) => x as Record<string, unknown>);
}

export function FaqSection(props: {
  config: Record<string, unknown>;
  textConfig?: Record<string, unknown>;
}): ReactElement | null {
  const cfgTitle = readTitle(props.config, "");
  const txtTitle =
    typeof props.textConfig?.titleFaq === "string" &&
    String(props.textConfig.titleFaq).trim() !== ""
      ? String(props.textConfig.titleFaq)
      : "Вопросы и ответы";
  const title = cfgTitle.trim() !== "" ? cfgTitle : txtTitle;
  const items = readItems(props.config);
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  if (items.length === 0) return null;

  return (
    <section className="sf-section sf-section--faq sf-section--padded">
      <div className="sf-section__title">{title}</div>
      <div className="sf-faq-accordion">
        {items.map((it, idx) => {
          const q = typeof it.q === "string" ? it.q : "";
          const a = typeof it.a === "string" ? it.a : "";
          const open = openIdx === idx;
          const panelId = `sf-faq-panel-${idx}`;
          const btnId = `sf-faq-btn-${idx}`;
          return (
            <article
              key={`${q}-${idx}`}
              className={`sf-faq-accordion__item${open ? " sf-faq-accordion__item--open" : ""}`}
            >
              <button
                type="button"
                id={btnId}
                className="sf-faq-accordion__trigger"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIdx((prev) => (prev === idx ? null : idx))}
              >
                <span className="sf-faq-accordion__q">{q}</span>
                <span className="sf-faq-accordion__icon" aria-hidden>
                  {open ? "−" : "+"}
                </span>
              </button>
              <div
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                className="sf-faq-accordion__panel"
                hidden={!open}
              >
                <p className="sf-faq-accordion__a">{a}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
