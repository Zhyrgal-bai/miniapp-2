import { useMemo, useState, type ReactElement } from "react";
import {
  ARCHA_FAQ_CATEGORIES,
  ARCHA_FAQ_ITEMS,
  ARCHA_FAQ_SUPPORT_TELEGRAM_URL,
  type ArchaFaqCategoryId,
  type ArchaFaqItem,
} from "../../content/archaFaqContent";
import { openTelegramExternalLink } from "../../utils/telegramWebAppBootstrap";
import "./archaFaq.css";

function normalizeSearch(s: string): string {
  return s.trim().toLowerCase();
}

function itemMatchesQuery(item: ArchaFaqItem, query: string): boolean {
  if (query === "") return true;
  const haystack = [
    item.question,
    ...item.paragraphs,
    ...(item.bullets ?? []),
    ...(item.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function FaqAccordionItem(props: {
  item: ArchaFaqItem;
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  const { item, open, onToggle } = props;
  const panelId = `archa-faq-panel-${item.id}`;
  const buttonId = `archa-faq-btn-${item.id}`;

  return (
    <article className={`archa-faq-card${open ? " archa-faq-card--open" : ""}`}>
      <button
        type="button"
        id={buttonId}
        className="archa-faq-card__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="archa-faq-card__question">{item.question}</span>
        <span className="archa-faq-card__chevron" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className="archa-faq-card__panel"
        hidden={!open}
      >
        {item.paragraphs.map((p) => (
          <p key={p} className="archa-faq-card__paragraph">
            {p}
          </p>
        ))}
        {item.bullets != null && item.bullets.length > 0 ? (
          <ul className="archa-faq-card__list">
            {item.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

export function ArchaFaqView(props: {
  title?: string;
  subtitle?: string;
  showSupportCta?: boolean;
  className?: string;
}): ReactElement {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<ArchaFaqCategoryId | "all">("all");
  const [openId, setOpenId] = useState<string | null>(ARCHA_FAQ_ITEMS[0]?.id ?? null);

  const normalizedQuery = normalizeSearch(query);

  const filteredItems = useMemo(() => {
    return ARCHA_FAQ_ITEMS.filter((item) => {
      if (categoryId !== "all" && item.categoryId !== categoryId) return false;
      return itemMatchesQuery(item, normalizedQuery);
    });
  }, [categoryId, normalizedQuery]);

  const title = props.title ?? "Вопросы и ответы";
  const subtitle =
    props.subtitle ??
    "Всё, что нужно знать владельцу магазина на ARCHA";

  return (
    <div className={`archa-faq${props.className ? ` ${props.className}` : ""}`}>
      <header className="archa-faq__header">
        <h1 className="archa-faq__title">{title}</h1>
        <p className="archa-faq__subtitle">{subtitle}</p>
      </header>

      <div className="archa-faq__search-wrap">
        <label className="archa-faq__search-label" htmlFor="archa-faq-search">
          Поиск
        </label>
        <input
          id="archa-faq-search"
          type="search"
          className="archa-faq__search"
          placeholder="Например: оплата, доставка, пробный период…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div
        className="archa-faq__categories"
        role="tablist"
        aria-label="Категории FAQ"
      >
        <button
          type="button"
          role="tab"
          aria-selected={categoryId === "all"}
          className={`archa-faq-chip${categoryId === "all" ? " archa-faq-chip--active" : ""}`}
          onClick={() => setCategoryId("all")}
        >
          Все
        </button>
        {ARCHA_FAQ_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={categoryId === cat.id}
            className={`archa-faq-chip${categoryId === cat.id ? " archa-faq-chip--active" : ""}`}
            onClick={() => setCategoryId(cat.id)}
          >
            <span aria-hidden>{cat.icon}</span> {cat.label}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <p className="archa-faq__empty" role="status">
          Ничего не найдено. Попробуйте другой запрос или выберите категорию «Все».
        </p>
      ) : (
        <div className="archa-faq__list">
          {filteredItems.map((item) => (
            <FaqAccordionItem
              key={item.id}
              item={item}
              open={openId === item.id}
              onToggle={() =>
                setOpenId((prev) => (prev === item.id ? null : item.id))
              }
            />
          ))}
        </div>
      )}

      {props.showSupportCta !== false ? (
        <footer className="archa-faq__footer">
          <p className="archa-faq__footer-text">
            Не нашли ответ? Напишите в поддержку платформы.
          </p>
          <button
            type="button"
            className="archa-faq__support-btn"
            onClick={() => openTelegramExternalLink(ARCHA_FAQ_SUPPORT_TELEGRAM_URL)}
          >
            Написать @archa_kg
          </button>
        </footer>
      ) : null}
    </div>
  );
}
