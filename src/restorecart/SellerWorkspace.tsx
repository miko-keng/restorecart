import { SupportingRecords } from "./SupportingRecords";
import { FieldFindings } from "./FieldFindings";
import {
  productStatus,
  normalizeStockInput,
  productSaveIssues,
} from "./productReview";
import { GeminiReview } from "./GeminiReview";
import { matchesOrderFilter, sampleOrders } from "./orderExamples";
import { WooCommercePanel } from "./WooCommercePanel";
import { useProductDraft } from "./useProductDraft";
import { canRefundOrder } from "./orderStatus";
import { OrderViewBoundary } from "./OrderViewBoundary";
import { lazy, Suspense } from "react";
const OrderTable = lazy(() => import("./OrderTable"));
const PickupSchedule = lazy(() => import("./PickupSchedule"));
import { OrderProgress } from "./OrderProgress";
import { useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";
import {
  Upload,
  Sparkles,
  Eye,
  Download,
  Plus,
  CheckCircle2,
  Package,
  X,
  RefreshCw,
  Settings2,
  Store,
  RotateCcw,
} from "lucide-react";
import { MappingPanel, RecoveryPanel } from "./Continuity";
import "./seller.css";
type Props = {
  current: any;
  incidents: any[];
  session: any;
  api: (path: string, body?: any, method?: string) => Promise<any>;
  run: (label: string, fn: () => Promise<any>) => Promise<void>;
  busy: string;
  load: (id: string) => Promise<any>;
  loadList: () => Promise<any>;
};
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n / 100,
  );
