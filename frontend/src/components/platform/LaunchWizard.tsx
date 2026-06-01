import type {
  LaunchWizardPayload,
  LaunchWizardStepId,
} from "../../services/platformApi";

export type LaunchWizardAction = LaunchWizardStepId;

const STEP_CTA: Record<LaunchWizardStepId, string> = {
  subscription: "Подписка",
  telegram_bot: "Бот",
  finik: "Finik",
  product: "Товары",
  storefront: "Витрина",
  test_order: "Тест-заказ",
};

type Props = {
  wizard: LaunchWizardPayload;
  readinessPct: number;
  onStepAction: (stepId: LaunchWizardAction) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function LaunchWizard({
  wizard,
  readinessPct,
  onStepAction,
  onRefresh,
  refreshing = false,
}: Props) {
  const pct = Math.round(
    (wizard.completedCount / Math.max(wizard.totalSteps, 1)) * 100,
  );

  if (wizard.complete) {
    return (
      <section className="mp-v2-section" aria-label="Запуск магазина">
        <h2 className="mp-v2-section-title">Запуск магазина</h2>
        <div className="mp-v2-card mp-launch-wizard mp-launch-wizard--done" role="status">
          <p className="mp-launch-wizard__done-title">Магазин готов к продажам</p>
          <p className="mp-launch-wizard__done-text">
            Все шаги выполнены. Можно принимать заказы от покупателей.
          </p>
          <p className="mp-launch-wizard__meta">
            Готовность {readinessPct}% · {wizard.completedCount}/{wizard.totalSteps}
          </p>
        </div>
      </section>
    );
  }

  const focusIndex =
    wizard.currentStepIndex >= 0 ? wizard.currentStepIndex : 0;
  const focusStep = wizard.steps[focusIndex];

  return (
    <section className="mp-v2-section" aria-label="Запуск магазина">
      <div className="mp-launch-wizard__head">
        <h2 className="mp-v2-section-title mp-launch-wizard__title">
          Запуск магазина
        </h2>
        {onRefresh ? (
          <button
            type="button"
            className="mp-launch-wizard__refresh"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? "…" : "Обновить"}
          </button>
        ) : null}
      </div>
      <div className="mp-v2-card mp-launch-wizard">
        <div className="mp-launch-wizard__progress-row">
          <p className="mp-launch-wizard__progress-label">
            {wizard.completedCount} из {wizard.totalSteps} шагов
          </p>
          <p className="mp-launch-wizard__progress-pct">{pct}%</p>
        </div>
        <div className="mp-v2-readiness-bar-wrap mp-launch-wizard__bar-wrap">
          <div
            className="mp-v2-readiness-bar mp-launch-wizard__bar"
            style={{ width: `${pct}%` }}
          />
        </div>

        {focusStep ? (
          <div className="mp-launch-wizard__focus" role="status">
            <p className="mp-launch-wizard__focus-kicker">Следующий шаг</p>
            <p className="mp-launch-wizard__focus-title">{focusStep.label}</p>
            <p className="mp-launch-wizard__focus-hint">{focusStep.hint}</p>
            <button
              type="button"
              className="mp-launch-wizard__focus-btn"
              onClick={() => onStepAction(focusStep.id)}
            >
              {STEP_CTA[focusStep.id]} →
            </button>
          </div>
        ) : null}

        <ol className="mp-launch-wizard__list">
          {wizard.steps.map((step, index) => {
            const isCurrent = index === focusIndex && !step.done;
            return (
              <li
                key={step.id}
                className={`mp-launch-wizard__item ${
                  step.done ? "mp-launch-wizard__item--done" : ""
                } ${isCurrent ? "mp-launch-wizard__item--current" : ""}`}
              >
                <span
                  className="mp-launch-wizard__check"
                  aria-hidden
                >
                  {step.done ? "✓" : index + 1}
                </span>
                <div className="mp-launch-wizard__item-body">
                  <span className="mp-launch-wizard__item-label">{step.label}</span>
                  {!step.done ? (
                    <span className="mp-launch-wizard__item-hint">{step.hint}</span>
                  ) : null}
                </div>
                {!step.done ? (
                  <button
                    type="button"
                    className="mp-launch-wizard__item-btn"
                    onClick={() => onStepAction(step.id)}
                  >
                    {STEP_CTA[step.id]}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
