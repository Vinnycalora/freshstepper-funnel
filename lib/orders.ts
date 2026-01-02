import fs from "fs";
import path from "path";

export type StatusHistoryEntry = { status: string; at: string };

export type StoredOrder = {
    id: string;               // Stripe checkout session id (stable key)
    shortRef?: string;        // FS-YYYYMMDD-001

    createdAt?: string;

    // Canonical customer
    customerEmail?: string | null;
    email?: string | null;    // legacy alias (kept in sync)
    name?: string | null;
    phone?: string | null;

    // Canonical payment
    paymentMode?: "one_off" | "subscription" | "unknown" | null;
    mode?: string | null; // legacy: "payment" | "subscription"
    paymentStatus?: string | null;

    // Canonical order selections
    shoeType?: string | null;
    services?: string[];
    upgrades?: string[];
    delivery?: string | null;

    // totals
    amountTotal?: number | null; // in minor units
    currency?: string | null;

    // Stripe ids
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;

    // Sendcloud (flat fields for now)
    shippingLabelId?: number | null; // parcel id
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    sendcloudStatus?: string | null;

    // Sendcloud metadata
    sendcloudStatusUpdatedAt?: string | null;
    sendcloudStatusHistory?: StatusHistoryEntry[];

    checkoutUrl?: string | null;          // Stripe session.url recovery link
    abandonedStage?: number | null;       // 0/1/2/3 etc.
    abandonedFirstAt?: string | null;     // when we first triggered stage 1
    abandonedLastAt?: string | null;      // last time we attempted


    [key: string]: any;
};

const ORDERS_PATH = path.join(process.cwd(), "data", "orders.json");

function readOrders(): StoredOrder[] {
    try {
        const raw = fs.readFileSync(ORDERS_PATH, "utf8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeOrders(orders: StoredOrder[]) {
    fs.mkdirSync(path.dirname(ORDERS_PATH), { recursive: true });
    fs.writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2), "utf8");
}

function ensureStringArray(v: any): string[] {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (typeof v === "string") {
        try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        } catch { }
        return v.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
}

function toStatusString(value: any): string | null {
    if (value == null) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object") {
        return value.message ?? JSON.stringify(value);
    }
    return String(value);
}

function generateShortRef(existing: StoredOrder[]): string {
    const d = new Date();
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const date = `${y}${m}${day}`;

    const prefix = `FS-${date}-`;
    let max = 0;

    for (const o of existing) {
        const r = o.shortRef;
        if (typeof r !== "string" || !r.startsWith(prefix)) continue;
        const n = Number(r.slice(prefix.length));
        if (!Number.isNaN(n) && n > max) max = n;
    }

    return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/**
 * Normalise + canonicalise an order merge.
 * This is the key to “standardisation”.
 */
function normaliseMergedOrder(merged: StoredOrder, existing?: StoredOrder | null): StoredOrder {
    // createdAt only set once
    if (!merged.createdAt) merged.createdAt = existing?.createdAt ?? new Date().toISOString();

    // shortRef only set once
    if (!merged.shortRef) merged.shortRef = existing?.shortRef ?? generateShortRef(readOrders());

    // email alias sync
    if (!merged.customerEmail && merged.email) merged.customerEmail = merged.email;
    if (!merged.email && merged.customerEmail) merged.email = merged.customerEmail;

    // paymentMode canonical
    if (!merged.paymentMode) {
        if (merged.mode === "subscription") merged.paymentMode = "subscription";
        else if (merged.mode === "payment") merged.paymentMode = "one_off";
        else if (typeof merged.mode === "string" && merged.mode) merged.paymentMode = "unknown";
        else merged.paymentMode = existing?.paymentMode ?? null;
    }

    // ensure arrays
    merged.services = ensureStringArray(merged.services ?? existing?.services);
    merged.upgrades = ensureStringArray(merged.upgrades ?? existing?.upgrades);

    // normalise sendcloud status to string
    merged.sendcloudStatus = toStatusString(merged.sendcloudStatus ?? existing?.sendcloudStatus);

    // delivery normalization
    if (typeof merged.delivery === "string") merged.delivery = merged.delivery.toLowerCase();

    return merged;
}


export function isPaid(order: any): boolean {
    const s = String(order?.paymentStatus ?? "").toLowerCase();
    return s === "paid";
}

export function listAbandonedCandidates(opts?: { minutes?: number }) {
    const minutes = opts?.minutes ?? 10;
    const cutoff = Date.now() - minutes * 60 * 1000;

    return listOrders().filter((o: any) => {
        if (isPaid(o)) return false;

        // must have recovery link to be useful
        const url = String(o?.checkoutUrl ?? "");
        if (!url) return false;

        // must have email to contact
        const email = String(o?.customerEmail ?? o?.email ?? "");
        if (!email) return false;

        // createdAt check
        const createdAt = Date.parse(String(o?.createdAt ?? ""));
        if (!Number.isFinite(createdAt)) return false;
        if (createdAt > cutoff) return false;

        // not already contacted
        const stage = Number(o?.abandonedStage ?? 0);
        if (stage >= 1) return false;

        return true;
    });
}

export function markAbandonedStage(orderId: string, stage: number) {
    const now = new Date().toISOString();
    return upsertOrder({
        id: orderId,
        abandonedStage: stage,
        abandonedFirstAt: stage === 1 ? now : undefined,
        abandonedLastAt: now,
    } as any);
}

/**
 * Upsert order (only id required). Returns saved order.
 * Protects: shortRef, createdAt, history.
 */
export function upsertOrder(update: Partial<StoredOrder> & { id: string }): StoredOrder {
    const orders = readOrders();
    const idx = orders.findIndex((o) => o.id === update.id);
    const existing = idx >= 0 ? orders[idx] : null;

    const merged: StoredOrder = normaliseMergedOrder(
        { ...(existing ?? { id: update.id }), ...update },
        existing
    );

    if (idx >= 0) orders[idx] = merged;
    else orders.unshift(merged);

    writeOrders(orders);
    return merged;
}

export function listOrders(): StoredOrder[] {
    return readOrders();
}

export function getOrderById(id: string) {
    return readOrders().find((o) => o.id === id) ?? null;
}

/**
 * Sendcloud status update helper (keeps history + timestamp).
 */
export function applySendcloudStatusUpdate(
    existing: any,
    incoming: {
        parcelId?: number | null;
        trackingNumber?: string | null;
        trackingUrl?: string | null;
        status?: any;
    }
) {
    const now = new Date().toISOString();
    const statusStr = toStatusString(incoming.status);

    const prevStatus = toStatusString(existing?.sendcloudStatus) ?? "";
    const newStatus = statusStr ?? "";

    const next: any = {
        ...existing,
        shippingLabelId: incoming.parcelId ?? existing?.shippingLabelId ?? null,
        trackingNumber: incoming.trackingNumber ?? existing?.trackingNumber ?? null,
        trackingUrl: incoming.trackingUrl ?? existing?.trackingUrl ?? null,
        sendcloudStatus: statusStr ?? existing?.sendcloudStatus ?? null,
    };

    if (newStatus && newStatus !== prevStatus) {
        const history = Array.isArray(existing?.sendcloudStatusHistory)
            ? existing.sendcloudStatusHistory.slice()
            : [];

        history.push({ status: newStatus, at: now });
        next.sendcloudStatusHistory = history;
        next.sendcloudStatusUpdatedAt = now;
    } else if (!existing?.sendcloudStatusUpdatedAt && (existing?.sendcloudStatus || newStatus)) {
        next.sendcloudStatusUpdatedAt = now;
    }

    return next;
}

