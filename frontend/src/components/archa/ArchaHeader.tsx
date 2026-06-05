import { motion } from "framer-motion";
import { ARCHA_BRAND } from "../../config/brandAssets";

type ArchaHeaderProps = {
  subtitle: string;
  secondLine?: string;
  className?: string;
};

export function ArchaHeader({
  subtitle,
  secondLine,
  className,
}: ArchaHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-start gap-3 sm:gap-4 ${className ?? ""}`}
    >
      <div className="relative shrink-0">
        <img
          src={ARCHA_BRAND.favicon}
          alt={ARCHA_BRAND.name}
          width={48}
          height={48}
          className="h-12 w-12 rounded-2xl border border-white/[0.08] object-contain shadow-lg shadow-black/50 sm:h-14 sm:w-14"
        />
        <span
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-40 blur-sm"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, rgba(34,197,94,0.35), transparent 55%)",
          }}
          aria-hidden
        />
      </div>
      <div className="min-w-0 pt-0.5">
        <h1 className="text-2xl font-bold tracking-[0.22em] text-[#E5E7EB] sm:text-[1.75rem]">
          ARCHA
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[#9CA3AF] sm:text-[0.9375rem]">
          {subtitle}
        </p>
        {secondLine ? (
          <p className="mt-1 text-xs leading-relaxed text-[#9CA3AF]/80 sm:text-sm">
            {secondLine}
          </p>
        ) : null}
      </div>
    </motion.header>
  );
}
