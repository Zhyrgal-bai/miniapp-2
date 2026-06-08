/** ARCHA — общие классы Tailwind для /merchant и /platform-admin */
export const archa = {
  pageRoot:
    "min-h-full bg-[#0B0F14] bg-gradient-to-b from-[#0B0F14] via-[#0B0F14] to-[#070a0f] text-[#E5E7EB] antialiased",
  textMuted: "text-[#9CA3AF]",
  shellMerchant:
    "mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-7 sm:px-5",
  shellAdmin: "mx-auto w-full max-w-6xl space-y-10 px-4 py-7 sm:px-6",
  cardGlass:
    "rounded-2xl border border-white/[0.06] bg-[#111827]/85 shadow-xl shadow-black/50 backdrop-blur-xl",
  cardGlassHover:
    "transition-all duration-300 hover:border-[#22C55E]/18 hover:shadow-[0_0_36px_-10px_rgba(34,197,94,0.22)]",
  sectionTitle: "text-lg font-semibold tracking-tight text-[#E5E7EB]",
  btnPrimary:
    "inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#15803d] via-[#16a34a] to-[#22C55E] px-4 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-[#22C55E]/25 transition duration-200 hover:from-[#166534] hover:via-[#22c55e] hover:to-[#4ade80] hover:shadow-[#22C55E]/40 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]",
  btnPrimarySm:
    "inline-flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-[#15803d] to-[#22C55E] px-4 py-3 text-center text-sm font-semibold text-white shadow-md shadow-[#22C55E]/20 transition duration-200 hover:to-[#4ade80] disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]",
  btnSecondary:
    "inline-flex items-center justify-center rounded-2xl border border-[#9CA3AF]/30 bg-[#111827]/60 px-4 py-3.5 text-sm font-semibold text-[#E5E7EB] shadow-sm backdrop-blur-sm transition duration-200 hover:border-[#22C55E]/45 hover:bg-[#111827] disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]",
  btnDanger:
    "inline-flex items-center justify-center rounded-xl border border-red-500/35 bg-red-950/35 px-3 py-2 text-xs font-semibold text-red-300 transition duration-200 hover:border-red-400/50 hover:bg-red-950/55 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]",
  btnGhost:
    "inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#E5E7EB] transition duration-200 hover:border-white/15 hover:bg-white/[0.07] disabled:pointer-events-none disabled:opacity-45",
  btnIcon:
    "inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl border border-white/[0.08] bg-[#111827]/80 text-base text-[#E5E7EB] shadow-sm transition duration-200 hover:border-[#22C55E]/35 hover:bg-[#111827] hover:text-white disabled:pointer-events-none disabled:opacity-40",
  btnIconDanger:
    "inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl border border-red-500/30 bg-red-950/25 text-base text-red-200 transition duration-200 hover:border-red-400/45 hover:bg-red-950/45 disabled:pointer-events-none disabled:opacity-40",
  btnIconSuccess:
    "inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-xl border border-[#22C55E]/35 bg-[#22C55E]/10 text-base text-[#86efac] transition duration-200 hover:bg-[#22C55E]/18 disabled:pointer-events-none disabled:opacity-40",
  input:
    "w-full rounded-xl border border-white/[0.08] bg-[#0B0F14]/90 px-3 py-3 text-base text-[#E5E7EB] outline-none ring-[#22C55E]/15 transition placeholder:text-[#9CA3AF]/60 focus:border-[#22C55E]/45 focus:ring-2 disabled:opacity-50",
  inputSearch:
    "w-full rounded-2xl border border-white/[0.08] bg-[#111827]/70 py-3 pl-11 pr-4 text-base text-[#E5E7EB] outline-none ring-[#22C55E]/10 transition placeholder:text-[#9CA3AF]/55 focus:border-[#22C55E]/40 focus:ring-2 focus:ring-[#22C55E]/20",
  bottomDock:
    "fixed bottom-0 left-0 right-0 border-t border-white/[0.06] bg-[#0B0F14]/92 backdrop-blur-xl",
  modalBackdrop:
    "fixed inset-0 z-50 flex items-end justify-center bg-[#0B0F14]/88 p-4 backdrop-blur-md sm:items-center",
  modalCard:
    "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#111827]/95 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-6",
  modalBackdropElevated:
    "fixed inset-0 z-[60] flex items-end justify-center bg-[#0B0F14]/88 p-4 backdrop-blur-md sm:items-center",
} as const;
