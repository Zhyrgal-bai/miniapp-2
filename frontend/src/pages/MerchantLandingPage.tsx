import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ARCHA_BRAND } from "../config/brandAssets";
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
    text: "Операционные метрики и готовность магазина к продажам.",
  },
  {
    id: "saas",
    title: "SaaS",
    text: "Подписка, пробный период и масштабирование без боли.",
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

  useEffect(() => {
    document.title = ARCHA_BRAND.title;
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
          <img src={ARCHA_BRAND.favicon} alt="" width={36} height={36} />
          <span>{ARCHA_BRAND.name}</span>
        </a>
        <nav className="archa-landing__nav-links" aria-label="Разделы">
          <a href="#features">Возможности</a>
          <a href="#faq">FAQ</a>
          <a href="#about">О проекте</a>
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
                width={120}
                height={120}
              />
            </motion.div>
            <motion.img
              className="archa-landing__hero-wordmark"
              src={ARCHA_BRAND.logoText}
              alt={ARCHA_BRAND.name}
              variants={fadeUp}
            />
            <motion.p className="archa-landing__hero-headline" variants={fadeUp}>
              {ARCHA_BRAND.heroTagline}
            </motion.p>
            <motion.p className="archa-landing__hero-sub" variants={fadeUp}>
              Premium commerce infrastructure for Telegram — built in Kyrgyzstan.
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
            <p className="archa-landing__eyebrow">Platform</p>
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
                <span className={`archa-landing__feature-icon archa-landing__feature-icon--${f.id}`} />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </motion.li>
            ))}
          </ul>
        </section>

        <section className="archa-landing__section" id="faq">
          <div className="archa-landing__faq-card archa-glass archa-glass--glow">
            <p className="archa-landing__eyebrow">FAQ</p>
            <h2>Быстрые ответы</h2>
            <h3>Что такое ARCHA?</h3>
            <p>
              ARCHA — платформа для интернет-магазинов внутри Telegram. Каталог, заказы, оплата и
              управление без отдельного сайта.
            </p>
            <h3>Как начать?</h3>
            <p>
              Создайте магазин или войдите через Telegram — после одобления заявки откроется
              панель управления Mini App.
            </p>
            <button type="button" className="archa-btn-ghost" onClick={() => navigate("/merchant/faq")}>
              Все вопросы и ответы
            </button>
          </div>
        </section>

        <section className="archa-landing__section" id="about">
          <div className="archa-landing__about archa-glass archa-glass--glow">
            <img src={ARCHA_BRAND.logoMark} alt={ARCHA_BRAND.name} width={96} height={96} />
            <div>
              <p className="archa-landing__eyebrow">About</p>
              <h2>О проекте</h2>
              <p>
                ARCHA — команда из Кыргызстана 🇰🇬. Tech Nature: juniper, горы и circuit — символ
                устойчивого digital commerce.
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
        </section>

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
        <span>{ARCHA_BRAND.name}</span>
        <span>{ARCHA_BRAND.tagline}</span>
      </footer>
    </div>
  );
}
