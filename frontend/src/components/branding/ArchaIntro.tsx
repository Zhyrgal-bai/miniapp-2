import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ARCHA_BRAND } from "../../config/brandAssets";
import "./archaIntro.css";

export const ARCHA_INTRO_SESSION_KEY = "archa_intro_seen";

const ease = [0.22, 1, 0.36, 1] as const;
const INTRO_MS = 1800;
const INTRO_REDUCED_MS = 380;

type Props = {
  onComplete: () => void;
};

function hasSeenIntro(): boolean {
  try {
    return sessionStorage.getItem(ARCHA_INTRO_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markIntroSeen(): void {
  try {
    sessionStorage.setItem(ARCHA_INTRO_SESSION_KEY, "1");
  } catch {
    /* private mode */
  }
}

/** Lightweight premium intro — once per session, browser landing only. */
export default function ArchaIntro({ onComplete }: Props): React.ReactElement | null {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(!hasSeenIntro());

  useEffect(() => {
    if (!visible) {
      onComplete();
      return;
    }
    const duration = reduceMotion ? INTRO_REDUCED_MS : INTRO_MS;
    const t = window.setTimeout(() => {
      markIntroSeen();
      setVisible(false);
      onComplete();
    }, duration);
    return () => window.clearTimeout(t);
  }, [visible, reduceMotion, onComplete]);

  if (!visible) return null;

  const fadeDuration = reduceMotion ? 0.35 : 0.55;
  const rotate = reduceMotion ? 0 : 3;
  const parallaxY = reduceMotion ? 0 : 6;

  return (
    <motion.div
      className="archa-intro"
      role="status"
      aria-label="ARCHA"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: reduceMotion ? 0.12 : 1.15, duration: fadeDuration, ease }}
    >
      <div
        className="archa-intro__bg"
        style={{ backgroundImage: `url(${ARCHA_BRAND.background})` }}
        aria-hidden
      />
      <div className="archa-intro__stage">
        <motion.span
          className="archa-intro__glow"
          aria-hidden
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease }}
        />
        <motion.img
          className="archa-intro__logo"
          src={ARCHA_BRAND.logoIcon}
          alt={ARCHA_BRAND.name}
          width={96}
          height={96}
          initial={{ opacity: 0, scale: 0.92, rotate: 0, y: 0 }}
          animate={{
            opacity: 1,
            scale: 1,
            rotate,
            y: parallaxY,
          }}
          transition={{
            duration: reduceMotion ? 0.3 : 0.85,
            ease,
          }}
        />
        <motion.p
          className="archa-intro__name"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduceMotion ? 0.05 : 0.35, duration: 0.45, ease }}
        >
          {ARCHA_BRAND.name}
        </motion.p>
      </div>
    </motion.div>
  );
}

export function shouldShowArchaIntro(): boolean {
  return !hasSeenIntro();
}
