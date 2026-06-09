import { useCallback, useEffect, useState } from "react";
import type {
  LoyaltyProgramRules,
  MarketingCampaign,
  MarketingDashboard,
  MarketingPromotion,
  MarketingPromotionType,
  MerchantLoyaltyPayload,
} from "../../services/admin.service";
import { adminService } from "../../services/admin.service";
import { formatAdminApiError } from "../../utils/adminApiError";
import { ru } from "../../i18n/ru";
import {
  MARKETING_PROMOTION_TYPE_OPTIONS,
  campaignStatusBadge,
  formatBudget,
  formatPromotionValue,
  promotionStatusBadge,
  promotionTypeLabel,
} from "../../utils/marketingUx";
import "./adminOperations.css";
import "./adminMarketing.css";

type Range = 7 | 30 | 90;
type Tab = "dashboard" | "promotions" | "campaigns" | "loyalty";

export default function AdminMarketingPage() {
  const m = ru.admin.marketing;
  const [tab, setTab] = useState<Tab>("dashboard");
  const [range, setRange] = useState<Range>(30);
  const [dashboard, setDashboard] = useState<MarketingDashboard | null>(null);
  const [promotions, setPromotions] = useState<MarketingPromotion[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loyalty, setLoyalty] = useState<MerchantLoyaltyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newPromo, setNewPromo] = useState<{
    title: string;
    type: MarketingPromotionType;
    code: string;
    percent: string;
  }>({ title: "", type: "COUPON_PERCENT", code: "", percent: "10" });

  const [newCampaign, setNewCampaign] = useState<{ title: string; budgetSom: string }>({
    title: "",
    budgetSom: "",
  });

  const load = useCallback(async () => {
    try {
      const [dash, promos, camps, loy] = await Promise.all([
        adminService.getMarketingDashboard(range),
        adminService.listMarketingPromotions(),
        adminService.listMarketingCampaigns(),
        adminService.getLoyalty(),
      ]);
      setDashboard(dash);
      setPromotions(promos);
      setCampaigns(camps);
      setLoyalty(loy);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(formatAdminApiError(e));
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const createPromotion = useCallback(async () => {
    try {
      await adminService.createMarketingPromotion({
        title: newPromo.title.trim(),
        type: newPromo.type,
        code: newPromo.code.trim() || null,
        percent: Number(newPromo.percent) || null,
      });
      setNewPromo({ title: "", type: "COUPON_PERCENT", code: "", percent: "10" });
      await load();
    } catch (e) {
      setError(formatAdminApiError(e));
    }
  }, [newPromo, load]);

  const createCampaign = useCallback(async () => {
    try {
      await adminService.createMarketingCampaign({
        title: newCampaign.title.trim(),
        budgetSom: Number(newCampaign.budgetSom) || 0,
        active: true,
      });
      setNewCampaign({ title: "", budgetSom: "" });
      await load();
    } catch (e) {
      setError(formatAdminApiError(e));
    }
  }, [newCampaign, load]);

  const saveLoyalty = useCallback(
    async (rules: LoyaltyProgramRules) => {
      try {
        await adminService.saveLoyalty(rules);
        await load();
      } catch (e) {
        setError(formatAdminApiError(e));
      }
    },
    [load],
  );

  return (
    <div className="admin-dash-page admin-ops-page">
      <header className="admin-dash-page__head">
        <h1 className="admin-dash-page__title">{m.title}</h1>
        <p className="admin-dash-page__subtitle">{m.subtitle}</p>
      </header>

      <div className="admin-ops-tabs" role="tablist" aria-label="Маркетинг">
        {(
          [
            ["dashboard", m.tabDashboard],
            ["promotions", m.tabPromotions],
            ["campaigns", m.tabCampaigns],
            ["loyalty", m.tabLoyalty],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`admin-ops-tabs__btn${tab === id ? " admin-ops-tabs__btn--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" ? (
        <div className="admin-analytics-range" role="tablist" aria-label="Период">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={range === d}
              className={`admin-analytics-range__btn${range === d ? " admin-analytics-range__btn--active" : ""}`}
              onClick={() => setRange(d)}
            >
              {d === 7 ? ru.admin.period7 : d === 30 ? ru.admin.period30 : ru.admin.period90}
            </button>
          ))}
        </div>
      ) : null}

      {error && (
        <div className="admin-form-error admin-dash-page__alert" role="alert">
          {error}
        </div>
      )}

      {tab === "dashboard" && dashboard ? (
        <>
          <div className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">{m.activeCampaigns}</span>
              <span className="admin-kpi-card__value">{dashboard.activeCampaigns}</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">{m.activePromotions}</span>
              <span className="admin-kpi-card__value">{dashboard.activePromotions}</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">{m.totalRedemptions}</span>
              <span className="admin-kpi-card__value">{dashboard.totalRedemptions}</span>
            </div>
            <div className="admin-kpi-card">
              <span className="admin-kpi-card__label">{m.repeatCustomers}</span>
              <span className="admin-kpi-card__value">{dashboard.repeatCustomers}</span>
            </div>
          </div>

          {dashboard.topPromotions.length > 0 ? (
            <section className="admin-dash-section">
              <h2 className="admin-dash-section__title">{m.topPromotions}</h2>
              <div className="admin-analytics-top">
                {dashboard.topPromotions.map((p) => (
                  <div key={p.id} className="admin-analytics-top__row">
                    <span>{p.title}</span>
                    <strong>{p.redemptions}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {dashboard.bestProducts.length > 0 ? (
            <section className="admin-dash-section">
              <h2 className="admin-dash-section__title">{m.bestProducts}</h2>
              <div className="admin-analytics-top">
                {dashboard.bestProducts.map((p, i) => (
                  <div key={`${p.productId ?? i}-${p.name}`} className="admin-analytics-top__row">
                    <span>{p.name}</span>
                    <strong>{p.quantity} шт.</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {tab === "promotions" ? (
        <>
          <section className="admin-dash-section">
            <h2 className="admin-dash-section__title">{m.newPromotion}</h2>
            <div className="admin-mkt-form">
              <input
                className="admin-mkt-input"
                placeholder={m.promotionTitle}
                value={newPromo.title}
                onChange={(e) => setNewPromo((s) => ({ ...s, title: e.target.value }))}
              />
              <select
                className="admin-mkt-input"
                value={newPromo.type}
                onChange={(e) =>
                  setNewPromo((s) => ({ ...s, type: e.target.value as MarketingPromotionType }))
                }
              >
                {MARKETING_PROMOTION_TYPE_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                className="admin-mkt-input"
                placeholder={m.promotionCode}
                value={newPromo.code}
                onChange={(e) => setNewPromo((s) => ({ ...s, code: e.target.value }))}
              />
              <input
                className="admin-mkt-input"
                type="number"
                placeholder={m.promotionPercent}
                value={newPromo.percent}
                onChange={(e) => setNewPromo((s) => ({ ...s, percent: e.target.value }))}
              />
              <button
                type="button"
                className="admin-mkt-btn admin-mkt-btn--primary"
                onClick={() => void createPromotion()}
                disabled={newPromo.title.trim() === ""}
              >
                {m.create}
              </button>
            </div>
          </section>

          {promotions.length === 0 ? (
            <p className="admin-dash-page__muted">{m.emptyPromotions}</p>
          ) : (
            <div className="admin-mkt-list">
              {promotions.map((p) => {
                const badge = promotionStatusBadge(p.status);
                return (
                  <div key={p.id} className="admin-mkt-card">
                    <div className="admin-mkt-card__main">
                      <span className="admin-mkt-card__title">{p.title}</span>
                      <span className="admin-mkt-card__meta">
                        {promotionTypeLabel(p.type)} · {formatPromotionValue(p)}
                        {p.code ? ` · ${p.code}` : ""}
                      </span>
                    </div>
                    <span className={`admin-mkt-badge admin-mkt-badge--${badge.tone}`}>
                      {badge.label}
                    </span>
                    <div className="admin-mkt-card__actions">
                      <button
                        type="button"
                        className="admin-mkt-btn"
                        onClick={() => void adminService.setMarketingPromotionActive(p.id, !p.active).then(load)}
                      >
                        {p.active ? m.pause : m.activate}
                      </button>
                      <button
                        type="button"
                        className="admin-mkt-btn admin-mkt-btn--danger"
                        onClick={() => void adminService.deleteMarketingPromotion(p.id).then(load)}
                      >
                        {m.remove}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {tab === "campaigns" ? (
        <>
          <section className="admin-dash-section">
            <h2 className="admin-dash-section__title">{m.newCampaign}</h2>
            <div className="admin-mkt-form">
              <input
                className="admin-mkt-input"
                placeholder={m.promotionTitle}
                value={newCampaign.title}
                onChange={(e) => setNewCampaign((s) => ({ ...s, title: e.target.value }))}
              />
              <input
                className="admin-mkt-input"
                type="number"
                placeholder="Бюджет, сом"
                value={newCampaign.budgetSom}
                onChange={(e) => setNewCampaign((s) => ({ ...s, budgetSom: e.target.value }))}
              />
              <button
                type="button"
                className="admin-mkt-btn admin-mkt-btn--primary"
                onClick={() => void createCampaign()}
                disabled={newCampaign.title.trim() === ""}
              >
                {m.create}
              </button>
            </div>
          </section>

          {campaigns.length === 0 ? (
            <p className="admin-dash-page__muted">{m.emptyCampaigns}</p>
          ) : (
            <div className="admin-mkt-list">
              {campaigns.map((c) => {
                const badge = campaignStatusBadge(c.status);
                return (
                  <div key={c.id} className="admin-mkt-card">
                    <div className="admin-mkt-card__main">
                      <span className="admin-mkt-card__title">{c.title}</span>
                      <span className="admin-mkt-card__meta">
                        {formatBudget(c.budgetSom)}
                      </span>
                    </div>
                    <span className={`admin-mkt-badge admin-mkt-badge--${badge.tone}`}>
                      {badge.label}
                    </span>
                    <div className="admin-mkt-card__actions">
                      <button
                        type="button"
                        className="admin-mkt-btn"
                        onClick={() =>
                          void adminService
                            .setMarketingCampaignState(c.id, { paused: !c.paused })
                            .then(load)
                        }
                      >
                        {c.paused ? m.activate : m.pause}
                      </button>
                      <button
                        type="button"
                        className="admin-mkt-btn admin-mkt-btn--danger"
                        onClick={() => void adminService.deleteMarketingCampaign(c.id).then(load)}
                      >
                        {m.remove}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      {tab === "loyalty" && loyalty ? (
        <LoyaltyEditor loyalty={loyalty} onSave={saveLoyalty} labels={m} />
      ) : null}
    </div>
  );
}

function LoyaltyEditor({
  loyalty,
  onSave,
  labels,
}: {
  loyalty: MerchantLoyaltyPayload;
  onSave: (rules: LoyaltyProgramRules) => void;
  labels: typeof ru.admin.marketing;
}) {
  const [rules, setRules] = useState<LoyaltyProgramRules>(loyalty.program);

  return (
    <>
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <span className="admin-kpi-card__label">{labels.enrolledCustomers}</span>
          <span className="admin-kpi-card__value">{loyalty.enrolledCustomers}</span>
        </div>
        <div className="admin-kpi-card">
          <span className="admin-kpi-card__label">{labels.totalPoints}</span>
          <span className="admin-kpi-card__value">{loyalty.totalPointsIssued}</span>
        </div>
      </div>

      <section className="admin-dash-section">
        <label className="admin-mkt-toggle">
          <input
            type="checkbox"
            checked={rules.enabled}
            onChange={(e) => setRules((r) => ({ ...r, enabled: e.target.checked }))}
          />
          <span>{labels.loyaltyEnabled}</span>
        </label>
        <div className="admin-mkt-form">
          <label className="admin-mkt-field">
            <span>{labels.pointsPerOrder}</span>
            <input
              className="admin-mkt-input"
              type="number"
              value={rules.pointsPerOrder}
              onChange={(e) =>
                setRules((r) => ({ ...r, pointsPerOrder: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="admin-mkt-field">
            <span>{labels.redeemThreshold}</span>
            <input
              className="admin-mkt-input"
              type="number"
              value={rules.redeemThreshold}
              onChange={(e) =>
                setRules((r) => ({ ...r, redeemThreshold: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="admin-mkt-field">
            <span>{labels.redeemValue}</span>
            <input
              className="admin-mkt-input"
              type="number"
              value={rules.redeemValueSom}
              onChange={(e) =>
                setRules((r) => ({ ...r, redeemValueSom: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <button
            type="button"
            className="admin-mkt-btn admin-mkt-btn--primary"
            onClick={() => onSave(rules)}
          >
            {labels.save}
          </button>
        </div>
      </section>
    </>
  );
}
