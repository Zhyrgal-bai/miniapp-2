import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { error: Error | null };

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="app app--shop-missing">
          <div className="shop-missing" role="alert">
            <p className="shop-missing__title">Не удалось открыть приложение</p>
            <p className="shop-missing__hint">
              Произошла ошибка при загрузке. Закройте Mini App и откройте снова из бота.
            </p>
            <p className="shop-missing__hint" style={{ marginTop: 8, fontSize: "0.85rem" }}>
              {this.state.error.message}
            </p>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
                marginTop: 16,
              }}
            >
              <button
                type="button"
                className="checkout-btn"
                onClick={() => window.location.reload()}
              >
                Повторить
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
