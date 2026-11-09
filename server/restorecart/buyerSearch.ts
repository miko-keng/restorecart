import { z } from "zod";
import { AgentBudget, runAgent } from "./agentRuntime";
import { config } from "./reconstruction";
import type { DB } from "./store";
import {
  browseProducts,
  type DirectoryShop,
} from "../../src/restorecart/directory";

const request = z
  .object({
    question: z.string().trim().min(1).max(400),
    previousQuestion: z.string().trim().max(400).optional(),
  })
  .strict();
const filters = z
  .object({
    keywords: z.string().max(120),
    maxPrice: z.number().positive().optional(),
    inStock: z.boolean().default(true),
  })
  .strict();

export async function searchAsBuyer(
  db: DB,
  buyerId: string,
  input: unknown,
  loadShops: () => DirectoryShop[],
  transport: typeof fetch = fetch,
) {
  const query = request.parse(input);
  const live =
    process.env.NODE_ENV === "test"
      ? transport !== fetch
      : config().ai.mode === "live";
  const fallback = { source: "directory", products: [], clarification: null };
  if (!live) return fallback;
  const shops = loadShops();
  const matches = new Map<
    string,
    { slug: string; sku: string; maxPrice: number; inStock: boolean }
  >();
  let initialFilters: z.infer<typeof filters> | undefined;
  const find = (input: z.infer<typeof filters>) =>
    browseProducts(shops, input.keywords, { inStock: input.inStock })
      .filter(
        ({ product }) =>
          input.maxPrice === undefined ||
          Number(product.price) <= input.maxPrice,
      )
      .slice(0, 12);
  try {
    const result = await runAgent({
      db,
      id: buyerId,
      accountId: buyerId,
      role: "buyer_search",
      transport,
      budget: new AgentBudget(3, 6, 25),
      context: query,
      instruction:
        "Help a buyer find published pickup products. Call searchPublishedProducts before recommending any product. Retain the buyer's price ceiling and stock requirement on every search unless they change it. Prices are USD. Compare actual matches or ask one short clarifying question. Return only IDs from search results and never invent price, stock, links or shop names.",
      tools: [
        {
          name: "searchPublishedProducts",
          description:
            "Find real published products with optional price and stock filters. Use an empty keyword string to search across all shops.",
          schema: filters,
          read: (input: z.infer<typeof filters>) => {
            initialFilters ??= input;
            const maxPrice = Math.min(
              initialFilters.maxPrice ?? Infinity,
              input.maxPrice ?? Infinity,
            );
            const inStock = initialFilters.inStock || input.inStock;
            return find({ keywords: input.keywords, maxPrice, inStock }).map(
              ({ shop, product }) => {
                const id = JSON.stringify([shop.slug, product.sku]);
                matches.set(id, {
                  slug: shop.slug,
                  sku: product.sku,
                  maxPrice,
                  inStock,
                });
                return {
                  id,
                  shop: shop.name,
                  name: product.name,
                  description: product.description.slice(0, 200),
                  price: product.price,
                  currency: product.currency,
                  available: product.available,
                };
              },
            );
          },
        },
        {
          name: "presentProducts",
          description:
            "Return matching product IDs in preferred order, or ask a question if more detail is needed.",
          schema: z
            .object({
              ids: z.array(z.string().max(400)).max(6),
              clarification: z.string().trim().min(1).max(200).optional(),
            })
            .strict(),
          final: true,
        },
      ],
    });
    const current = new Map(loadShops().map((shop) => [shop.slug, shop]));
    const products = [...new Set<string>(result.value.ids)].flatMap((id) => {
      const match = matches.get(id);
      if (!match) return [];
      const shop = current.get(match.slug);
      const product = shop?.products.find(
        (product) => product.sku === match.sku,
      );
      return shop &&
        product &&
        Number(product.price) <= match.maxPrice &&
        (!match.inStock || product.available > 0)
        ? [{ shop: { slug: shop.slug, name: shop.name }, product }]
        : [];
    });
    return {
      source: "gemini",
      products,
      clarification: result.value.ids.length
        ? null
        : (result.value.clarification ?? null),
    };
  } catch {
    return fallback;
  }
}
