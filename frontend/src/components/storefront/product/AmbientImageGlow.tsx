import type { ReactElement } from "react";
import { useAmbientImageColor } from "./useAmbientImageColor";
import "./ambientImageGlow.css";

export function AmbientImageGlow(props: {
  src?: string | null;
  className?: string;
}): ReactElement | null {
  const color = useAmbientImageColor(props.src);
  if (!color) return null;

  return (
    <div
      className={["sf-ambient-glow", props.className].filter(Boolean).join(" ")}
      style={{ ["--sf-ambient-color" as string]: color }}
      aria-hidden
    />
  );
}