export function SellerWorkspace(p: Props) {
  const [section, setSection] = useState("Shop editor"),
    [orderView, setOrderView] = useState("Orders"),
    [sampleMode, setSampleMode] = useState(false),
    [selectedOrder, setSelectedOrder] = useState(""),
    [readiness, setReadiness] = useState<any>(null),
    [mappings, setMappings] = useState<any[]>([]),
    [review, setReview] = useState<any>(null),
    [savedReview, setSavedReview] = useState<any>(null),
    [preview, setPreview] = useState(false),
    [publishChecklist, setPublishChecklist] = useState(false),
    [creating, setCreating] = useState(false),
    [message, setMessage] = useState(""),
    [newName, setNewName] = useState(""),
    [orders, setOrders] = useState<any[]>([]),
    [filter, setFilter] = useState("All"),
    [contact, setContact] = useState<any>(null),
    [loadError, setLoadError] = useState(""),
    [refreshAttempt, setRefreshAttempt] = useState(0),
    [restoreMode, setRestoreMode] = useState("operational"),
    [dirtyForms, setDirtyForms] = useState<Record<string, boolean>>({}),
    [operations, setOperations] = useState<any>(null);
  const dirtyCount = Object.values(dirtyForms).filter(Boolean).length;
  const onDirty = useCallback(
    (key: string, dirty: boolean) =>
      setDirtyForms((old) =>
        old[key] === dirty ? old : { ...old, [key]: dirty },
      ),
    [],
  );
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirtyCount) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a");
      if (
        dirtyCount &&
        a &&
        !a.target &&
        a.origin === location.origin &&
        a.pathname !== location.pathname &&
        !window.confirm(
          "You have unsaved product edits. They will be kept in this browser for 24 hours. Leave this page?",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
    };
  }, [dirtyCount]);
  const shop = p.current,
    closed = shop && !["draft", "live"].includes(shop.state);
  useEffect(() => {
    if (!shop) return;
    let alive = true;
    p.api(`/incidents/${shop.id}/operations`)
      .then((ops: any) => {
        if (alive) setOperations(ops);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [shop?.id, p.busy]);
  async function refresh() {
    await p.load(shop.id);
    await p.loadList();
  }
  async function refreshOrders() {
    setOrders(await p.api(`/orders?incident=${shop.id}`));
    setOperations(await p.api(`/incidents/${shop.id}/operations`));
  }
  useEffect(() => {
    setReview(null);
    setSavedReview(null);
    setCreating(false);
    setMessage("");
    setReadiness(null);
    setOrders([]);
    setSelectedOrder("");
    setFilter("All");
    setContact(null);
  }, [shop?.id]);
  useEffect(() => {
    if (!shop) return;
    let alive = true;
    setLoadError("");
    Promise.all([
      p.api(`/incidents/${shop.id}/readiness`),
      p.api(`/incidents/${shop.id}/mappings`),
      p.api(`/incidents/${shop.id}/contact`),
      p.api(`/orders?incident=${shop.id}`),
      p.api(`/incidents/${shop.id}/operations`),
      p.api(`/incidents/${shop.id}/review-result`),
    ])
      .then(([r, m, c, o, ops, saved]) => {
        if (alive) {
          setSavedReview(saved);
          setReview((current: any) =>
            current
              ? saved
                ? { ...saved, saved: current.saved !== false }
                : current
              : null,
          );
          setOperations(ops);
          setReadiness(r);
          setMappings(m);
          setContact(c);
          setOrders(o);
        }
      })
      .catch((e: any) => {
        if (alive) setLoadError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [shop?.id, shop?.revision, refreshAttempt]);
  // New buyer orders do not change the catalog revision. Refresh independently.
  useEffect(() => {
    if (!shop || section !== "Orders") return;
    let alive = true;
    const update = () => {
      if (document.visibilityState === "hidden") return;
      void p
        .api(`/orders?incident=${shop.id}`)
        .then((o) => {
          if (alive) {
            setOrders(o);
            void p
              .api(`/incidents/${shop.id}/operations`)
              .then(setOperations)
              .catch(() => {});
            setLoadError("");
          }
        })
        .catch((e: any) => {
          if (alive) setLoadError(e.message);
        });
    };
    update();
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [section, shop?.id]);
  async function files(files: FileList | null) {
    if (!files) return;
    await p.run("Saving source files", async () => {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024)
          throw Error("Each file must be 5 MB or smaller.");
        const data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(",")[1]);
          r.onerror = () => reject(Error("Could not read file."));
          r.readAsDataURL(file);
        });
        await p.api(`/incidents/${shop.id}/sources`, { name: file.name, data });
      }
      await refresh();
      setMessage(
        "Files saved. Select Import with Gemini to prepare your products.",
      );
    });
  }
  async function backup() {
    await p.run("Preparing shop backup", async () => {
      const k = await p.api(`/incidents/${shop.id}/kits`, {});
      location.assign(`/api/restorecart/kits/${k.id}`);
      setMessage(`Shop backup version ${k.version} downloaded.`);
    });
  }
  async function restore(file: File | undefined, practice: boolean) {
    if (!file) return;
    await p.run("Restoring shop backup", async () => {
      if (file.size > 28_000_000) throw Error("Backup file is too large.");
      const kit = await p.api("/kits/import", {
        kit: JSON.parse(await file.text()),
      });
      const result = await p.api(`/kits/${kit.id}/restore`, {
        mode: practice ? "rehearsal" : "operational",
      });
      await p.loadList();
      await p.load(result.incident.id);
      setSection("Shop editor");
      setMessage(result.report.message);
    });
  }
  useEffect(() => {
    if (!preview) return;
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(false);
      if (e.key === "Tab") {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".rc-draft-preview button,.rc-draft-preview a[href]",
          ),
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [preview]);
  const publishBlockers: string[] = [];
  if (closed) publishBlockers.push("This shop is closed to new orders.");
  if (shop?.rehearsal)
    publishBlockers.push("Practice mode cannot publish or take payments.");
  if (shop && !readiness) publishBlockers.push("Checking product readiness…");
  if (readiness && !readiness.products?.some((r: any) => r.status === "ready"))
    publishBlockers.push("Confirm at least one product and set aside stock.");
  const incomplete =
    readiness?.products?.filter((r: any) => r.status === "needs-information") ||
    [];
  if (incomplete.length)
    publishBlockers.push(
      ...incomplete.map(
        (r: any) =>
          `${r.name}: ${productStatus(r)}. Open the product to finish its review, or hide it from this shop.`,
      ),
    );
  if (shop && !shop.pickup?.trim())
    publishBlockers.push("Save pickup instructions in Shop details below.");
  useEffect(() => {
    if (publishChecklist && publishBlockers.length === 0 && dirtyCount === 0)
      setPublishChecklist(false);
  }, [publishChecklist, publishBlockers.length, dirtyCount]);
  const pending = orders.filter(
    (o) =>
      !["paid", "failed", "canceled"].includes(o.state) ||
      o.refund?.state === "checking",
  );
  const matches = (o: any) => matchesOrderFilter(o, filter);
  const visibleOrders = (sampleMode ? sampleOrders : orders).filter(matches);
  return (
    <main className="rc-workspace rc-seller-workspace">
      {shop && (
        <aside className="rc-workspace-sidebar">
          <span className="rc-sidebar-label">WORKSPACE</span>{" "}
          <nav className="rc-seller-navigation" aria-label="Seller sections">
            {["Shop editor", "Orders", "Recovery", "Settings"].map((t) => (
              <button
                key={t}
                className={t === section ? "active" : ""}
                aria-current={t === section ? "page" : undefined}
                onClick={() => {
                  if (
                    !dirtyCount ||
                    section === t ||
                    window.confirm(
                      "Unsaved product edits will be kept in this browser. Switch section?",
                    )
                  )
                    setSection(t);
                }}
              >
                <span aria-hidden="true">
                  {t === "Shop editor" ? (
                    <Store size={18} />
                  ) : t === "Orders" ? (
                    <Package size={18} />
                  ) : t === "Recovery" ? (
                    <RotateCcw size={18} />
                  ) : (
                    <Settings2 size={18} />
                  )}
                </span>
                {t}
              </button>
            ))}
          </nav>
          <p className="rc-sidebar-note">
            Recover your catalog.
            <br />
            Keep your shop moving.
          </p>
        </aside>
      )}
      <div className="rc-workspace-content">
        <div className="rc-workspace-heading">
          <div>
            <span className="rc-eyebrow">YOUR SELLER WORKSPACE</span>
            <h1>Seller workspace</h1>
            <p>Your catalog, orders and recovery in one place.</p>
            <small>
              {p.session?.storage?.externalConfigured
                ? "External database configured. Keep recovery reports and verify records after deployment."
                : "Demo data may reset after the service restarts. Download reports before redeploying."}
            </small>
          </div>
          <span className="rc-pill">
            {p.session.ai?.mode === "live" ? "Gemini enabled" : "AI offline"}
          </span>
        </div>
        <div className="rc-seller-selector">
          <label>
            Your shop
            <select
              aria-label="Select rescue shop"
              value={shop?.id || ""}
              disabled={!!p.busy}
              onChange={(e) =>
                p.run("Opening shop", () => p.load(e.target.value))
              }
            >
              <option value="" disabled>
                Select a shop
              </option>
              {p.incidents.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} · {i.state}
                </option>
              ))}
            </select>
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              p.run("Creating shop", async () => {
                const i = await p.api("/incidents", { name: newName });
                await p.loadList();
                await p.load(i.id);
                setNewName("");
                setSection("Shop editor");
              });
            }}
          >
            <label>
              New shop name
              <input
                required
                value={newName}
                maxLength={80}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Your business name"
              />
            </label>
            <button className="rc-button secondary" disabled={!!p.busy}>
              <Plus size={17} />
              New shop
            </button>
          </form>
        </div>
        <button
          className="rc-link"
          disabled={!!p.busy}
          onClick={() =>
            p.run("Preparing demo shop", async () => {
              const demo = await p.api("/demo/prepare", {});
              await p.loadList();
              await p.load(demo.id);
              setSection("Shop editor");
            })
          }
        >
          Load prepared Sunday Studio Demo
        </button>
        <button
          className="rc-link"
          disabled={!!p.busy}
          onClick={() => {
            if (
              dirtyCount &&
              !window.confirm(
                "Your unsaved edits will remain in this browser. Open the separate practice draft?",
              )
            )
              return;
            p.run("Opening conflict practice", async () => {
              const demo = await p.api("/demo/prepare", { practice: true });
              await p.loadList();
              await p.load(demo.id);
              setSection("Shop editor");
            });
          }}
        >
          Open conflict practice draft
        </button>
        {!shop ? (
          <section className="rc-panel">
            <h2>Create your shop to get started.</h2>
            <p>Then upload records or try the sample files.</p>
          </section>
        ) : (
          <>
            {dirtyCount > 0 && (
              <p className="rc-notice" role="status">
                {dirtyCount} product(s) have unsaved edits. Saving a different
                product keeps these edits.
              </p>
            )}
            {operations?.ai && (
              <p role="status">
                Gemini: {operations.ai.remaining} calls available this window.
                Allowance renews{" "}
                {new Date(operations.ai.retryAt).toLocaleString()}. Cached
                answers use no allowance.
              </p>
            )}

            <div className="rc-editor-toolbar">
              <span>
                <b>{shop.name}</b> ·{" "}
                {shop.state === "live"
                  ? "Published"
                  : shop.state === "draft"
                    ? "Unpublished draft"
                    : "Closed to new orders"}
              </span>
              <div>
                <button
                  className="rc-button secondary"
                  onClick={() => setPreview(true)}
                >
                  <Eye size={16} />
                  Preview saved draft
                </button>
                {shop.published && (
                  <a
                    className="rc-button secondary"
                    href={`/s/${shop.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View published shop ↗
                  </a>
                )}
                <button
                  className="rc-button"
                  disabled={!!p.busy}
                  aria-describedby="rc-publish-status"
                  onClick={() => {
                    if (publishBlockers.length || dirtyCount) {
                      setPublishChecklist(true);
                      return;
                    }
                    p.run("Publishing shop", async () => {
                      await p.api(`/incidents/${shop.id}/publish`, {
                        revision: shop.revision,
                      });
                      await refresh();
                      setMessage(
                        "Published. Your customers can now order from this shop.",
                      );
                    });
                  }}
                >
                  {shop.published ? "Publish changes" : "Publish shop"}
                </button>
              </div>
              <p
                id="rc-publish-status"
                className="rc-publish-status"
                role="status"
              >
                {publishBlockers.length
                  ? publishBlockers.join(" ")
                  : "Ready to publish your saved products and shop details."}
              </p>
            </div>
            {publishChecklist && (
              <section className="rc-panel" aria-label="Publishing checklist">
                <h3>Finish preparing your shop</h3>
                <p>
                  Nothing has been published. Resolve these items or hide
                  products you do not want to sell.
                </p>
                {dirtyCount > 0 && (
                  <p>Save your unsaved product edits first.</p>
                )}
                {publishBlockers
                  .filter(
                    (issue) =>
                      !incomplete.some((r: any) =>
                        issue.startsWith(`${r.name}:`),
                      ),
                  )
                  .map((issue, i) => (
                    <p key={i}>{issue}</p>
                  ))}
                {incomplete.map((r: any) => (
                  <button
                    className="rc-link"
                    key={r.sku}
                    onClick={() => {
                      setSection("Shop editor");
                      requestAnimationFrame(() => {
                        const target = document.getElementById(
                          `rc-product-${r.sku}`,
                        ) as HTMLDetailsElement;
                        if (target) {
                          target.open = true;
                          target.scrollIntoView({
                            block: "center",
                            behavior: "instant",
                          });
                          target.querySelector("input")?.focus();
                        }
                      });
                    }}
                  >
                    Review {r.name} · {productStatus(r)} →
                  </button>
                ))}
                <button
                  className="rc-link"
                  onClick={() => setPublishChecklist(false)}
                >
                  Close checklist
                </button>
              </section>
            )}
            {loadError && (
              <p role="alert" className="rc-alert">
                Could not refresh this workspace: {loadError}
                <button
                  type="button"
                  className="rc-link"
                  onClick={() => setRefreshAttempt((n) => n + 1)}
                >
                  Retry workspace refresh
                </button>
              </p>
            )}
            {shop.conflictPractice && section === "Shop editor" && (
              <p className="rc-notice">
                Practice draft · Original sample records contain a Blue mug
                price conflict: CSV $20 / PDF $18. Show the saved Gemini review,
                choose the current price and save your decision. Your other shop
                is unchanged.
              </p>
            )}
            {shop.demoPrepared &&
              !shop.conflictPractice &&
              section === "Shop editor" && (
                <p className="rc-notice">
                  Prepared demo: sample records and shop details are already
                  saved. Complete the product review below. These starting
                  records were preloaded; show the saved Gemini review or
                  optionally run a fresh review.
                </p>
              )}
            {message && (
              <p className="rc-notice" role="status">
                <CheckCircle2 size={17} />
                {message}
              </p>
            )}
            {shop.rehearsal && (
              <section className="rc-panel">
                <h3>Practice draft · payments disabled</h3>
                <p>
                  This backup rehearsal cannot publish or change the original
                  shop.
                </p>
                <button
                  className="rc-button secondary"
                  disabled={!!p.busy}
                  onClick={() =>
                    p.run("Practicing record return", async () => {
                      const result = await p.api(
                        `/incidents/${shop.id}/rehearse-return`,
                        {},
                      );
                      setMessage(
                        `${result.passed ? "Passed" : "Needs attention"}: ${result.firstChanges} first-run changes, ${result.repeatChanges} repeat changes. No real orders changed.`,
                      );
                    })
                  }
                >
                  Practice returning a sale
                </button>
              </section>
            )}
            {section === "Shop editor" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <section className="rc-panel">
                  <div className="rc-seller-sectionhead">
                    <div>
                      <span className="rc-eyebrow">1 · IMPORT</span>
                      <h2>Bring your product records.</h2>
                      <p>
                        Gemini reads your documents and matches photos to
                        variants. Original files stay private.
                      </p>
                    </div>
                  </div>
                  <label className="rc-seller-drop">
                    <Upload size={26} />
                    <b>Choose CSV, PDF or product images</b>
                    <span>5 MB each · up to 10 files</span>
                    <input
                      type="file"
                      accept=".csv,.pdf,.png,.jpg,.jpeg"
                      multiple
                      className="rc-sr"
                      disabled={!!p.busy || closed}
                      onChange={(e) => {
                        void files(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <div className="rc-buttonrow">
                    <button
                      className="rc-button secondary"
                      disabled={!!p.busy || closed || shop.sources?.length > 0}
                      onClick={() =>
                        p.run("Loading sample files", async () => {
                          await p.api(`/incidents/${shop.id}/example`, {});
                          await refresh();
                          setMessage(
                            "Sample files loaded. Select Import with Gemini.",
                          );
                        })
                      }
                    >
                      Use sample files
                    </button>
                    <button
                      className="rc-button"
                      disabled={!!p.busy || closed || !shop.sources?.length}
                      onClick={() =>
                        p.run("Gemini is preparing your catalog", async () => {
                          await p.api(`/incidents/${shop.id}/reconstruct`, {});
                          await refresh();
                          setReview(null);
                          setMessage(
                            "Catalog prepared. Check highlighted questions and confirm stock below.",
                          );
                        })
                      }
                    >
                      <Sparkles size={17} />
                      Import with Gemini
                    </button>
                  </div>
                  <small>
                    Import sends these records and images to Gemini. AI
                    suggestions are never published automatically.
                  </small>
                  {shop.sources?.length > 0 && (
                    <details className="rc-source-files">
                      <summary>{shop.sources.length} source files</summary>
                      {shop.sources.map((s: any) => (
                        <a
                          href={`/api/restorecart/sources/${s.id}`}
                          target="_blank"
                          rel="noreferrer"
                          key={s.id}
                        >
                          {s.name}
                        </a>
                      ))}
                    </details>
                  )}
                  {mappings.some((m) => m.recognizedProducts === 0) &&
                    !shop.products.length && (
                      <details>
                        <summary>
                          Import needs help identifying spreadsheet columns
                        </summary>
                        <MappingPanel
                          current={shop}
                          api={p.api}
                          run={p.run}
                          busy={p.busy}
                          dirty={false}
                          refresh={refresh}
                        />
                      </details>
                    )}
                </section>
                <section className="rc-panel">
                  <div className="rc-seller-sectionhead">
                    <div>
                      <span className="rc-eyebrow">2 · REVIEW</span>
                      <h2>Check your products.</h2>
                      <p>
                        {readiness?.products?.filter(
                          (r: any) => r.status === "ready",
                        ).length || 0}{" "}
                        ready ·{" "}
                        {readiness?.products?.filter(
                          (r: any) => r.status === "needs-information",
                        ).length || 0}{" "}
                        need attention
                      </p>
                    </div>
                    <div className="rc-gemini-actions">
                      {savedReview && (
                        <button
                          className="rc-button secondary"
                          disabled={!!p.busy}
                          onClick={() =>
                            p.run(
                              "Showing saved Gemini review — no API call",
                              async () => {
                                const saved = await p.api(
                                  `/incidents/${shop.id}/review-result`,
                                );
                                setSavedReview(saved);
                                setReview(saved);
                              },
                            )
                          }
                        >
                          <Sparkles size={16} />
                          Show saved Gemini review
                        </button>
                      )}
                      <button
                        className="rc-link"
                        disabled={!!p.busy || closed || !shop.products.length}
                        onClick={() =>
                          p.run("Running a fresh Gemini review", async () => {
                            await p.api(`/incidents/${shop.id}/review`, {
                              fresh: true,
                            });
                            const latest = await p.api(
                              `/incidents/${shop.id}/review-result`,
                            );
                            setSavedReview(latest);
                            setReview({ ...latest, saved: false });
                          })
                        }
                      >
                        Run a fresh review
                      </button>
                    </div>
                  </div>
                  <p className="rc-review-status" role="status">
                    {savedReview
                      ? "A saved Gemini answer is available. Show it without using tokens, or optionally request a fresh review of saved records."
                      : "A fresh review checks saved records for conflicts and suggestions. It does not approve products or confirm physical stock."}
                  </p>
                  {review && <GeminiReview review={review} shop={shop} />}
                  {!shop.products.length && !creating && (
                    <p>
                      Import your records to prepare products, or add one
                      manually.
                    </p>
                  )}
                  {shop.products.map((product: any) => {
                    const row = readiness?.products?.find(
                      (r: any) => r.sku === product.sku,
                    );
                    return (
                      <details
                        className="rc-seller-product"
                        id={`rc-product-${product.sku}`}
                        key={`${shop.id}:${product.sku}`}
                        open={
                          row?.status !== "ready" && row?.status !== "excluded"
                        }
                      >
                        <summary>
                          <span className="rc-product-identity">
                            <span
                              className="rc-product-thumbnail"
                              aria-hidden="true"
                            >
                              {product.imageSourceId ? (
                                <img
                                  src={`/api/restorecart/sources/${product.imageSourceId}`}
                                  alt=""
                                />
                              ) : (
                                <Package size={20} />
                              )}
                            </span>
                            <span>
                              <b>{product.name}</b>
                              <small>{product.sku}</small>
                            </span>
                          </span>
                          <span>
                            {product.price
                              ? `$${product.price}`
                              : "Price needed"}
                          </span>
                          <span
                            className="rc-pill"
                            data-status={row?.status || "needs-information"}
                          >
                            {productStatus(row)}
                          </span>
                        </summary>
                        <ProductForm
                          key={`${shop.id}:${product.sku}`}
                          onDirty={onDirty}
                          product={product}
                          row={row}
                          shop={shop}
                          review={review}
                          closed={closed}
                          p={p}
                          saved={async (notice: string) => {
                            await refresh();
                            setMessage(
                              notice ||
                                "Product saved. Check its publishing status below.",
                            );
                          }}
                        />
                      </details>
                    );
                  })}
                  {creating && (
                    <ProductForm
                      key={`new:${shop.id}`}
                      product={{
                        sku: "",
                        name: "",
                        description: "",
                        price: "",
                        allocation: 0,
                        resolutionNote: "",
                      }}
                      shop={shop}
                      review={null}
                      closed={closed}
                      p={p}
                      create
                      saved={async () => {
                        setCreating(false);
                        await refresh();
                        setMessage("Product added.");
                      }}
                    />
                  )}
                  <button
                    className="rc-link"
                    disabled={!!p.busy || closed}
                    onClick={() => setCreating(!creating)}
                  >
                    <Plus size={16} />
                    {creating ? "Cancel new product" : "Add product manually"}
                  </button>
                </section>
                {contact && (
                  <ShopDetails
                    key={shop.id}
                    p={p}
                    contact={contact}
                    saved={async () => {
                      await refresh();
                      setMessage(
                        "Shop details saved. Publish to update the public version.",
                      );
                    }}
                  />
                )}
              </motion.div>
            )}
            {section === "Orders" && (
              <section className="rc-panel">
                <div className="rc-seller-sectionhead">
                  <div>
                    <h2>Orders</h2>
                    {operations?.worker?.pending > 0 && (
                      <p role="status">
                        Payment verification{" "}
                        {operations.worker.delayed
                          ? "delayed — retrying"
                          : "in progress"}
                        . {operations.worker.pending} outcome(s) outstanding.
                        Use Check PayPal again on an order.
                      </p>
                    )}
                    <details>
                      <summary>Payment check status</summary>
                      <p>
                        Last worker pass:{" "}
                        {operations?.worker?.completedAt
                          ? new Date(
                              operations.worker.completedAt,
                            ).toLocaleString()
                          : "Not yet recorded"}{" "}
                        · Retries for this shop:{" "}
                        {operations?.worker?.retries || 0}
                      </p>
                    </details>
                    <p>
                      Orders for <b>{shop.name}</b> only. Refreshes
                      automatically every 15 seconds.
                    </p>
                    <small>
                      Missing an order? Check the shop selected above and the
                      seller account that owns the published link.
                    </small>
                  </div>
                  <button
                    className="rc-button secondary"
                    disabled={!!p.busy}
                    onClick={() => p.run("Refreshing orders", refreshOrders)}
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                </div>
                <div className="rc-order-filters">
                  {[
                    "All",
                    "Payment checking",
                    "To prepare",
                    "Ready for pickup",
                    "Collected",
                    "Canceled / refunded",
                  ].map((f) => (
                    <button
                      key={f}
                      className={filter === f ? "active" : ""}
                      aria-pressed={filter === f}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="rc-order-filters" aria-label="Order data">
                  {[false, true].map((sample) => (
                    <button
                      key={String(sample)}
                      className={sampleMode === sample ? "active" : ""}
                      aria-pressed={sampleMode === sample}
                      onClick={() => {
                        setSampleMode(sample);
                        setSelectedOrder("");
                      }}
                    >
                      {sample ? "Sample preview" : "Actual sandbox orders"}
                    </button>
                  ))}
                </div>
                {sampleMode && (
                  <p role="status" className="rc-notice">
                    Sample preview — no transactions. These examples never
                    change stock, payments or recovery reports.
                  </p>
                )}
                <div className="rc-order-filters" aria-label="Order display">
                  {["Orders", "Pickup schedule"].map((v) => (
                    <button
                      key={v}
                      className={orderView === v ? "active" : ""}
                      aria-pressed={orderView === v}
                      onClick={() => {
                        setOrderView(v);
                        setSelectedOrder("");
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <OrderViewBoundary
                  key={`${orderView}:${sampleMode}`}
                  onFallback={() => setOrderView("Details")}
                >
                  {orderView === "Orders" && (
                    <div className="rc-desktop-orders">
                      <Suspense fallback={<p>Loading order table…</p>}>
                        <OrderTable
                          orders={visibleOrders}
                          onSelect={setSelectedOrder}
                        />
                      </Suspense>
                    </div>
                  )}
                  {orderView === "Pickup schedule" && (
                    <Suspense fallback={<p>Loading pickup schedule…</p>}>
                      <PickupSchedule orders={visibleOrders} />
                    </Suspense>
                  )}
                </OrderViewBoundary>
                {!visibleOrders.length ? (
                  <p>
                    No orders match “{filter}”.{" "}
                    <button
                      className="rc-link"
                      onClick={() => setFilter("All")}
                    >
                      View all orders
                    </button>
                    {!sampleMode && (
                      <>
                        {" "}
                        or{" "}
                        <button
                          className="rc-link"
                          onClick={() => setSampleMode(true)}
                        >
                          explore sample orders
                        </button>
                      </>
                    )}
                    .
                  </p>
                ) : (
                  ["Orders", "Details"].includes(orderView) && (
                    <div className="rc-order-details">
                      {visibleOrders.map((o) => (
                        <div
                          key={`${sampleMode}:${o.id}`}
                          className={
                            selectedOrder === o.id || orderView === "Details"
                              ? "rc-selected-order"
                              : "rc-mobile-order"
                          }
                        >
                          {selectedOrder === o.id && (
                            <button
                              className="rc-link"
                              onClick={() => setSelectedOrder("")}
                            >
                              Close order details
                            </button>
                          )}
                          {sampleMode ? (
                            <article className="rc-panel">
                              <h3>Sample order · {o.id}</h3>
                              <p>1 × Blue mug · $20.00</p>
                              <OrderProgress order={o} />
                              <small>
                                Preview only. To manage a purchase, switch to
                                Actual sandbox orders.
                              </small>
                            </article>
                          ) : (
                            <SellerOrder
                              order={o}
                              shop={shop}
                              p={p}
                              refreshed={refreshOrders}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )
                )}
              </section>
            )}
            {section === "Settings" && (
              <section className="rc-panel">
                <h2>Backups and connections</h2>
                <h3>Data storage</h3>
                <p>
                  {operations?.storage?.message ||
                    "Checking storage configuration…"}
                </p>
                <p>
                  Optional tools for preparing backups and returning sales to
                  another store.
                </p>{" "}
                <details className="rc-backup-menu">
                  <summary>Shop backup</summary>
                  <button
                    className="rc-link"
                    disabled={!!p.busy || !shop.products.length}
                    onClick={backup}
                  >
                    <Download size={16} />
                    Download shop backup
                  </button>
                  <p>
                    A backup contains products, pictures and shop details, not
                    orders. Restoring creates an unpublished shop with fresh
                    stock checks.
                  </p>
                  <label>
                    Open backup as
                    <select
                      value={restoreMode}
                      onChange={(e) => setRestoreMode(e.target.value)}
                    >
                      <option value="operational">New shop draft</option>
                      <option value="rehearsal">
                        Practice only — no publishing or payments
                      </option>
                    </select>
                  </label>
                  <label className="rc-link">
                    Upload shop backup (.json)
                    <input
                      className="rc-sr"
                      type="file"
                      accept=".json"
                      disabled={!!p.busy}
                      onChange={(e) => {
                        void restore(
                          e.target.files?.[0],
                          restoreMode === "rehearsal",
                        );
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <small>
                    Use a backup downloaded from RestoreCart. For CSV, PDF or
                    pictures, use the product-record upload below.
                  </small>
                </details>{" "}
                <WooCommercePanel
                  current={shop}
                  api={p.api}
                  run={p.run}
                  busy={p.busy}
                />
              </section>
            )}
            {section === "Recovery" && (
              <>
                <section className="rc-panel">
                  <span className="rc-eyebrow">FINISH EMERGENCY SELLING</span>
                  <h2>Return to your original shop.</h2>
                  <ol className="rc-recovery-steps">
                    <li>
                      <h3>Stop accepting new orders</h3>
                      <p>Existing payments will continue to be checked.</p>
                      <button
                        className="rc-button secondary"
                        disabled={!!p.busy || shop.state !== "live"}
                        onClick={() =>
                          p.run("Stopping new orders", async () => {
                            await p.api(`/incidents/${shop.id}/close`, {});
                            await refresh();
                            setMessage(
                              "New orders stopped. Check outstanding payments before downloading the final report.",
                            );
                          })
                        }
                      >
                        {closed
                          ? "New orders stopped"
                          : shop.state === "draft"
                            ? "Shop is not published"
                            : "Stop new orders"}
                      </button>
                    </li>
                    <li>
                      <h3>Check unresolved payments</h3>
                      <p>
                        {pending.length
                          ? `${pending.length} orders need a payment or refund outcome.`
                          : "No unresolved payments."}
                      </p>
                      <button
                        className="rc-link"
                        onClick={() => {
                          setFilter("Payment checking");
                          setSection("Orders");
                        }}
                      >
                        Review payment issues →
                      </button>
                    </li>
                    <li>
                      <h3>Download your sales report</h3>
                      <p>
                        Orders, payments, refunds and stock movements recorded
                        during the outage.
                      </p>
                      <button
                        className="rc-button"
                        disabled={!!p.busy || !closed || pending.length > 0}
                        onClick={() =>
                          p.run("Preparing sales report", async () => {
                            const report = await p.api(
                              `/incidents/${shop.id}/exports`,
                              {},
                            );
                            await refresh();
                            location.assign(
                              `/api/restorecart/exports/${report.manifest.id}?file=report`,
                            );
                            setMessage(
                              "Sales report downloaded. Your original website has not been changed.",
                            );
                          })
                        }
                      >
                        <Download size={17} />
                        Download sales report
                      </button>
                    </li>
                  </ol>
                </section>
                <details className="rc-panel">
                  <summary>Optional: update a local recovery file</summary>
                  <p>
                    Compare a fresh Original Store JSON v1 file with emergency
                    sales. This updates a local file, not Shopify or
                    WooCommerce.
                  </p>
                  <RecoveryPanel
                    current={shop}
                    api={p.api}
                    run={p.run}
                    busy={p.busy}
                    dirty={false}
                    refresh={refresh}
                  />
                </details>
              </>
            )}
          </>
        )}
        {preview && shop && (
          <div className="rc-modal-backdrop" onClick={() => setPreview(false)}>
            <section
              className="rc-modal rc-draft-preview"
              role="dialog"
              aria-modal="true"
              aria-label="Saved draft preview"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                autoFocus
                className="rc-iconbutton rc-modal-close"
                aria-label="Close preview"
                onClick={() => setPreview(false)}
              >
                <X />
              </button>
              <span className="rc-eyebrow">
                SAVED DRAFT PREVIEW · NO CHECKOUT
              </span>
              <h2>{shop.name}</h2>
              <p>{contact?.status}</p>
              <p>
                {shop.pickup || "Add pickup instructions before publishing."}
              </p>
              <p>
                Hidden products:{" "}
                {shop.products
                  .filter((v: any) => v.excluded)
                  .map((v: any) => v.name)
                  .join(", ") || "None"}
                . Products needing review are labelled below; checkout is
                disabled in preview.
              </p>
              <div className="rc-draft-products">
                {shop.products
                  .filter((v: any) => !v.excluded)
                  .map((v: any) => (
                    <article key={v.sku}>
                      {v.imageSourceId ? (
                        <img
                          src={`/api/restorecart/sources/${v.imageSourceId}`}
                          alt={v.name}
                        />
                      ) : (
                        <Package size={40} />
                      )}
                      <h3>{v.name}</h3>
                      <small>
                        {productStatus(
                          readiness?.products?.find(
                            (r: any) => r.sku === v.sku,
                          ),
                        )}
                      </small>
                      <b>{v.price ? `$${v.price}` : "Price needed"}</b>
                      <p>{v.description}</p>
                      <small>{v.allocation} set aside</small>
                    </article>
                  ))}
              </div>
              <p>
                Only saved changes appear here. Publish changes when you are
                ready for customers to see them.
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
function ProductForm({
  product,
  row,
  shop,
  review,
  closed,
  p,
  saved,
  create = false,
  onDirty,
}: any) {
  const initial = {
    ...product,
    quantity:
      shop.draftCounts?.[product.sku]?.quantity ??
      row?.count?.quantity ??
      shop.stockCounts?.[product.sku]?.quantity ??
      product.allocation,
    confirm: false,
    imageSourceId: product.imageSourceId || "",
  };
  const fingerprint = JSON.stringify([
    product.name,
    product.price,
    product.description,
    product.imageSourceId,
    product.allocation,
    product.excluded,
    product.resolved,
    product.resolutionNote,
    product.candidates,
    shop.stockCounts?.[product.sku]?.quantity,
    shop.draftCounts?.[product.sku]?.quantity,
  ]);
  const draft = useProductDraft(
    `rc-product:${p.session.user?.id || "seller"}:${shop.id}:${product.sku}`,
    initial,
    fingerprint,
    onDirty,
  );
  const { fields, change } = draft;
  const saveIssues = productSaveIssues(fields, product);
  const [saveNotice, setSaveNotice] = useState("");
  const stockChange = (field: string, value: string) => {
    const normalized = normalizeStockInput(value);
    if (normalized !== null) change(field, normalized);
  };
  const findings = (field: string) => (
    <FieldFindings
      field={field}
      product={product}
      review={review}
      fields={fields}
      sources={shop.sources || []}
      change={change}
    />
  );

  return (
    <form
      className="rc-product-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const action =
          ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)
            ?.value === "ready"
            ? "ready"
            : "draft";
        const activeIssues =
          action === "ready"
            ? [...saveIssues]
            : saveIssues.filter((issue) =>
                /whole units|physical count from|cannot exceed/.test(issue),
              );
        if (!fields.name?.trim() || !fields.sku?.trim())
          activeIssues.unshift("Enter a product name and SKU.");
        if (activeIssues.length) {
          setSaveNotice(activeIssues.join(" "));
          const form = e.currentTarget;
          const field = !fields.name?.trim()
            ? "name"
            : !fields.sku?.trim()
              ? "sku"
              : activeIssues.some((i) => /price|conflict/.test(i))
                ? !fields.price
                  ? "price"
                  : "resolutionNote"
                : activeIssues.some((i) =>
                      /set aside|set-aside|exceed/i.test(i),
                    )
                  ? "allocation"
                  : activeIssues.some((i) => /count|whole|units/.test(i))
                    ? "quantity"
                    : "confirm";
          form.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus();
          return;
        }
        p.run(
          action === "ready" ? "Marking product ready" : "Saving draft",
          async () => {
            if (draft.conflict)
              throw Error(
                "This product changed in another saved version. Your edits are preserved. Discard them to load the saved version, then review again.",
              );
            await p.api(`/incidents/${shop.id}/editor-product`, {
              revision: shop.revision,
              action,
              sku: fields.sku,
              name: fields.name,
              description: fields.description || "",
              price: fields.price || "",
              quantity: Number(fields.quantity),
              allocation: Number(fields.allocation),
              excluded: !!fields.excluded,
              confirm: action === "ready" && fields.confirm,
              resolutionNote: fields.resolutionNote || "",
              imageSourceId: fields.imageSourceId,
              create,
            });
            const notice = fields.excluded
              ? "Saved as hidden. This product will not appear in the next published catalog."
              : action === "draft"
                ? "Draft saved — not marked ready. Complete the checklist and select Mark ready when you have checked the details and stock."
                : "Product marked ready. Other included products must also be ready before publishing.";
            draft.clear();
            await saved(notice);
            setSaveNotice(notice);
          },
        );
      }}
    >
      {saveNotice && (
        <p className="rc-notice" role="status" aria-live="polite">
          {saveNotice}
        </p>
      )}
      {draft.dirty && (
        <p role="status">
          Unsaved changes · kept in this browser for 24 hours.
        </p>
      )}
      {draft.conflict && (
        <p role="alert">
          Saved details changed. Your edits are preserved; review the latest
          version before saving.
        </p>
      )}
      {draft.dirty && (
        <button type="button" className="rc-link" onClick={draft.discard}>
          Discard edits and load saved product
        </button>
      )}
      {findings("general")}
      <h3 className="rc-form-section-title">Product details</h3>
      <div className="rc-formgrid">
        <div className="rc-field-with-findings">
          <label>
            Product name
            <input
              name="name"
              required
              value={fields.name}
              onChange={(e) => change("name", e.target.value)}
              maxLength={160}
            />
          </label>
          {findings("name")}
        </div>
        <label>
          SKU / variant ID
          <input
            name="sku"
            required
            value={fields.sku}
            readOnly={!create}
            maxLength={80}
            onChange={(e) => change("sku", e.target.value)}
          />
        </label>
        <div className="rc-field-with-findings">
          <label>
            Price (USD)
            <input
              name="price"
              required={!fields.excluded}
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,2})?"
              value={fields.price}
              onChange={(e) => change("price", e.target.value)}
            />
          </label>
          {findings("price")}
        </div>
        <div className="rc-field-with-findings">
          <label>
            Product photo
            <select
              value={fields.imageSourceId}
              onChange={(e) => change("imageSourceId", e.target.value)}
            >
              <option value="">Illustrative placeholder</option>
              {shop.sources
                .filter((s: any) => s.mime.startsWith("image/"))
                .map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          {findings("imageSourceId")}
        </div>
      </div>
      {fields.imageSourceId && (
        <img
          className="rc-confirm-image"
          src={`/api/restorecart/sources/${fields.imageSourceId}`}
          alt={`Confirm photo for ${fields.name}`}
        />
      )}
      <div className="rc-field-with-findings">
        <label>
          Description
          <textarea
            maxLength={1000}
            value={fields.description || ""}
            onChange={(e) => change("description", e.target.value)}
          />
        </label>
        {findings("description")}
      </div>
      {new Set(
        product.candidates
          ?.filter((e: any) => e.field === "price")
          .map((e: any) => e.value),
      ).size > 1 && (
        <label>
          Which source confirms the current price?
          <input
            required={!fields.excluded}
            name="resolutionNote"
            value={fields.resolutionNote}
            maxLength={1000}
            onChange={(e) => change("resolutionNote", e.target.value)}
          />
        </label>
      )}
      <h3 className="rc-form-section-title">Stock and allocation</h3>
      <p className="rc-field-help">
        Count what you have, then choose how many units to sell here.
      </p>
      <div className="rc-formgrid">
        {" "}
        <label>
          Physical units counted
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]+"
            maxLength={5}
            required
            name="quantity"
            value={fields.quantity ?? ""}
            onChange={(e) => stockChange("quantity", e.target.value)}
          />
        </label>
        <label>
          Set aside for this shop
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]+"
            maxLength={5}
            required
            name="allocation"
            value={fields.allocation ?? ""}
            onChange={(e) => stockChange("allocation", e.target.value)}
          />
        </label>
      </div>
      <SupportingRecords
        product={product}
        sources={shop.sources || []}
        review={review}
      />
      <div className="rc-product-confirm">
        <label>
          <input
            type="checkbox"
            checked={!!fields.excluded}
            onChange={(e) => change("excluded", e.target.checked)}
          />
          <span>Hide this product from the shop</span>
        </label>
        <small>
          Keep it in your records, but leave it out of the next published
          catalog. Save this product, then publish changes to update an existing
          shop.
        </small>
        <label>
          <input
            type="checkbox"
            required={!fields.excluded}
            name="confirm"
            checked={fields.confirm}
            onChange={(e) => change("confirm", e.target.checked)}
          />
          <span>
            I checked the product, price and photo, counted the stock, and set
            these units aside.
          </span>
        </label>
        <small>Keep set-aside units out of other selling channels.</small>
      </div>
      {saveIssues.length > 0 &&
        (row?.status !== "ready" || draft.dirty || saveNotice) && (
          <div className="rc-product-questions" role="status">
            <strong>Before you can mark this product ready</strong>
            <ul>
              {saveIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
            <small>
              Nothing is published when you save. Every included product must be
              ready before Publish shop is available.
            </small>
          </div>
        )}
      <div className="rc-product-actions">
        <button
          type="submit"
          name="intent"
          value="draft"
          className="rc-button secondary"
          disabled={!!p.busy || closed || draft.conflict}
        >
          Save draft
        </button>
        <button
          type="submit"
          name="intent"
          value="ready"
          className="rc-button"
          disabled={!!p.busy || closed || draft.conflict}
        >
          {fields.excluded ? "Save as hidden" : "Mark ready"}
        </button>
      </div>
    </form>
  );
}
function ShopDetails({ p, contact, saved }: any) {
  const shop = p.current;
  return (
    <section className="rc-panel">
      <span className="rc-eyebrow">3 · SHOP DETAILS</span>
      <h2>How customers can reach you.</h2>
      <p>
        Enter these details yourself, then publish to update the customer
        version.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          p.run("Saving shop details", async () => {
            await p.api(`/incidents/${shop.id}/contact`, {
              contact: String(f.get("contact")),
              hours: String(f.get("hours")),
              status: String(f.get("status")),
            });
            await p.api(
              `/incidents/${shop.id}`,
              {
                revision: shop.revision,
                name: String(f.get("name")),
                pickup: String(f.get("pickup")),
                originalUrl: String(f.get("originalUrl")),
                products: shop.products.map(
                  ({ issues, available, ...product }: any) => product,
                ),
              },
              "PATCH",
            );
            await saved();
          });
        }}
      >
        <div className="rc-formgrid">
          <label>
            Shop name
            <input
              name="name"
              required
              defaultValue={shop.name}
              maxLength={80}
            />
          </label>
          <label>
            Public contact
            <input
              name="contact"
              defaultValue={contact.contact}
              maxLength={160}
            />
          </label>
          <label>
            Pickup hours
            <input name="hours" defaultValue={contact.hours} maxLength={160} />
          </label>
          <label>
            Original website (optional)
            <input
              name="originalUrl"
              type="url"
              pattern="https://.*"
              defaultValue={shop.originalUrl}
            />
          </label>
        </div>
        <label>
          Pickup instructions
          <textarea
            name="pickup"
            required
            defaultValue={shop.pickup}
            maxLength={1000}
          />
        </label>
        <label>
          Message for customers
          <textarea
            name="status"
            defaultValue={contact.status}
            maxLength={300}
          />
        </label>
        <button
          className="rc-button secondary"
          disabled={!!p.busy || !["draft", "live"].includes(shop.state)}
        >
          Save shop details
        </button>
      </form>
      {shop.published && (
        <div className="rc-published-link">
          <label>
            Published shop link
            <input readOnly value={`${location.origin}/s/${shop.slug}`} />
          </label>
          <button
            className="rc-link"
            onClick={async () => {
              await navigator.clipboard.writeText(
                `${shop.name}: ${location.origin}/s/${shop.slug}\n${contact.status}\n${shop.published.pickup}`,
              );
              p.run("Announcement copied", async () => {});
            }}
          >
            Copy customer announcement
          </button>
        </div>
      )}
    </section>
  );
}
function SellerOrder({ order: o, shop, p, refreshed }: any) {
  const [help, setHelp] = useState<any>(null),
    [confirmRefund, setConfirmRefund] = useState(false),
    [confirmStock, setConfirmStock] = useState(false);
  const blocked = o.refund?.state === "checking";
  return (
    <article className="rc-order">
      <div className="rc-orderhead">
        <h3>{money(o.amount)}</h3>
        <b>{o.state.replaceAll("_", " ")}</b>
        <span>{o.fulfillment.replaceAll("_", " ")}</span>
        <small>{o.id.slice(-8)}</small>
      </div>
      <p>
        {o.snapshot.lines
          .map((l: any) => `${l.quantity} × ${l.name}`)
          .join(" · ")}
      </p>
      {o.pickupWindow && (
        <p>
          Pickup appointment: {new Date(o.pickupWindow.start).toLocaleString()}{" "}
          – {new Date(o.pickupWindow.end).toLocaleTimeString()}
        </p>
      )}
      {o.state === "paid" &&
        !o.refunded &&
        !blocked &&
        o.fulfillment !== "collected" && (
          <details>
            <summary>Schedule pickup time</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void p.run("Saving pickup appointment", async () => {
                  const start = new Date(String(f.get("pickupStart"))),
                    end = new Date(String(f.get("pickupEnd")));
                  if (
                    !Number.isFinite(start.getTime()) ||
                    !Number.isFinite(end.getTime())
                  )
                    throw Error("Enter valid pickup dates and times.");
                  await p.api(`/orders/${o.id}/pickup-window`, {
                    start: start.toISOString(),
                    end: end.toISOString(),
                  });
                  await refreshed();
                });
              }}
            >
              <label>
                Pickup starts
                <input name="pickupStart" type="datetime-local" required />
              </label>
              <label>
                Pickup ends
                <input name="pickupEnd" type="datetime-local" required />
              </label>
              <button className="rc-button secondary" disabled={!!p.busy}>
                Save pickup appointment
              </button>
            </form>
            <p>
              One pickup counter. Overlapping appointments are rejected. Save a
              time, then open Pickup schedule to see it.
            </p>
          </details>
        )}
      {o.refunded > 0 && (
        <p>Refunded {money(o.refunded)}. Stock is restored separately.</p>
      )}
      {blocked && (
        <p>
          Refund outcome is being checked. Do not hand over or restock these
          items yet.
        </p>
      )}
      <div className="rc-buttonrow">
        <button
          className="rc-button secondary"
          disabled={!!p.busy}
          onClick={() =>
            p.run("Checking PayPal status", async () => {
              await p.api(`/orders/${o.id}/check`, {});
              setHelp(null);
              await refreshed();
            })
          }
        >
          Check PayPal again
        </button>
        <button
          className="rc-link"
          disabled={!!p.busy}
          onClick={() =>
            p.run("Gemini is explaining the recorded status", async () =>
              setHelp(
                await p.api(`/incidents/${shop.id}/payment-help`, {
                  orderId: o.id,
                }),
              ),
            )
          }
        >
          <Sparkles size={16} />
          Explain with Gemini
        </button>
        {o.state === "paid" &&
          !o.refunded &&
          !blocked &&
          o.fulfillment !== "collected" && (
            <button
              className="rc-button"
              disabled={!!p.busy}
              onClick={() =>
                p.run("Updating pickup", async () => {
                  await p.api(`/orders/${o.id}/fulfillment`, {
                    state: o.fulfillment === "ready" ? "collected" : "ready",
                  });
                  await refreshed();
                })
              }
            >
              {o.fulfillment === "ready"
                ? "Mark collected"
                : "Mark ready for pickup"}
            </button>
          )}
      </div>
      {help && (
        <div className="rc-ai-review">
          <b>
            Recorded status: {help.facts.state} ·{" "}
            {money(help.facts.amount - help.facts.refunded)} net
          </b>
          <p>{help.explanation}</p>
          <p>Suggested next step: {help.nextAction.replaceAll("_", " ")}</p>
          <small>
            {help.uncertainty} Gemini cannot change payment status or issue a
            refund.
          </small>
        </div>
      )}
      {canRefundOrder(o) && (
        <details>
          <summary>Refund options</summary>
          <label>
            <input
              type="checkbox"
              checked={confirmRefund}
              onChange={(e) => setConfirmRefund(e.target.checked)}
            />
            I want to refund {money(o.amount)} through PayPal sandbox.
          </label>
          <button
            className="rc-button secondary"
            disabled={!confirmRefund || !!p.busy}
            onClick={() =>
              p.run("Requesting refund", async () => {
                await p.api(`/orders/${o.id}/refund`, {});
                await refreshed();
                setConfirmRefund(false);
              })
            }
          >
            Request full refund
          </button>
        </details>
      )}
      {o.state === "paid" && !o.refunded && o.fulfillment === "collected" && (
        <p>
          This order is collected. This prototype supports refunds for
          uncollected orders only.
        </p>
      )}
      {o.refunded > 0 && !o.refund?.restocked && !blocked && (
        <details>
          <summary>Return items to stock</summary>
          <label>
            <input
              type="checkbox"
              checked={confirmStock}
              onChange={(e) => setConfirmStock(e.target.checked)}
            />
            These items are physically back and available to sell.
          </label>
          <button
            className="rc-button secondary"
            disabled={!confirmStock || !!p.busy}
            onClick={() =>
              p.run("Restoring returned stock", async () => {
                await p.api(`/orders/${o.id}/restock`, {});
                await refreshed();
                setConfirmStock(false);
              })
            }
          >
            Confirm restock
          </button>
        </details>
      )}
    </article>
  );
}
