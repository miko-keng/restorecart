import { Theme } from "@radix-ui/themes";
import type { ReactNode } from "react";
export function PaymentsUi({ children }: { children: ReactNode }) {
  return (
    <Theme
      className="rc-payments-ui"
      appearance="light"
      accentColor="teal"
      grayColor="sage"
      radius="large"
      hasBackground={false}
    >
      {children}
    </Theme>
  );
}
