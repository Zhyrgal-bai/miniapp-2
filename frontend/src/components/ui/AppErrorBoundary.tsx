import { Component, type ErrorInfo, type ReactNode } from "react";
import ArchaErrorShell from "../errors/ArchaErrorShell";
import "../../design/archaPremium.css";

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
        <ArchaErrorShell
          kind="crash"
          detail={this.state.error.message}
          showCode={false}
          actions={[
            {
              label: "Повторить",
              onClick: () => window.location.reload(),
              variant: "primary",
            },
            { label: "На ARCHA", href: "/merchant", variant: "ghost" },
          ]}
        />
      );
    }
    return this.props.children;
  }
}
