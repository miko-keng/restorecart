import { Component, type ReactNode } from "react";
export class OrderViewBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        This order view could not load. Choose Cards to continue managing your
        orders.
      </p>
    ) : (
      this.props.children
    );
  }
}
