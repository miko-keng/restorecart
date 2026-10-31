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
        This order view could not load.{" "}
        <button type="button" onClick={this.props.onFallback}>
          Show order details
        </button>
      </p>
    ) : (
      this.props.children
    );
  }
}
