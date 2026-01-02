import { listOrders } from "@/lib/orders";
import { SERVICE_LABELS, UPSELL_LABELS, shoeTypeLabel } from "@/components/labels";

export default function ThankYouPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams?.session_id ?? "";
  const order = sessionId ? listOrders().find((o) => o.id === sessionId) : null;

  const delivery = (order?.delivery ?? "").toLowerCase();
  const isPostal = delivery === "postal";
  const isDropoff = delivery === "dropoff";

  const services = Array.isArray(order?.services) ? order!.services! : [];
  const upgrades = Array.isArray(order?.upgrades) ? order!.upgrades! : [];

  const servicesPretty = services.map((id) => SERVICE_LABELS[id] ?? id);
  const upgradesPretty = upgrades.map((id) => UPSELL_LABELS[id] ?? id);
  


  return (
    <main className="min-h-screen py-12">
      <div className="mx-auto w-full max-w-3xl px-6">
        <h1 className="text-3xl font-extrabold uppercase">Thank you 🎉</h1>
        <p className="mt-3 text-black/70">
          Your order is confirmed. We’ll email you shortly with next steps.
        </p>

        {/* ORDER SUMMARY */}
        <div className="mt-8 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold uppercase text-black/60">Order summary</div>
            <div className="text-xs text-black/50">Session: {sessionId || "—"}</div>
          </div>

          {!order ? (
            <div className="mt-4 text-sm text-black/70">
              We’re finalising your order details. If this page was opened without completing
              checkout, the session may be missing.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-sm font-semibold uppercase text-black/60">Shoe type</div>
                <div className="mt-1 font-bold">{shoeTypeLabel(order.shoeType)}</div>
              </div>

              <div>
                <div className="text-sm font-semibold uppercase text-black/60">Restoration</div>
                {servicesPretty.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-black/80">
                    {servicesPretty.map((x) => (
                      <li key={x}>• {x}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 text-sm text-black/60">—</div>
                )}
              </div>

              {upgradesPretty.length > 0 && (
                <div>
                  <div className="text-sm font-semibold uppercase text-black/60">Upgrades</div>
                  <ul className="mt-2 space-y-1 text-sm text-black/80">
                    {upgradesPretty.map((x) => (
                      <li key={x}>• {x}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="text-sm font-semibold uppercase text-black/60">Delivery</div>
                <div className="mt-1 text-sm text-black/80">
                  {isPostal ? "Postal (UK wide)" : isDropoff ? "In-person drop-off" : order.delivery ?? "—"}
                </div>
              </div>

              {/* TRACKING */}
              {isPostal && (
                <div className="rounded-xl border border-[#1DB954]/20 bg-[#FAFAFA] p-4">
                  <div className="font-extrabold uppercase">Shipping & tracking</div>
                  {order.trackingUrl ? (
                    <div className="mt-2 text-sm text-black/70">
                      Your tracking link is ready:{" "}
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[#1DB954] underline"
                      >
                        View tracking
                      </a>
                      {order.trackingNumber ? (
                        <div className="mt-2 text-xs text-black/60">
                          Tracking #: {order.trackingNumber}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-black/70">
                      We’re generating your shipping details now. You’ll receive an email shortly
                      with the label/instructions.
                    </div>
                  )}
                </div>
              )}

              {isDropoff && (
                <div className="rounded-xl border border-[#1DB954]/20 bg-[#FAFAFA] p-4">
                  <div className="font-extrabold uppercase">Drop-off instructions</div>
                  <div className="mt-2 text-sm text-black/70">
                    We’ll email you the drop-off location + instructions shortly.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* PACKAGING */}
        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="font-extrabold uppercase">Packaging instructions</div>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-black/70">
            <li>Place shoes in a clean bag or box (no loose dirt).</li>
            <li>Include your name + email inside the parcel.</li>
            <li>If you’re sending multiple pairs, keep them separated.</li>
          </ul>
        </div>

        {/* SUPPORT */}
        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="font-extrabold uppercase">Need help?</div>
          <p className="mt-2 text-sm text-black/70">
            If you have any questions, message us and we’ll help you quickly.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {/* Replace with your real WhatsApp link later */}
            <a
              href="#"
              className="rounded-lg bg-[#1DB954] px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              WhatsApp support
            </a>
            <a
              href="/"
              className="rounded-lg border border-black/20 bg-white px-5 py-3 text-sm font-semibold hover:bg-black/5"
            >
              Back to home
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

