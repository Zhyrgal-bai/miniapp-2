import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ARCHA_FOUNDER, enabledFounderSocials, type FounderSocialId } from "../../config/founder";
import "./founderSection.css";

const ease = [0.22, 1, 0.36, 1] as const;

const SOCIAL_ICON: Record<FounderSocialId, string> = {
  instagram: "◎",
  telegram: "✈",
  github: "⌥",
};

/** ARCHA landing founder block — premium, minimal, responsive (Phase 17.1). */
export function FounderSection(): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const [photoOk, setPhotoOk] = useState(true);
  const socials = enabledFounderSocials();

  return (
    <section className="archa-founder" id="founder" aria-label={ARCHA_FOUNDER.sectionTitle}>
      <motion.div
        className="archa-founder__head"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.55, ease }}
      >
        <h2 className="archa-founder__title">{ARCHA_FOUNDER.sectionTitle}</h2>
        <p className="archa-founder__subtitle">{ARCHA_FOUNDER.sectionSubtitle}</p>
      </motion.div>

      <motion.div
        className="archa-founder__card archa-glass archa-glass--glow"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease }}
      >
        {photoOk ? (
          <div className="archa-founder__photo-wrap">
            <span className="archa-founder__photo-glow" aria-hidden />
            <img
              className="archa-founder__photo"
              src={ARCHA_FOUNDER.photo}
              alt={ARCHA_FOUNDER.photoAlt}
              loading="lazy"
              decoding="async"
              onError={() => setPhotoOk(false)}
            />
          </div>
        ) : (
          <div className="archa-founder__photo-wrap archa-founder__photo-wrap--fallback" aria-hidden>
            <span className="archa-founder__photo-initial">
              {ARCHA_FOUNDER.name.slice(0, 1)}
            </span>
          </div>
        )}

        <div className="archa-founder__body">
          <span className="archa-founder__badge">{ARCHA_FOUNDER.badge}</span>
          <h3 className="archa-founder__name">{ARCHA_FOUNDER.name}</h3>
          <p className="archa-founder__desc">{ARCHA_FOUNDER.description}</p>
          {socials.length > 0 ? (
            <div className="archa-founder__socials">
              {socials.map((s) => {
                const display = s.handle?.trim() || s.label;
                const aria = s.handle ? `${s.label} ${s.handle}` : s.label;
                return (
                  <a
                    key={s.id}
                    className="archa-founder__social"
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={aria}
                  >
                    <span className="archa-founder__social-icon" aria-hidden>
                      {SOCIAL_ICON[s.id]}
                    </span>
                    <span className="archa-founder__social-label">{display}</span>
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
      </motion.div>
    </section>
  );
}
