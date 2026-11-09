import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { pickupTimeLabel } from "./OrderProgress";
import { orderProgress } from "./orderStatus";

type Props = {
  api: (path: string, body?: any, method?: string) => Promise<any>;
  run: (label: string, fn: () => Promise<any>) => Promise<void>;
  busy: string;
  go: (url: string) => void;
  onAuthenticated: () => Promise<void>;
  role: "buyer" | "seller";
};
export function AccountForm(p: Props) {
  const [register, setRegister] = useState(false),
    [identifier, setIdentifier] = useState(""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState("");
  return (
    <motion.div
      className="rc-signin"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2>
        {register ? "Create your " + p.role + " account" : "Welcome back."}
      </h2>
      <p>
        {p.role === "seller"
          ? "Your own catalog, rescue kits and orders."
          : "Keep your carts and purchases together."}
      </p>
      <div className="rc-account-tabs" aria-label="Account action">
        <button
          className="rc-link"
          aria-pressed={!register}
          onClick={() => setRegister(false)}
        >
          Sign in
        </button>
        <button
          className="rc-link"
          aria-pressed={register}
          onClick={() => setRegister(true)}
        >
          Register
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          p.run(register ? "Creating account" : "Signing in", async () => {
            await p.api(
              register ? "/register" : "/login",
              register
                ? { email: identifier, username, password, role: p.role }
                : { email: identifier, password },
            );
            setPassword("");
            await p.onAuthenticated();
          });
        }}
      >
        <label>
          {register ? "Email" : "Email or username"}
          <input
            type={register ? "email" : "text"}
            autoComplete={register ? "email" : "username"}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        {register && (
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={40}
              pattern="[a-z0-9][a-z0-9_-]{2,39}"
              title="3–40 lowercase letters, numbers, underscores or hyphens"
            />
          </label>
        )}
        <label>
          Password
          <input
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={register ? 10 : undefined}
            maxLength={200}
          />
        </label>
        {register && (
          <p>
            Use at least 10 characters. This prototype has no email verification
            or password reset yet.
          </p>
        )}
        <button className="rc-button" disabled={!!p.busy}>
          {p.busy || (register ? "Create " + p.role + " account" : "Sign in")}
        </button>
      </form>
      <a
        href={
          p.role === "seller"
            ? "/restorecart/account"
            : "/restorecart/seller/sign-in"
        }
      >
        {p.role === "seller"
          ? "Here to buy? Buyer sign-in"
          : "Here to sell? Seller sign-in"}
      </a>
    </motion.div>
  );
}
export function BuyerAccount(p: Props & { user: any }) {
  const [orders, setOrders] = useState<any[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!p.user) return;
    let alive = true;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      p.api("/my-orders")
        .then((orders) => {
          if (alive) {
            setOrders(orders);
            setError("");
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [p.user?.id]);
  return (
    <main
      className={
        p.user ? "rc-account-page rc-buyer-orders-page" : "rc-account-page"
      }
    >
      {p.user ? (
        <>
          <header className="rc-buyer-orders-heading">
            <h1>Your orders</h1>
            <a href="/restorecart/shops">Continue shopping →</a>
            {p.user.role === "seller" && (
              <a href="/restorecart/seller">Seller workspace →</a>
            )}
          </header>
          {error && <p role="alert">{error}</p>}
          {orders === null ? (
            !error && <p role="status">Loading orders…</p>
          ) : orders.length ? (
            <section
              className="rc-buyer-order-ledger"
              aria-label="Order history"
            >
              <div className="rc-buyer-order-columns" aria-hidden="true">
                <span>Order</span>
                <span>Status</span>
                <span>Pickup</span>
                <span>Total</span>
                <span />
              </div>
              <ul>
                {orders.map((order) => (
                  <li key={order.id}>
                    <a className="rc-buyer-order-row" href={order.receiptUrl}>
                      <span className="rc-buyer-order-name">
                        <span className="rc-sr">
                          View order {order.id.slice(-8)} from{" "}
                        </span>
                        <strong>{order.shopName}</strong>
                        <small>
                          {order.items
                            ?.map(
                              (item: any) => `${item.quantity} × ${item.name}`,
                            )
                            .join(", ") || `Order ${order.id.slice(-8)}`}
                        </small>
                      </span>
                      <span className="rc-buyer-order-status">
                        {orderProgress(order).label}
                      </span>
                      <span className="rc-buyer-order-time">
                        {order.pickupWindow
                          ? pickupTimeLabel(order.pickupWindow)
                          : "Not scheduled"}
                      </span>
                      <strong className="rc-buyer-order-total">
                        ${(order.amount / 100).toFixed(2)}
                      </strong>
                      <span className="rc-buyer-order-arrow" aria-hidden="true">
                        →
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p>No orders yet.</p>
          )}
        </>
      ) : (
        <AccountForm {...p} />
      )}
    </main>
  );
}
