import { useEffect, useMemo, useState } from "react";
import { SECTION_LIBRARY } from "./library";
import { SECTION_CATEGORIES } from "./categories";
import type { SectionCategory, SectionLibraryItem } from "./types";
import { TEMPLATE_LIBRARY, type TemplateLibraryItem } from "../templates/library";
import {
  deleteReusableBlock,
  fetchReusableBlocks,
  type ReusableBlockDTO,
} from "../reusableBlocks/reusableBlocksApi";

function includesCI(hay: string, needle: string): boolean {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function SectionMarketplaceModal(props: {
  open: boolean;
  onClose: () => void;
  onPick: (params: { type: string; config: Record<string, unknown> }) => void;
}): React.ReactElement | null {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<SectionCategory | "All">("All");
  const [tab, setTab] = useState<"sections" | "templates" | "reusable">("sections");
  const [reusable, setReusable] = useState<ReusableBlockDTO[]>([]);
  const [reusableErr, setReusableErr] = useState<string | null>(null);

  const items: SectionLibraryItem[] = useMemo(() => {
    const query = q.trim();
    return SECTION_LIBRARY.filter((x) => {
      if (cat !== "All" && x.category !== cat) return false;
      if (query === "") return true;
      return (
        includesCI(x.title, query) ||
        includesCI(x.description, query) ||
        includesCI(x.type, query)
      );
    });
  }, [q, cat]);

  const templates: TemplateLibraryItem[] = useMemo(() => {
    const query = q.trim();
    return TEMPLATE_LIBRARY.filter((x) => {
      if (cat !== "All" && x.category !== cat) return false;
      if (query === "") return true;
      return includesCI(x.title, query) || includesCI(x.description, query) || includesCI(x.type, query);
    });
  }, [q, cat]);

  useEffect(() => {
    if (!props.open) return;
    if (tab !== "reusable") return;
    setReusableErr(null);
    void fetchReusableBlocks()
      .then((rows) => setReusable(rows))
      .catch((e) => setReusableErr(e instanceof Error ? e.message : "Ошибка загрузки блоков"));
  }, [props.open, tab]);

  if (!props.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.65)",
        backdropFilter: "blur(10px)",
        zIndex: 3000,
        display: "grid",
        placeItems: "center",
        padding: 14,
      }}
      onClick={props.onClose}
    >
      <div
        style={{
          width: "min(980px, 96vw)",
          maxHeight: "min(84vh, 760px)",
          overflow: "auto",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(15,23,42,0.92)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: 14,
            display: "flex",
            gap: 10,
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            position: "sticky",
            top: 0,
            background: "rgba(15,23,42,0.96)",
            zIndex: 2,
          }}
        >
          <div style={{ fontWeight: 900 }}>Marketplace</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setTab("sections")}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: tab === "sections" ? "rgba(220,38,38,0.28)" : "rgba(255,255,255,0.03)",
                color: "#fff",
                padding: "8px 12px",
                fontWeight: 900,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Sections
            </button>
            <button
              onClick={() => setTab("templates")}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: tab === "templates" ? "rgba(220,38,38,0.28)" : "rgba(255,255,255,0.03)",
                color: "#fff",
                padding: "8px 12px",
                fontWeight: 900,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Templates
            </button>
            <button
              onClick={() => setTab("reusable")}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: tab === "reusable" ? "rgba(220,38,38,0.28)" : "rgba(255,255,255,0.03)",
                color: "#fff",
                padding: "8px 12px",
                fontWeight: 900,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Reusable
            </button>
          </div>
          <div style={{ flex: 1 }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск секции…"
            style={{
              width: "min(380px, 52vw)",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(2,6,23,0.45)",
              color: "#fff",
              padding: "8px 10px",
              outline: "none",
            }}
          />
          <button
            onClick={props.onClose}
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "transparent",
              color: "rgba(255,255,255,0.9)",
              padding: "8px 10px",
              fontWeight: 800,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              onClick={() => setCat("All")}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: cat === "All" ? "rgba(220,38,38,0.28)" : "rgba(255,255,255,0.03)",
                color: "#fff",
                padding: "8px 12px",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              All
            </button>
            {SECTION_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background:
                    cat === c ? "rgba(220,38,38,0.28)" : "rgba(255,255,255,0.03)",
                  color: "#fff",
                  padding: "8px 12px",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {c}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {tab === "reusable" ? (
              reusableErr ? (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: 18,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                    color: "rgba(255,255,255,0.85)",
                    textAlign: "center",
                  }}
                >
                  {reusableErr}
                </div>
              ) : reusable.length === 0 ? (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: 18,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                    color: "rgba(255,255,255,0.85)",
                    textAlign: "center",
                  }}
                >
                  У вас пока нет reusable blocks.
                </div>
              ) : (
                reusable.map((b: ReusableBlockDTO) => (
                  <div
                    key={b.id}
                    style={{
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.03)",
                      padding: 12,
                      color: "#fff",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 900 }}>{b.name}</div>
                      <div style={{ opacity: 0.6, fontSize: 11 }}>{b.type}</div>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => {
                          void deleteReusableBlock(b.id).then(() =>
                            setReusable((p) => p.filter((x) => x.id !== b.id)),
                          );
                        }}
                        style={{
                          borderRadius: 12,
                          border: "1px solid rgba(239,68,68,0.30)",
                          background: "rgba(239,68,68,0.10)",
                          color: "#fff",
                          padding: "6px 10px",
                          fontWeight: 900,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <button
                      onClick={() => props.onPick({ type: b.type, config: b.config })}
                      style={{
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(220,38,38,0.18)",
                        color: "#fff",
                        padding: "10px 12px",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Add to draft
                    </button>
                  </div>
                ))
              )
            ) : tab === "templates" ? (
              templates.length === 0 ? (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: 18,
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                    color: "rgba(255,255,255,0.85)",
                    textAlign: "center",
                  }}
                >
                  Ничего не найдено.
                </div>
              ) : (
                templates.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => props.onPick({ type: x.type, config: x.config })}
                    style={{
                      textAlign: "left",
                      borderRadius: 16,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.03)",
                      padding: 12,
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 18 }}>{x.icon}</div>
                      <div style={{ fontWeight: 900 }}>{x.title}</div>
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                      {x.description}
                    </div>
                    <div style={{ opacity: 0.6, fontSize: 11, marginTop: 8 }}>
                      {x.category} • {x.type}
                    </div>
                  </button>
                ))
              )
            ) : items.length === 0 ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  padding: 18,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.85)",
                  textAlign: "center",
                }}
              >
                Ничего не найдено.
              </div>
            ) : (
              items.map((x) => (
                <button
                  key={x.id}
                  onClick={() => props.onPick({ type: x.type, config: x.defaultConfig })}
                  style={{
                    textAlign: "left",
                    borderRadius: 16,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.03)",
                    padding: 12,
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 18 }}>{x.icon}</div>
                    <div style={{ fontWeight: 900 }}>{x.title}</div>
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    {x.description}
                  </div>
                  <div style={{ opacity: 0.6, fontSize: 11, marginTop: 8 }}>
                    {x.category} • {x.type}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

