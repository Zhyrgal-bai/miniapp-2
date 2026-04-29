import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const STORAGE_KEY = "miniapp-floating-cart-pos";
const BTN = 56;
const PAD = 8;
/** Fallback if header not in DOM yet (matches shell ~56px + padding + safe area). */
const HEADER_FALLBACK_BOTTOM = 70;
const DRAG_THRESHOLD = 6;

type Pos = { x: number; y: number };

function getHeaderBottomY(): number {
  if (typeof window === "undefined") return HEADER_FALLBACK_BOTTOM;
  const el = document.querySelector(".app-header");
  if (el instanceof HTMLElement) {
    const bottom = el.getBoundingClientRect().bottom;
    if (Number.isFinite(bottom) && bottom > 0) {
      return Math.ceil(bottom) + PAD;
    }
  }
  return HEADER_FALLBACK_BOTTOM;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function clampPos(x: number, y: number, minY: number): Pos {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(PAD, window.innerWidth - BTN - PAD);
  const maxY = Math.max(minY, window.innerHeight - BTN - PAD);
  return {
    x: clamp(x, PAD, maxX),
    y: clamp(y, minY, maxY),
  };
}

function defaultPos(minY: number): Pos {
  if (typeof window === "undefined") return { x: 100, y: 100 };
  return clampPos(
    window.innerWidth - BTN - 22,
    window.innerHeight - BTN - 24,
    minY
  );
}

function loadPos(minY: number): Pos {
  if (typeof window === "undefined") return defaultPos(minY);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const j = JSON.parse(raw) as { x?: unknown; y?: unknown };
      if (Number.isFinite(j.x) && Number.isFinite(j.y)) {
        return clampPos(Number(j.x), Number(j.y), minY);
      }
    }
  } catch {
    /* ignore */
  }
  return defaultPos(minY);
}

type Props = {
  visible: boolean;
  totalQuantity: number;
  onOpen: () => void;
};

export default function FloatingCart({
  visible,
  totalQuantity,
  onOpen,
}: Props) {
  const minYRef = useRef(HEADER_FALLBACK_BOTTOM);
  const [pos, setPos] = useState<Pos>(() => loadPos(HEADER_FALLBACK_BOTTOM));
  const posRef = useRef<Pos>(pos);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const movedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const syncMinY = () => {
      minYRef.current = getHeaderBottomY();
      setPos((p) => clampPos(p.x, p.y, minYRef.current));
    };
    syncMinY();
    window.addEventListener("resize", syncMinY);
    return () => window.removeEventListener("resize", syncMinY);
  }, []);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  const finishDrag = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (dragRef.current && movedRef.current) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(posRef.current)
        );
      } catch {
        /* ignore */
      }
    }
    dragRef.current = null;
  }, []);

  const moveDrag = useCallback((clientX: number, clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = clientX - d.startClientX;
    const dy = clientY - d.startClientY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      movedRef.current = true;
    }
    minYRef.current = getHeaderBottomY();
    setPos(clampPos(d.startX + dx, d.startY + dy, minYRef.current));
  }, []);

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      finishDrag();
      movedRef.current = false;
      dragRef.current = {
        startClientX: clientX,
        startClientY: clientY,
        startX: posRef.current.x,
        startY: posRef.current.y,
      };
    },
    [finishDrag]
  );

  const onMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!visible || e.button !== 0) return;
    startDrag(e.clientX, e.clientY);

    const onMove = (ev: MouseEvent) => {
      moveDrag(ev.clientX, ev.clientY);
    };
    const onUp = () => {
      finishDrag();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    cleanupRef.current = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  };

  const onTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (!visible) return;
    const t = e.touches[0];
    if (!t) return;
    startDrag(t.clientX, t.clientY);

    const onMove = (ev: TouchEvent) => {
      const tt = ev.touches[0];
      if (tt) {
        ev.preventDefault();
        moveDrag(tt.clientX, tt.clientY);
      }
    };
    const onEnd = () => {
      finishDrag();
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };

    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    cleanupRef.current = () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  };

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (movedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      movedRef.current = false;
      return;
    }
    onOpen();
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      className="floating-cart cart-float"
      style={{ left: pos.x, top: pos.y, right: "auto", bottom: "auto" }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={onClick}
      aria-label="Открыть корзину"
    >
      <div className="cart-icon">
        🛒
        {totalQuantity > 0 && (
          <span className="cart-badge">{totalQuantity}</span>
        )}
      </div>
    </button>
  );
}
