import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ARCHA_BRAND } from "../config/brandAssets";
import { enabledFounderSocials } from "../config/founder";
import { ru } from "../i18n/ru";
import { FounderSection } from "../components/landing/FounderSection";
import "../design/archaPremium.css";
import "./MerchantLandingPage.css";

const FEATURES = [
  {
    id: "orders",
    title: "Заказы",
    text: "Статусы, уведомления и управление потоком заказов в реальном времени.",
  },
  {
    id: "payments",
    title: "Оплата",
    text: "Finik и безопасные платежи внутри Telegram Mini App.",
  },
  {
    id: "delivery",
    title: "Доставка",
    text: "Тарифы, минимальный заказ и адрес магазина на карте.",
  },
  {
    id: "bot",
    title: "Telegram Bot",
    text: "Свой бот, deep links и запуск витрины в один тап.",
  },
  {
    id: "analytics",
    title: "Аналитика",
    text: "Операционные метрики, lifetime-аналитика и готовность магазина к продажам.",
  },
  {
    id: "crm",
    title: "CRM",
    text: "Клиенты, сегменты, история заказов и любимые товары — без таблиц.",
  },
  {
    id: "marketing",
    title: "Маркетинг",
    text: "Акции, кампании и программа лояльности для роста продаж.",
  },
] as const;

const BUSINESS_TYPES = [
  { emoji: "👕", label: "Одежда" },
  { emoji: "🌸", label: "Цветы" },
  { emoji: "☕", label: "Кофейня" },
  { emoji: "🍔", label: "Фастфуд" },
  { emoji: "📱", label: "Электроника" },
  { emoji: "🚗", label: "Автозапчасти" },
  { emoji: "💄", label: "Косметика" },
  { emoji: "🛋️", label: "Мебель" },
] as const;

const HOW_STEPS = [
  { n: "1", title: "Откройте Telegram", text: "Запустите ARCHA в Telegram и подайте заявку на магазин." },
  { n: "2", title: "Настройте витрину", text: "Каталог, оформление, доставка и оплата Finik — за минуты." },
  { n: "3", title: "Начните продавать", text: "Первые 5 заказов бесплатно. Управление полностью в Telegram." },
] as const;

const WHY_TELEGRAM = [
  {
    title: "Аудитория уже здесь",
    text: "Клиенты не устанавливают приложения — магазин открывается в привычном мессенджере.",
  },
  {
    title: "Заказ и оплата в одном месте",
    text: "Каталог, корзина, Finik и уведомления — без отдельного сайта и сложной интеграции.",
  },
  {
    title: "Управление с телефона",
    text: "Панель мерчанта, CRM и аналитика — прямо в Telegram Mini App.",
  },
] as const;

const LANDING_FAQ = [
  {
    id: "what",
    q: "Что такое ARCHA?",
    a: "ARCHA — платформа для интернет-магазинов внутри Telegram. Каталог, заказы, оплата и управление без отдельного сайта.",
  },
  {
    id: "start",
    q: "Как начать?",
    a: "Создайте магазин или войдите через Telegram — после одобления заявки откроется панель управления Mini App.",
  },
] as const;

const ease = [0.22, 1, 0.36, 1] as const;

const heroStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease } },
};

