import { Component, type ReactNode } from "react";
export class OrderViewBoundary extends Component<
  { children: ReactNode; onFallback?: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        The order view could not load. A deployment may have updated its files.{" "}
        <button type="button" onClick={this.props.onFallback}>
          Show order details
        </button>{" "}
        <button type="button" onClick={() => window.location.reload()}>
          Reload workspace
        </button>
      </p>
    ) : (
      this.props.children
    );
  }
}
