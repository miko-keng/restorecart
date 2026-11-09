import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Send, Sparkles, X } from "lucide-react";
import { OrderViewBoundary } from "./OrderViewBoundary";
import type { DirectoryProduct } from "./directory";

export type NewShop = { slug: string; name: string };
type SearchResult = {
  source: string;
  products: { shop: NewShop; product: DirectoryProduct }[];
  clarification: string | null;
};

export function BuyerSearch({
  search,
}: {
  search?: (
    question: string,
    previousQuestion?: string,
  ) => Promise<SearchResult>;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<
    { question: string; answer?: SearchResult; error?: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const signIn = useRef<HTMLAnchorElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) (input.current ?? signIn.current)?.focus();
  }, [open]);
  useEffect(() => {
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
  }, [turns, open]);

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }

  async function send(text: string) {
    text = text.trim();
    if (!text || busy || !search) return;
    const previous = turns.findLast(
      (turn) => turn.answer?.source === "gemini",
    )?.question;
    setQuestion("");
    setBusy(true);
    setTurns((current) => [...current.slice(-7), { question: text }]);
    try {
      const answer = await search(text, previous);
      setTurns((current) => [
        ...current.slice(0, -1),
        { question: text, answer },
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Search couldn’t load. Try again.";
      setTurns((current) => [
        ...current.slice(0, -1),
        { question: text, error: message },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rc-buyer-assistant">
      {open && (
        <section
          id={id}
          className="rc-buyer-chat"
          aria-label="Ask RestoreCart"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <header>
            <div className="rc-buyer-chat-mark">
              <Sparkles size={18} aria-hidden />
            </div>
            <div>
              <h2>Ask RestoreCart</h2>
              <p>Shopping assistant</p>
            </div>
            <button
              type="button"
              className="rc-icon"
              onClick={close}
              aria-label="Close shopping assistant"
            >
              <X size={20} />
            </button>
          </header>
          <div
            className="rc-buyer-chat-feed"
            role="log"
            aria-label="Shopping conversation"
            ref={feed}
          >
            <p className="rc-buyer-chat-bubble">
              What are you shopping for? I can find and compare products across
              rescue shops.
            </p>
            {search && !turns.length && (
              <button
                type="button"
                className="rc-buyer-chat-prompt"
                onClick={() => void send("Find in-stock mugs under $25")}
              >
                Find in-stock mugs under $25{" "}
                <ArrowUpRight size={14} aria-hidden />
              </button>
            )}
            {turns.map(({ question, answer, error }, index) => (
              <div className="rc-buyer-chat-turn" key={index}>
                <p className="rc-buyer-chat-bubble rc-buyer-chat-user">
                  <span className="rc-sr">You: </span>
                  {question}
                </p>
                {error ? (
                  <p className="rc-buyer-chat-bubble">{error}</p>
                ) : answer?.source === "directory" ? (
                  <p className="rc-buyer-chat-bubble">
                    AI search is unavailable. You can still use the directory
                    search and filters.
                  </p>
                ) : answer?.clarification ? (
                  <p className="rc-buyer-chat-bubble">{answer.clarification}</p>
                ) : answer?.products.length ? (
                  <div className="rc-buyer-chat-answer">
                    <p>
                      {answer.products.length === 1
                        ? "I found one match."
                        : `I found ${answer.products.length} matches.`}
                    </p>
                    <ul>
                      {answer.products.map(({ shop, product }) => (
                        <li key={JSON.stringify([shop.slug, product.sku])}>
                          <span>
                            <a
                              className="rc-buyer-chat-product"
                              href={`/s/${encodeURIComponent(shop.slug)}#${encodeURIComponent(`product-${product.sku}`)}`}
                            >
                              <strong>{product.name}</strong>{" "}
                              <ArrowUpRight size={13} aria-hidden />
                            </a>
                            <small>
                              <a href={`/s/${encodeURIComponent(shop.slug)}`}>
                                {shop.name}
                              </a>
                              {" · "}
                              {product.available > 0 ? "In stock" : "Sold out"}
                            </small>
                          </span>
                          <b>
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: product.currency,
                            }).format(Number(product.price))}
                          </b>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : answer ? (
                  <p className="rc-buyer-chat-bubble">
                    No verified matches. Try a different product or budget.
                  </p>
                ) : (
                  <p className="rc-buyer-chat-bubble" role="status">
                    Looking through the shops…
                  </p>
                )}
              </div>
            ))}
          </div>
          {search ? (
            <form
              className="rc-buyer-chat-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void send(question);
              }}
            >
              <div>
                <input
                  ref={input}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  maxLength={400}
                  aria-label="Message the shopping assistant"
                  placeholder={
                    turns.length ? "Ask a follow-up…" : "Ask about a product…"
                  }
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={busy || !question.trim()}
                >
                  <Send size={17} aria-hidden />
                </button>
              </div>
              {turns.length > 0 && (
                <button
                  type="button"
                  className="rc-link"
                  disabled={busy}
                  onClick={() => {
                    setTurns([]);
                    setQuestion("");
                    input.current?.focus();
                  }}
                >
                  New conversation
                </button>
              )}
            </form>
          ) : (
            <div className="rc-buyer-chat-composer">
              <a ref={signIn} className="rc-button" href="/restorecart/account">
                Sign in to chat
              </a>
            </div>
          )}
        </section>
      )}
      <button
        type="button"
        className="rc-buyer-chat-launch"
        ref={launcher}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Sparkles size={18} aria-hidden /> <span>Ask RestoreCart</span>
      </button>
    </div>
  );
}

export function NewShops({ shops }: { shops: NewShop[] }) {
  return (
    <section id="new-shops" className="rc-panel" aria-label="New shops">
      <h2>
        New shops <span>({shops.length})</span>
      </h2>
      {shops.length ? (
        <ul>
          {shops.map((shop) => (
            <li key={shop.slug}>
              <a href={`/s/${encodeURIComponent(shop.slug)}`}>{shop.name}</a>
            </li>
          ))}
        </ul>
      ) : (
        <p>You’re caught up. New shops you haven’t visited will appear here.</p>
      )}
    </section>
  );
}

const BuyerBlockTimeline = lazy(() =>
  import("./BryntumPickups").then((module) => ({
    default: module.BuyerBlockTimeline,
  })),
);

function deviceDay(iso?: string) {
  const date = iso ? new Date(iso) : new Date();
  return new Date(+date - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

type Window = { start: string; end: string };
export function BuyerPickupTimes({
  blocks,
  appointment,
  timelineEnabled,
  needsReschedule,
  change,
}: {
  blocks: Window[];
  appointment?: Window | null;
  timelineEnabled: boolean;
  needsReschedule: boolean;
  change: (operation: "add" | "remove", window: Window) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [day, setDay] = useState(() => deviceDay(appointment?.start));
  const [draft, setDraft] = useState<Window | null>(null);
  const form = useRef<HTMLFormElement>(null);
  async function update(operation: "add" | "remove", window: Window) {
    setBusy(true);
    setError("");
    try {
      await change(operation, window);
      if (operation === "add") {
        setDraft(null);
        form.current?.reset();
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Pickup availability could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <details
      className="rc-panel rc-buyer-pickup-settings"
      onToggle={(event) => setTimelineOpen(event.currentTarget.open)}
    >
      <summary>
        Manage pickup availability
        {needsReschedule && <small>Rescheduling needed</small>}
      </summary>
      <p>Block times you can’t pick up. Time zone · {timezone}</p>
      {needsReschedule && (
        <p className="rc-warning">
          Your current pickup overlaps a blocked time. The seller needs to
          reschedule it.
        </p>
      )}
      {timelineEnabled && timelineOpen && (
        <div className="rc-pickup-block-editor">
          <label>
            Timeline date{" "}
            <input
              type="date"
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
                setDraft(null);
              }}
            />
          </label>
          <p>
            Drag across the <strong>Unavailable</strong> row, then confirm the
            time.
          </p>
          {day && (
            <OrderViewBoundary
              fallback={
                <p>
                  The timeline is unavailable. Use the form below to block time.
                </p>
              }
            >
              <Suspense fallback={<p role="status">Loading timeline…</p>}>
                <BuyerBlockTimeline
                  day={day}
                  appointment={appointment}
                  blocks={blocks}
                  disabled={busy || !!draft}
                  onDraft={(range) => {
                    setError("");
                    setDraft(range);
                  }}
                />
              </Suspense>
            </OrderViewBoundary>
          )}
          {draft && (
            <div
              className="rc-pickup-conflict-note"
              role="region"
              aria-label="Confirm unavailable time"
            >
              <span>
                {new Date(draft.start).toLocaleString()} –{" "}
                {new Date(draft.end).toLocaleTimeString()}
              </span>
              <div className="rc-buttonrow">
                <button
                  type="button"
                  className="rc-button"
                  disabled={busy}
                  onClick={() => void update("add", draft)}
                >
                  Confirm block
                </button>
                <button
                  type="button"
                  className="rc-link"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <ul>
        {blocks.map((window) => (
          <li key={`${window.start}/${window.end}`}>
            {new Date(window.start).toLocaleString()} –{" "}
            {new Date(window.end).toLocaleString()}{" "}
            <button
              type="button"
              className="rc-link"
              disabled={busy}
              onClick={() => void update("remove", window)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <details open={timelineEnabled ? undefined : true}>
        <summary>Enter time or block a whole day</summary>
        <label>
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
          />{" "}
          Block a whole day
        </label>
        <form
          key={String(allDay)}
          ref={form}
          onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            const from = String(values.get("start"));
            const start = new Date(allDay ? `${from}T00:00` : from);
            const end = allDay
              ? new Date(start)
              : new Date(String(values.get("end")));
            if (allDay) end.setDate(end.getDate() + 1);
            if (
              !Number.isFinite(+start) ||
              !Number.isFinite(+end) ||
              end <= start
            ) {
              setError("Choose an end time after the start.");
              return;
            }
            void update("add", {
              start: start.toISOString(),
              end: end.toISOString(),
            });
          }}
        >
          <label>
            {allDay ? "Date" : "From"}{" "}
            <input
              name="start"
              type={allDay ? "date" : "datetime-local"}
              required
            />
          </label>
          {!allDay && (
            <label>
              Until <input name="end" type="datetime-local" required />
            </label>
          )}
          <button className="rc-button secondary" disabled={busy}>
            Block this time
          </button>
        </form>
      </details>
      {error && (
        <p role="alert" className="rc-warning">
          {error}
        </p>
      )}
    </details>
  );
}