export default function MerchantLandingPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [openFaqId, setOpenFaqId] = useState<string | null>(LANDING_FAQ[0]?.id ?? null);
  const founderSocials = enabledFounderSocials();

  useEffect(() => {
    document.title = ARCHA_BRAND.title;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);

  const openTelegram = () => {
    window.open(ARCHA_BRAND.telegramLoginUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="archa-landing">
      <div className="archa-landing__aurora" aria-hidden />
      <div className="archa-landing__bg" aria-hidden />

      <motion.header
        className="archa-landing__nav archa-glass"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        <a className="archa-landing__nav-brand" href="/merchant">
          <img src={ARCHA_BRAND.logoIcon} alt="" width={36} height={36} />
          <span>{ARCHA_BRAND.name}</span>
        </a>
        <nav className="archa-landing__nav-links" aria-label="Разделы">
          <a href="#features">Возможности</a>
          <a href="#why-telegram">Telegram</a>
          <a href="#faq">FAQ</a>
          <a href="#about">О проекте</a>
          <a href="#founder">Основатель</a>
        </nav>
        <button type="button" className="archa-btn-ghost archa-landing__nav-cta" onClick={openTelegram}>
          Войти через Telegram
        </button>
      </motion.header>

      <main className="archa-landing__main">
        <motion.section
          className="archa-landing__hero"
          variants={reduceMotion ? undefined : heroStagger}
          initial="hidden"
          animate="show"
        >
          <div className="archa-landing__hero-copy">
            <motion.div className="archa-landing__logo-wrap" variants={fadeUp}>
              <span className="archa-landing__logo-glow" aria-hidden />
              <img
                className="archa-landing__hero-mark"
                src={ARCHA_BRAND.logoMark}
                alt={ARCHA_BRAND.name}
                width={88}
                height={88}
              />
            </motion.div>
            <motion.img
              className="archa-landing__hero-wordmark"
              src={ARCHA_BRAND.logoText}
              alt={ARCHA_BRAND.name}
              variants={fadeUp}
            />
            <motion.p className="archa-landing__hero-kicker" variants={fadeUp}>
              Telegram-first commerce для предпринимателей
            </motion.p>
            <motion.p className="archa-landing__hero-headline" variants={fadeUp}>
              {ARCHA_BRAND.heroTagline}
            </motion.p>
            <motion.p className="archa-landing__hero-sub" variants={fadeUp}>
              {ru.platform.landingSub}
            </motion.p>
            <motion.div className="archa-landing__hero-actions" variants={fadeUp}>
              <button
                type="button"
                className="archa-btn-primary archa-landing__cta-main"
                onClick={() => navigate("/merchant/register")}
              >
                Создать магазин
              </button>
              <button type="button" className="archa-btn-ghost" onClick={openTelegram}>
                Войти через Telegram
              </button>
            </motion.div>
            <motion.p className="archa-landing__hero-foot" variants={fadeUp}>
              {ARCHA_BRAND.tagline}
            </motion.p>
          </div>
          <motion.div
            className="archa-landing__hero-visual archa-glass archa-glass--glow"
            variants={fadeUp}
          >
            <img src={ARCHA_BRAND.splashArt} alt="" />
          </motion.div>
        </motion.section>

        <section className="archa-landing__section" id="features">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, ease }}
          >
            <p className="archa-landing__eyebrow">Платформа</p>
            <h2>Возможности</h2>
            <p className="archa-landing__section-lead">
              Всё, что нужно локальному бизнесу для продаж в Telegram — в одной premium-панели.
            </p>
          </motion.div>
          <ul className="archa-landing__features">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f.id}
                className="archa-landing__feature-card archa-glass archa-glass--glow"
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.06, ease }}
                whileHover={reduceMotion ? undefined : { y: -4, transition: { duration: 0.2 } }}
              >
                <span className={`archa-landing__feature-icon archa-landing__feature-icon--${f.id}`} aria-hidden />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </motion.li>
            ))}
          </ul>
        </section>

        <motion.section
          className="archa-landing__section"
          id="business-types"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease }}
        >
          <p className="archa-landing__eyebrow">Вертикали</p>
          <h2>8 видов бизнеса</h2>
          <p className="archa-landing__section-lead">
            Готовые шаблоны витрины и карточек под каждую нишу.
          </p>
          <ul className="archa-landing__chips">
            {BUSINESS_TYPES.map((b) => (
              <li key={b.label} className="archa-landing__chip archa-glass">
                <span aria-hidden>{b.emoji}</span> {b.label}
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          className="archa-landing__section"
          id="how"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease }}
        >
          <p className="archa-landing__eyebrow">Как это работает</p>
          <h2>Как работает ARCHA</h2>
          <ul className="archa-landing__steps">
            {HOW_STEPS.map((s) => (
              <li key={s.n} className="archa-landing__step archa-glass archa-glass--glow">
                <span className="archa-landing__step-num">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          className="archa-landing__section archa-landing__section--why"
          id="why-telegram"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease }}
        >
          <p className="archa-landing__eyebrow">Почему Telegram</p>
          <h2>Commerce там, где уже общаются клиенты</h2>
          <p className="archa-landing__section-lead">
            ARCHA не заменяет Telegram — он превращает его в полноценную витрину и панель управления.
          </p>
          <ul className="archa-landing__why-list">
            {WHY_TELEGRAM.map((item) => (
              <li key={item.title} className="archa-landing__why-card archa-glass archa-glass--glow">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          className="archa-landing__section"
          id="pricing"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease }}
        >
          <div className="archa-landing__pricing-card archa-glass archa-glass--glow">
            <span className="archa-landing__pricing-badge">Рекомендуем</span>
            <p className="archa-landing__eyebrow">Тариф</p>
            <h2>5 заказов бесплатно</h2>
            <p>
              Начните без оплаты: первые 5 заказов — бесплатно. Дальше — простая подписка
              с первым месяцем по специальной цене. Без скрытых комиссий за заказы.
            </p>
            <div className="archa-landing__hero-actions">
              <button
                type="button"
                className="archa-btn-primary"
                onClick={() => navigate("/merchant/register")}
              >
                Начать бесплатно
              </button>
              <button type="button" className="archa-btn-ghost" onClick={openTelegram}>
                Открыть в Telegram
              </button>
            </div>
          </div>
        </motion.section>

        <section className="archa-landing__section" id="faq">
          <div className="archa-landing__faq-card archa-glass archa-glass--glow">
            <p className="archa-landing__eyebrow">FAQ</p>
            <h2>Быстрые ответы</h2>
            <ul className="archa-landing__faq-list">
              {LANDING_FAQ.map((item) => {
                const open = openFaqId === item.id;
                return (
                  <li key={item.id} className={`archa-landing__faq-item${open ? " archa-landing__faq-item--open" : ""}`}>
                    <button
                      type="button"
                      className="archa-landing__faq-trigger"
                      aria-expanded={open}
                      onClick={() => setOpenFaqId(open ? null : item.id)}
                    >
                      <span>{item.q}</span>
                      <span className="archa-landing__faq-chevron" aria-hidden>
                        {open ? "−" : "+"}
                      </span>
                    </button>
                    {open ? <p className="archa-landing__faq-answer">{item.a}</p> : null}
                  </li>
                );
              })}
            </ul>
            <button type="button" className="archa-btn-ghost" onClick={() => navigate("/merchant/faq")}>
              Все вопросы и ответы
            </button>
          </div>
        </section>

        <motion.section
          className="archa-landing__section"
          id="about"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease }}
        >
          <div className="archa-landing__about archa-glass archa-glass--glow">
            <img src={ARCHA_BRAND.logoMark} alt={ARCHA_BRAND.name} width={96} height={96} />
            <div>
              <p className="archa-landing__eyebrow">О проекте</p>
              <h2>ARCHA из Кыргызстана</h2>
              <p>
                ARCHA — команда из Кыргызстана 🇰🇬. Tech Nature: juniper, горы и circuit — символ
                устойчивого digital commerce для предпринимателей региона.
              </p>
              <a
                className="archa-landing__link"
                href={ARCHA_BRAND.telegramLoginUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {ARCHA_BRAND.telegramBotHandle}
              </a>
            </div>
          </div>
        </motion.section>

        <FounderSection />

        <motion.section
          className="archa-landing__cta-band archa-glass archa-glass--glow"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease }}
        >
          <h2>Готовы к запуску?</h2>
          <p>Premium storefront за минуты. Управление — в Telegram.</p>
          <div className="archa-landing__hero-actions archa-landing__hero-actions--center">
            <button type="button" className="archa-btn-primary" onClick={() => navigate("/merchant/register")}>
              Создать магазин
            </button>
          </div>
        </motion.section>
      </main>

      <footer className="archa-landing__footer">
        <div className="archa-landing__footer-start">
          <img src={ARCHA_BRAND.logoIcon} alt="" width={28} height={28} className="archa-landing__footer-icon" />
          <span>{ARCHA_BRAND.name}</span>
        </div>
        <span>{ARCHA_BRAND.tagline}</span>
        {founderSocials.length > 0 ? (
          <nav className="archa-landing__footer-socials" aria-label="Социальные сети">
            {founderSocials.map((s) => (
              <a
                key={s.id}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="archa-landing__footer-social"
              >
                {s.handle ?? s.label}
              </a>
            ))}
          </nav>
        ) : null}
        <span className="archa-landing__footer-brand">
          Built in Kyrgyzstan 🇰🇬 · ARCHA Generation One · 2026
        </span>
      </footer>
    </div>
  );
}
