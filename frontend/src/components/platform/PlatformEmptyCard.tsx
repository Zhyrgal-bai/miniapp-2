import type { ReactElement } from "react";
import { motion } from "framer-motion";
import { EmptyState, type EmptyStateProps } from "../ui/EmptyState";

export type PlatformEmptyCardProps = EmptyStateProps & {
  tone?: "default" | "pending" | "rejected";
};

export function PlatformEmptyCard({
  tone = "default",
  ...emptyProps
}: PlatformEmptyCardProps): ReactElement {
  const toneClass =
    tone === "pending"
      ? "mp-v2-empty--pending"
      : tone === "rejected"
        ? "mp-v2-empty--rejected"
        : "";

  return (
    <motion.div
      className={`mp-v2-card mp-v2-empty ${toneClass}`.trim()}
      role="status"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <EmptyState {...emptyProps} variant="platform" compact />
    </motion.div>
  );
}
