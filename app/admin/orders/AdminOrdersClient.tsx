"use client";

import * as React from "react";

function toText(v: unknown): string {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

function toStringArray(v: unknown): string[] {
    if (!v) return [];
    if (Array.isArray(v)) return v.map((x) => toText(x)).filter(Boolean);
    if (typeof v === "string") {
        return v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return [];
}

function pickEmail(o: any): string {
    return (
        toText(o?.customerEmail) ||
        toText(o?.email) ||
        toText(o?.customer?.email) ||
        toText(o?.customer_details?.email) ||
        toText(o?.customerDetails?.email) ||
        toText(o?.metadata?.customerEmail) ||
        ""
    );
}

function pickName(o: any): string {
    return (
        toText(o?.name) ||
        toText(o?.customerName) ||
        toText(o?.customer?.name) ||
        toText(o?.customer_details?.name) ||
        toText(o?.customerDetails?.name) ||
        ""
    );
}

function pickPhone(o: any): string {
    return (
        toText(o?.phone) ||
        toText(o?.customerPhone) ||
        toText(o?.customer_details?.phone) ||
        toText(o?.customerDetails?.phone) ||
        toText(o?.metadata?.phone) ||
        ""
    );
}

function pickMode(o: any): string {
    const paymentMode = toText(o?.paymentMode);
    if (paymentMode) return paymentMode;

    const rawMode = toText(o?.mode);
    if (rawMode === "payment") return "one_off";
    if (rawMode === "subscription") return "subscription";

    return rawMode || "";
}

function pickStatus(o: any): string {
    const s = (
        toText(o?.paymentStatus) ||
        toText(o?.status) ||
        toText(o?.payment_status) ||
        toText(o?.payment_status_text) ||
        ""
    ).toLowerCase();

    if (!s) return "unknown";
    if (s.includes("paid")) return "paid";
    if (s.includes("unpaid")) return "unpaid";
    if (s.includes("refunded")) return "refunded";
    return s;
}

function pickDelivery(o: any): string {
    const d = o?.delivery;
    if (typeof d === "string") return d;
    if (d && typeof d === "object") {
        return (
            toText((d as any).method) ||
            toText((d as any).type) ||
            toText((d as any).option) ||
            toText(d)
        );
    }
    return toText(d);
}

function pickTracking(o: any): { number: string; url: string } {
    const flatNumber = toText((o as any).trackingNumber);
    const flatUrl = toText((o as any).trackingUrl);

    const nestedNumber = toText((o as any)?.sendcloud?.trackingNumber);
    const nestedUrl = toText((o as any)?.sendcloud?.trackingUrl);

    return {
        number: flatNumber || nestedNumber || "",
        url: flatUrl || nestedUrl || "",
    };
}

function pickSendcloudStatus(o: any): string {
    return toText(o?.sendcloudStatus) || toText(o?.sendcloud?.status) || "";
}

function pickSendcloudUpdatedAt(o: any): string {
    return toText(o?.sendcloudStatusUpdatedAt) || toText(o?.sendcloud?.statusUpdatedAt) || "";
}

function pickSendcloudHistory(o: any): Array<{ status: string; at: string }> {
    const h = (o as any)?.sendcloudStatusHistory ?? (o as any)?.sendcloud?.statusHistory;
    if (!Array.isArray(h)) return [];

    return h
        .map((x: any) => {
            const rawStatus = x?.status;
            const status =
                typeof rawStatus === "string"
                    ? rawStatus
                    : rawStatus && typeof rawStatus === "object"
                        ? (rawStatus as any).message ?? toText(rawStatus)
                        : toText(rawStatus);

            return {
                status,
                at: toText(x?.at),
            };
        })
        .filter((x) => x.status || x.at);
}

function pickParcelId(o: any): number | null {
    const v =
        (o as any)?.shippingLabelId ??
        (o as any)?.sendcloudParcelId ??
        (o as any)?.sendcloud?.parcelId ??
        null;

    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function shortId(o: any): string {
    const id = toText(o?.shortRef) || toText(o?.id);
    if (!id) return "";
    if (id.startsWith("FS-")) return id;
    return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

function pickCheckoutUrl(o: any): string {
    return toText(o?.checkoutUrl) || toText(o?.stripeCheckoutUrl) || "";
}

function pickAbandonedStage(o: any): number {
    const n = Number((o as any)?.abandonedStage ?? 0);
    return Number.isFinite(n) ? n : 0;
}

function pickAbandonedFirstAt(o: any): string {
    return toText((o as any)?.abandonedFirstAt) || "";
}

function pickAbandonedLastAt(o: any): string {
    return toText((o as any)?.abandonedLastAt) || "";
}

async function copyToClipboard(text: string) {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
    }
}

async function refreshSendcloud(orderId: string) {
    const r = await fetch("/api/sendcloud/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
    });

    const json = await r.json().catch(() => null);
    if (!r.ok) {
        throw new Error(json?.error ?? `Refresh failed (${r.status})`);
    }
    return json?.order ?? null;
}

type Props = { initialOrders: any[] };

export default function AdminOrdersClient({ initialOrders }: Props) {
    const [q, setQ] = React.useState("");
    const [modeFilter, setModeFilter] = React.useState<
        "all" | "one_off" | "subscription" | "unknown"
    >("all");
    const [statusFilter, setStatusFilter] = React.useState<
        "all" | "paid" | "unpaid" | "refunded" | "unknown"
    >("all");

    // ✅ Abandoned controls
    const [abandonedOnly, setAbandonedOnly] = React.useState(false);
    const [abandonedStageFilter, setAbandonedStageFilter] = React.useState<
        "all" | "1" | "2" | "3"
    >("all");

    const [expandedId, setExpandedId] = React.useState<string | null>(null);

    // local state so Refresh can update UI without a full reload
    const [ordersState, setOrdersState] = React.useState<any[]>(initialOrders ?? []);

    React.useEffect(() => {
        setOrdersState(initialOrders ?? []);
    }, [initialOrders]);

    const orders = React.useMemo(() => {
        const query = q.trim().toLowerCase();

        return (ordersState ?? []).filter((o) => {
            const email = pickEmail(o).toLowerCase();
            const name = pickName(o).toLowerCase();
            const phone = pickPhone(o).toLowerCase();
            const mode = (pickMode(o).toLowerCase() || "unknown") as any;
            const status = (pickStatus(o).toLowerCase() || "unknown") as any;
            const ref = (toText(o?.shortRef) || toText(o?.id)).toLowerCase();
            const shoe = toText(o?.shoeType || o?.items?.shoeType).toLowerCase();

            if (modeFilter !== "all" && mode !== modeFilter) return false;
            if (statusFilter !== "all" && status !== statusFilter) return false;

            // ✅ abandoned filters
            const stage = pickAbandonedStage(o);
            if (abandonedOnly && stage <= 0) return false;
            if (abandonedStageFilter !== "all") {
                if (stage !== Number(abandonedStageFilter)) return false;
            }

            if (!query) return true;

            const hay = [email, name, phone, ref, shoe].join(" ");
            return hay.includes(query);
        });
    }, [ordersState, q, modeFilter, statusFilter, abandonedOnly, abandonedStageFilter]);

    const paidCount = React.useMemo(
        () => (ordersState ?? []).filter((o) => pickStatus(o) === "paid").length,
        [ordersState]
    );

    const abandonedCount = React.useMemo(
        () => (ordersState ?? []).filter((o) => pickAbandonedStage(o) > 0).length,
        [ordersState]
    );

    return (
        <div>
            {/* Controls */}
            <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-black/70">
                        <b>{orders.length}</b> showing • <b>{paidCount}</b> paid total •{" "}
                        <b>{abandonedCount}</b> abandoned
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search email, name, phone, ref, shoe…"
                            className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none md:w-80"
                        />

                        <select
                            value={modeFilter}
                            onChange={(e) => setModeFilter(e.target.value as any)}
                            className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none"
                        >
                            <option value="all">All modes</option>
                            <option value="one_off">One-off</option>
                            <option value="subscription">Subscription</option>
                            <option value="unknown">Unknown</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none"
                        >
                            <option value="all">All statuses</option>
                            <option value="paid">Paid</option>
                            <option value="unpaid">Unpaid</option>
                            <option value="refunded">Refunded</option>
                            <option value="unknown">Unknown</option>
                        </select>

                        {/* ✅ Abandoned filters */}
                        <label className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm">
                            <input
                                type="checkbox"
                                checked={abandonedOnly}
                                onChange={(e) => setAbandonedOnly(e.target.checked)}
                            />
                            Abandoned only
                        </label>

                        <select
                            value={abandonedStageFilter}
                            onChange={(e) => setAbandonedStageFilter(e.target.value as any)}
                            className="rounded-xl border border-black/10 px-3 py-2 text-sm outline-none"
                            title="Abandoned stage"
                        >
                            <option value="all">Any stage</option>
                            <option value="1">Stage 1</option>
                            <option value="2">Stage 2</option>
                            <option value="3">Stage 3</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="mt-4 space-y-4">
                {orders.length === 0 ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-6 text-black/70">
                        No matching orders.
                    </div>
                ) : null}

                {orders.map((o: any) => {
                    const email = pickEmail(o);
                    const name = pickName(o);
                    const phone = pickPhone(o);

                    const shoe = toText(o?.shoeType || o?.items?.shoeType);
                    const delivery = pickDelivery(o);
                    const status = pickStatus(o);
                    const mode = pickMode(o) || "unknown";
                    const createdAt = toText(o?.createdAt);
                    const tracking = pickTracking(o);

                    const services = toStringArray(o?.services ?? o?.items?.services);
                    const upgrades = toStringArray(o?.upgrades ?? o?.items?.upgrades);

                    const amountTotal =
                        typeof o?.amountTotal === "number"
                            ? o.amountTotal
                            : typeof o?.amount_total === "number"
                                ? o.amount_total
                                : null;

                    const currency = toText(o?.currency || o?.currencyCode);

                    const id = toText(o?.id) || `${createdAt}-${email}-${shoe}`;
                    const isOpen = expandedId === id;

                    // Sendcloud UI bits
                    const parcelId = pickParcelId(o);
                    const scStatus = pickSendcloudStatus(o);
                    const scUpdatedAt = pickSendcloudUpdatedAt(o);
                    const hasSendcloud = Boolean(parcelId || tracking.number || tracking.url || scStatus);

                    // Abandoned UI bits
                    const abStage = pickAbandonedStage(o);
                    const checkoutUrl = pickCheckoutUrl(o);
                    const abFirstAt = pickAbandonedFirstAt(o);
                    const abLastAt = pickAbandonedLastAt(o);

                    return (
                        <div key={id} className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="font-extrabold">{email || "Unknown email"}</div>

                                        <button
                                            className="rounded-lg border border-black/10 px-2 py-1 text-xs hover:bg-black/5"
                                            onClick={() => copyToClipboard(email)}
                                            title="Copy email"
                                        >
                                            Copy
                                        </button>

                                        <span className="rounded-lg bg-black/5 px-2 py-1 text-xs">
                                            {shortId(o)}
                                        </span>

                                        <button
                                            className="rounded-lg border border-black/10 px-2 py-1 text-xs hover:bg-black/5"
                                            onClick={() => copyToClipboard(toText(o?.shortRef) || toText(o?.id))}
                                            title="Copy order ref"
                                        >
                                            Copy ref
                                        </button>

                                        {/* ✅ Abandoned badge */}
                                        {abStage > 0 ? (
                                            <span className="rounded-lg border border-black/10 bg-yellow-50 px-2 py-1 text-xs">
                                                Abandoned: Stage {abStage}
                                            </span>
                                        ) : null}
                                    </div>

                                    {name || phone ? (
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                                            {name ? <span>{name}</span> : null}

                                            {phone ? (
                                                <>
                                                    <span className="text-black/30">•</span>
                                                    <span>{phone}</span>
                                                    <button
                                                        className="rounded-lg border border-black/10 px-2 py-1 text-[11px] hover:bg-black/5"
                                                        onClick={() => copyToClipboard(phone)}
                                                        title="Copy phone"
                                                    >
                                                        Copy phone
                                                    </button>
                                                </>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="text-right">
                                    <div className="text-xs text-black/50">{createdAt}</div>
                                    <div className="mt-1 text-xs">
                                        <span className="rounded-lg bg-black/5 px-2 py-1">{status}</span>{" "}
                                        <span className="rounded-lg bg-black/5 px-2 py-1">{mode}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 text-sm text-black/70">
                                <b>Shoe:</b> {shoe || "—"} • <b>Delivery:</b> {delivery || "—"}
                            </div>

                            <div className="mt-2 text-sm text-black/70">
                                <b>Total:</b>{" "}
                                {amountTotal != null ? `£${(amountTotal / 100).toFixed(2)}` : "—"}{" "}
                                {currency ? currency.toUpperCase() : ""}
                            </div>

                            {/* Sendcloud status badge row */}
                            {hasSendcloud ? (
                                <div className="mt-2 text-sm text-black/70">
                                    <b>Sendcloud:</b>{" "}
                                    {scStatus ? (
                                        <span className="rounded-lg bg-black/5 px-2 py-1 text-xs">{scStatus}</span>
                                    ) : (
                                        "—"
                                    )}
                                    {scUpdatedAt ? (
                                        <span className="ml-2 text-xs text-black/50">updated {scUpdatedAt}</span>
                                    ) : null}
                                    {parcelId ? (
                                        <span className="ml-2 text-xs text-black/50">parcel #{parcelId}</span>
                                    ) : null}
                                </div>
                            ) : null}

                            {/* Actions */}
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    className="rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5"
                                    onClick={() => setExpandedId(isOpen ? null : id)}
                                >
                                    {isOpen ? "Hide details" : "View details"}
                                </button>

                                {tracking.url ? (
                                    <a
                                        className="rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5"
                                        href={tracking.url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Tracking link
                                    </a>
                                ) : null}

                                {tracking.number ? (
                                    <button
                                        className="rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5"
                                        onClick={() => copyToClipboard(tracking.number)}
                                    >
                                        Copy tracking
                                    </button>
                                ) : null}

                                {/* ✅ Recovery link actions */}
                                {checkoutUrl ? (
                                    <>
                                        <a
                                            className="rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5"
                                            href={checkoutUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            title="Open Stripe recovery link"
                                        >
                                            Recovery link
                                        </a>
                                        <button
                                            className="rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5"
                                            onClick={() => copyToClipboard(checkoutUrl)}
                                            title="Copy recovery link"
                                        >
                                            Copy recovery
                                        </button>
                                    </>
                                ) : null}

                                {/* Refresh status (only if we have a parcel id) */}
                                {parcelId ? (
                                    <button
                                        className="rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5"
                                        onClick={async () => {
                                            try {
                                                const updated = await refreshSendcloud(id);
                                                if (!updated) return;

                                                setOrdersState((prev) =>
                                                    prev.map((x) => (toText(x?.id) === id ? updated : x))
                                                );
                                            } catch (e: any) {
                                                alert(e?.message ?? "Failed to refresh Sendcloud");
                                            }
                                        }}
                                    >
                                        Refresh status
                                    </button>
                                ) : null}
                            </div>

                            {/* Expanded */}
                            {isOpen ? (
                                <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div className="text-sm text-black/70">
                                            <b>Services:</b> {services.join(", ") || "—"}
                                        </div>
                                        <div className="text-sm text-black/70">
                                            <b>Upgrades:</b> {upgrades.join(", ") || "—"}
                                        </div>

                                        <div className="text-sm text-black/70">
                                            <b>Stripe Sub:</b> {toText(o?.stripeSubscriptionId) || "—"}
                                        </div>

                                        <div className="text-sm text-black/70">
                                            <b>Tracking:</b> {tracking.number ? tracking.number : "—"}
                                        </div>

                                        <div className="text-sm text-black/70">
                                            <b>Sendcloud status:</b> {scStatus || "—"}
                                        </div>

                                        <div className="text-sm text-black/70">
                                            <b>Status updated:</b> {scUpdatedAt || "—"}
                                        </div>

                                        {/* ✅ Abandoned details */}
                                        <div className="text-sm text-black/70">
                                            <b>Abandoned stage:</b> {abStage > 0 ? `Stage ${abStage}` : "—"}
                                        </div>
                                        <div className="text-sm text-black/70">
                                            <b>Abandoned first:</b> {abFirstAt || "—"}
                                        </div>
                                        <div className="text-sm text-black/70">
                                            <b>Abandoned last:</b> {abLastAt || "—"}
                                        </div>
                                        <div className="text-sm text-black/70">
                                            <b>Recovery URL:</b> {checkoutUrl ? "Available" : "—"}
                                        </div>
                                    </div>

                                    {/* Status history */}
                                    {pickSendcloudHistory(o).length ? (
                                        <div className="mt-4 rounded-xl border border-black/10 bg-white p-3">
                                            <div className="mb-2 text-sm font-semibold">Sendcloud status history</div>
                                            <div className="space-y-1 text-sm text-black/70">
                                                {pickSendcloudHistory(o)
                                                    .slice()
                                                    .reverse()
                                                    .map((h, i) => (
                                                        <div key={`${h.at}-${h.status}-${i}`}>
                                                            <b>{h.status}</b>{" "}
                                                            <span className="text-xs text-black/50">{h.at}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Raw debug (safe) */}
                                    <details className="mt-4">
                                        <summary className="cursor-pointer text-sm text-black/60">
                                            Debug (raw order JSON)
                                        </summary>
                                        <pre className="mt-2 overflow-auto rounded-xl border border-black/10 bg-white p-3 text-xs">
                                            {JSON.stringify(o, null, 2)}
                                        </pre>
                                    </details>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


