import { useEffect, useState, useRef } from "react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  Text,
} from "@radix-ui/themes";
import {
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { PaymentsUi } from "./PaymentsUi";
export function PayPalConnectionPanel(p: any) {
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const setupTrigger = useRef<HTMLButtonElement>(null);
  const disconnectTrigger = useRef<HTMLButtonElement>(null);
  const path = `/incidents/${p.current.id}/paypal`;
  useEffect(() => {
    let alive = true;
    setStatus(null);
    setError("");
    setConsent(false);
    setDisconnecting(false);
    setSetupOpen(false);
    p.api(path)
      .then((value: any) => {
        if (alive) setStatus(value);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [p.current.id]);
  const run = (label: string, task: () => Promise<void>) =>
    p.run(label, async () => {
      setError("");
      try {
        await task();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Connection failed. Try again.",
        );
        try {
          setStatus(await p.api(path));
        } catch {
          /* Retain last known state. */
        }
      }
    });
  const connected = !!status?.connected;
  const label = !status
    ? error
      ? "Unavailable"
      : "Checking…"
    : connected
      ? "Connected · sandbox"
      : status.demo
        ? "Shared demo"
        : status.state === "pending"
          ? "Finish setup"
          : status.state === "revoked"
            ? "Permission removed"
            : "Not connected";
  return (
    <PaymentsUi>
      <Card
        className="rc-payment-card"
        size="3"
        aria-label="PayPal account connection"
      >
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <Flex align="center" gap="3">
            <span className="rc-payment-icon">
              <CreditCard size={21} />
            </span>
            <Heading as="h3" size="4">
              PayPal payments
            </Heading>
          </Flex>
          <Badge size="2" color={connected ? "teal" : "amber"}>
            {label}
          </Badge>
        </Flex>
        <Text as="p" size="2" color="gray" mt="3">
          {connected
            ? "Buyer payments go to your connected sandbox account."
            : status?.demo
              ? "Test payments use the configured demo account."
              : "Connect your sandbox account to receive buyer payments."}
        </Text>
        {status?.demo && (
          <p className="rc-payment-hint">
            Shared demo account active. Your account is not connected.
          </p>
        )}
        {error && (
          <p className="rc-payment-error" role="alert">
            {error}
          </p>
        )}
        <Flex gap="3" align="center" wrap="wrap" mt="4">
          {connected ? (
            <>
              <Button
                type="button"
                variant="soft"
                disabled={!!p.busy}
                onClick={() =>
                  run("Checking PayPal", async () =>
                    setStatus(await p.api(path + "/check", {})),
                  )
                }
              >
                <RefreshCw size={15} /> Check connection
              </Button>
              <Button
                type="button"
                variant="ghost"
                color="gray"
                ref={disconnectTrigger}
                onClick={() => setDisconnecting(true)}
              >
                Disconnect
              </Button>
            </>
          ) : !status ? (
            <Button
              type="button"
              variant="soft"
              disabled={!!p.busy || !error}
              onClick={() =>
                run("Checking PayPal setup", async () =>
                  setStatus(await p.api(path)),
                )
              }
            >
              {error ? "Retry connection status" : "Checking setup…"}
            </Button>
          ) : status.demo ? (
            <Button
              type="button"
              variant="soft"
              ref={setupTrigger}
              onClick={() => setSetupOpen(true)}
            >
              Seller connection options
            </Button>
          ) : !status.configured ? (
            <>
              <Button
                type="button"
                ref={setupTrigger}
                onClick={() => setSetupOpen(true)}
              >
                Connect PayPal <ArrowUpRight size={15} />
              </Button>
              <Text size="1" color="gray">
                Host setup needed
              </Text>
            </>
          ) : (
            <>
              <label className="rc-payment-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={!!p.busy}
                />
                I agree to share connection details with PayPal.
              </label>
              <Button
                type="button"
                disabled={!consent || !!p.busy}
                onClick={() =>
                  run("Opening PayPal", async () => {
                    const result = await p.api(path + "/connect", {
                      consent: true,
                    });
                    window.location.assign(result.url);
                  })
                }
              >
                {status.state === "pending"
                  ? "Restart connection"
                  : "Connect PayPal"}{" "}
                <ArrowUpRight size={15} />
              </Button>
              {status.state === "pending" && (
                <Button
                  type="button"
                  variant="soft"
                  disabled={!!p.busy}
                  onClick={() =>
                    run("Checking PayPal", async () =>
                      setStatus(await p.api(path + "/check", {})),
                    )
                  }
                >
                  <CheckCircle2 size={15} /> I finished setup
                </Button>
              )}
            </>
          )}
        </Flex>
        <details className="rc-payment-details">
          <summary>Connection details</summary>
          {connected && (
            <p>
              Merchant: {status.merchantId}
              {status.checkedAt
                ? ` · Checked ${new Date(status.checkedAt).toLocaleString()}`
                : ""}
            </p>
          )}
          <p>
            Sandbox only. No real money. PayPal handles sign-in and
            payment/refund permissions.
          </p>
          {status && !status.webhookConfigured && (
            <p>Webhook setup is pending on this server.</p>
          )}
          <a
            href="https://www.paypal.com/us/legalhub/paypal/seller-protection"
            target="_blank"
            rel="noreferrer"
          >
            Seller Protection eligibility
          </a>
        </details>
        <Dialog.Root open={setupOpen} onOpenChange={setSetupOpen}>
          <Dialog.Content
            maxWidth="460px"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              setupTrigger.current?.focus();
            }}
          >
            <Dialog.Title>
              {status?.demo
                ? "Shared sandbox demo"
                : "Seller connections need setup"}
            </Dialog.Title>
            <Dialog.Description size="2">
              {status?.demo
                ? "This demo uses the configured sandbox account. Individual seller connections are not active in this mode."
                : "The demo host must enable PayPal sandbox onboarding. Your account is not connected."}
            </Dialog.Description>
            <p className="rc-payment-hint">
              If you host this app, configure the Platform REST app, partner
              merchant ID and attribution code, then restart the server.
            </p>
            <Flex gap="3" mt="4" wrap="wrap">
              <Button
                type="button"
                variant="soft"
                onClick={() =>
                  run("Checking PayPal setup", async () => {
                    const next = await p.api(path);
                    setStatus(next);
                    if (next.configured) setSetupOpen(false);
                  })
                }
              >
                Check setup again
              </Button>
              <Dialog.Close>
                <Button type="button">Got it</Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
        <Dialog.Root open={disconnecting} onOpenChange={setDisconnecting}>
          <Dialog.Content
            maxWidth="440px"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              disconnectTrigger.current?.focus();
            }}
          >
            <Dialog.Title>Disconnect this shop?</Dialog.Title>
            <Dialog.Description size="2">
              New checkouts stop. Existing payments keep their original account.
              Remove permissions in PayPal to revoke access fully.
            </Dialog.Description>
            <Flex gap="3" mt="4">
              <Button
                type="button"
                color="red"
                disabled={!!p.busy}
                onClick={() =>
                  run("Disconnecting PayPal", async () => {
                    setStatus(await p.api(path + "/disconnect", {}));
                    setDisconnecting(false);
                  })
                }
              >
                Disconnect this shop
              </Button>
              <Dialog.Close>
                <Button type="button" variant="soft">
                  Keep connected
                </Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </Card>
    </PaymentsUi>
  );
}
