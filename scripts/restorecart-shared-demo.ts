import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
const envFile = process.env.RESTORECART_DEMO_ENV_FILE || ".env";
try {
  Object.assign(process.env, parseEnv(readFileSync(envFile, "utf8")));
} catch {
  throw Error(
    "Choose the existing checkout .env using RESTORECART_DEMO_ENV_FILE. No credentials are included in the repository.",
  );
}
if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET)
  throw Error(
    "The selected file has no configured PayPal sandbox checkout credentials.",
  );
const port = Number(process.env.RESTORECART_DEMO_PORT || 4394);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("Choose a demo port from 1024 to 65535.");
Object.assign(process.env, {
  NODE_ENV: "development",
  PAYPAL_ENV: "sandbox",
  PAYPAL_PARTNER_MERCHANT_ID: "",
  PAYPAL_PARTNER_ATTRIBUTION_ID: "",
  PAYPAL_ALLOW_SHARED_DEMO: "true",
  PAYPAL_REQUIRE_SELLER_CONNECTION: "false",
  TURSO_DATABASE_URL: "",
  TURSO_AUTH_TOKEN: "",
  RESTORECART_REQUIRE_PERSISTENCE: "false",
  RESTORECART_DB_PATH:
    process.env.RESTORECART_DEMO_DB_PATH ||
    ".data/restorecart-shared-demo.sqlite",
  RESTORECART_PORT: String(port),
  RESTORECART_BASE_URL: `http://127.0.0.1:${port}`,
});
console.log(
  "Explicit shared sandbox demo. Uses a separate local database; seller onboarding is not verified.",
);
await import("../server/restorecart/index");
