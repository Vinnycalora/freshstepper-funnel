// lib/orders.ts
import fs from "fs";
import path from "path";
import { getPool } from "@/lib/db";

export type StatusHistoryEntry = { status: string; at: string };

export type StoredOrder = {
    id: string; // Stripe checkout session id (stable key)
    shortRef?: string; // FS-YYYYMMDD-001

    createdAt?: string;

    // Canonical customer
    customerEmail?: string | null;
    email?: string | null; // legacy alias (kept in sync)
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

    checkoutUrl?: string | null; // Stripe session.url recovery link
    abandonedStage?: number | null;
    abandonedFirstAt?: string | null;
    abandonedLastAt?: string | null;

    [key: string]: any;
};

const ORDERS_PATH = path.join(process.cwd(), "data", "orders.json");

/**
 * Storage driver:
 * - set STORAGE_DRIVER=postgres on Vercel/Railway (recommended)
 * - keep STORAGE_DRIVER=json for local fallback
 *
 * If not specified, auto-enable Postgres when DATABASE_URL exists.
 */
function usePostgres(): boolean {
    const driver = String(process.env.STORAGE_DRIVER ?? "").toLowerCase();
    if (driver === "postgres") return true;
    if (driver === "json") return false;
    return !!process.env.DATABASE_URL;
}

/* ----------------------- JSON STORAGE (fallback) ----------------------- */

function readOrdersJson(): StoredOrder[] {
    try {
        const raw = fs.readFileSync(ORDERS_PATH, "utf8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeOrdersJson(orders: StoredOrder[]) {
    fs.mkdirSync(path.dirname(ORDERS_PATH), { recursive: true });
    fs.writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2), "utf8");
}

/* ----------------------- HELPERS ----------------------- */

function ensureStringArray(v: any): string[] {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String).filter(Boolean);

    if (typeof v === "string") {
        try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        } catch {
            // fall through
        }
        return v.split(",").map((s) => s.trim()).filter(Boolean);
    }

    return [];
}

function toStatusString(value: any): string | null {
    if (value == null) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object") {
        return (value as any).message ?? JSON.stringify(value);
    }
    return String(value);
}

function todayPrefix(): string {
    const d = new Date();
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `FS-${y}${m}${day}-`;
}

function generateShortRefFromExisting(existing: StoredOrder[]): string {
    const prefix = todayPrefix();
    let max = 0;

    for (const o of existing) {
        const r = o.shortRef;
        if (typeof r !== "string" || !r.startsWith(prefix)) continue;
        const n = Number(r.slice(prefix.length));
        if (!Number.isNaN(n) && n > max) max = n;
    }

    return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

async function generateShortRefPostgres(): Promise<string> {
    const pool = getPool();
    if (!pool) throw new Error("DATABASE_URL is not set");

    const prefix = todayPrefix();
    const like = `${prefix}%`;

    const res = await pool.query(
        `select data->>'shortRef' as shortref
         from orders
         where data->>'shortRef' like $1
         order by data->>'shortRef' desc
         limit 1`,
        [like]
    );

    const last = res.rows?.[0]?.shortref as string | undefined;
    if (!last || typeof last !== "string" || !last.startsWith(prefix)) {
        return `${prefix}001`;
    }

    const n = Number(last.slice(prefix.length));
    const next = Number.isFinite(n) ? n + 1 : 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
}

/**
 * Normalise + canonicalise an order merge.
 * Protects: createdAt, shortRef, history, aliases.
 */
function normaliseMergedOrder(
    merged: StoredOrder,
    existing?: StoredOrder | null,
    shortRefHint?: string
): StoredOrder {
    // createdAt only set once
    if (!merged.createdAt) merged.createdAt = existing?.createdAt ?? new Date().toISOString();

    // shortRef only set once
    if (!merged.shortRef) merged.shortRef = existing?.shortRef ?? shortRefHint;

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

/* ----------------------- PUBLIC API ----------------------- */

export function isPaid(order: any): boolean {
    const s = String(order?.paymentStatus ?? "").toLowerCase();
    return s === "paid";
}

export async function listOrders(): Promise<StoredOrder[]> {
    if (!usePostgres()) {
        return readOrdersJson();
    }

    const pool = getPool();
    if (!pool) throw new Error("DATABASE_URL is not set");

    const res = await pool.query(
        `select data
         from orders
         order by created_at desc`
    );

    const out: StoredOrder[] = [];
    for (const row of res.rows ?? []) {
        const data = row?.data;
        if (data && typeof data === "object") out.push(data as StoredOrder);
    }
    return out;
}

export async function getOrderById(id: string): Promise<StoredOrder | null> {
    if (!usePostgres()) {
        return readOrdersJson().find((o) => o.id === id) ?? null;
    }

    const pool = getPool();
    if (!pool) throw new Error("DATABASE_URL is not set");

    const res = await pool.query(`select data from orders where id = $1 limit 1`, [id]);
    const data = res.rows?.[0]?.data;
    return data ? (data as StoredOrder) : null;
}

/**
 * Upsert order (only id required). Returns saved order.
 * Protects: shortRef, createdAt, history.
 */
export async function upsertOrder(update: Partial<StoredOrder> & { id: string }): Promise<StoredOrder> {
    if (!usePostgres()) {
        const orders = readOrdersJson();
        const idx = orders.findIndex((o) => o.id === update.id);
        const existing = idx >= 0 ? orders[idx] : null;

        const shortRefHint = existing?.shortRef ?? generateShortRefFromExisting(orders);

        const merged: StoredOrder = normaliseMergedOrder(
            { ...(existing ?? { id: update.id }), ...update },
            existing,
            shortRefHint
        );

        if (idx >= 0) orders[idx] = merged;
        else orders.unshift(merged);

        writeOrdersJson(orders);
        return merged;
    }

    const pool = getPool();
    if (!pool) throw new Error("DATABASE_URL is not set");

    const existing = await getOrderById(update.id);

    // only generate shortRef if we need it
    const shortRefHint =
        existing?.shortRef ??
        (update.shortRef ? undefined : await generateShortRefPostgres());

    const merged: StoredOrder = normaliseMergedOrder(
        { ...(existing ?? { id: update.id }), ...update },
        existing,
        shortRefHint
    );

    merged.id = update.id;

    await pool.query(
        `insert into orders (id, data)
         values ($1, $2::jsonb)
         on conflict (id) do update
           set data = excluded.data,
               updated_at = now()`,
        [update.id, JSON.stringify(merged)]
    );

    return merged;
}

export async function listAbandonedCandidates(opts?: { minutes?: number }) {
    const minutes = opts?.minutes ?? 10;
    const cutoff = Date.now() - minutes * 60 * 1000;

    const orders = await listOrders();

    return orders.filter((o: any) => {
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

export async function markAbandonedStage(orderId: string, stage: number) {
    const now = new Date().toISOString();
    return upsertOrder({
        id: orderId,
        abandonedStage: stage,
        abandonedFirstAt: stage === 1 ? now : undefined,
        abandonedLastAt: now,
    } as any);
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



