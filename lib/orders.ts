// lib/orders.ts
import fs from "fs";
import path from "path";
import { getPool } from "@/lib/db";

export type StatusHistoryEntry = { status: string; at: string };

export type StoredOrder = {
    id: string; // Stripe checkout session id (stable key)
    shortRef?: string | null; // FS-YYYYMMDD-001
    createdAt?: string | null;

    // Customer
    customerEmail?: string | null;
    email?: string | null; // alias (kept in sync)
    name?: string | null;
    phone?: string | null;

    // Selections
    shoeType?: string | null;
    services?: string[];
    upgrades?: string[];
    delivery?: string | null;

    // Address / scheduling
    addressLine1?: string | null;
    city?: string | null;
    postcode?: string | null;
    preferredDateTime?: string | null;

    // Payment
    paymentMode?: "one_off" | "subscription" | "unknown" | null;
    mode?: string | null; // legacy: "payment" | "subscription"
    paymentStatus?: string | null;
    amountTotal?: number | null;
    currency?: string | null;

    // Stripe ids
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;

    // Recovery URL
    checkoutUrl?: string | null;

    // Sendcloud
    sendcloudStatus?: string | null;
    sendcloudStatusUpdatedAt?: string | null;
    sendcloudStatusHistory?: StatusHistoryEntry[];
    shippingLabelId?: number | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;

    // Abandonment
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
        return Array.isArray(parsed) ? (parsed as StoredOrder[]) : [];
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
            // ignore
        }
        return v.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
}

function toStatusString(value: any): string | null {
    if (value == null) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object") return (value as any).message ?? JSON.stringify(value);
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
        const r = o.shortRef ?? undefined;
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
        `select short_ref
         from orders
         where short_ref like $1
         order by short_ref desc
         limit 1`,
        [like]
    );

    const last = res.rows?.[0]?.short_ref as string | undefined;
    if (!last || typeof last !== "string" || !last.startsWith(prefix)) {
        return `${prefix}001`;
    }

    const n = Number(last.slice(prefix.length));
    const next = Number.isFinite(n) ? n + 1 : 1;
    return `${prefix}${String(next).padStart(3, "0")}`;
}

/**
 * Normalise + canonicalise an order merge.
 * Protects: createdAt, shortRef, aliases, array fields, delivery lowercasing.
 */
function normaliseMergedOrder(merged: StoredOrder, existing?: StoredOrder | null, shortRefHint?: string): StoredOrder {
    // createdAt only set once
    if (!merged.createdAt) merged.createdAt = existing?.createdAt ?? new Date().toISOString();

    // shortRef only set once
    if (!merged.shortRef) merged.shortRef = existing?.shortRef ?? shortRefHint ?? null;

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

/* ----------------------- POSTGRES MAPPING ----------------------- */

function rowToOrder(row: any): StoredOrder {
    return {
        id: row.id,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,

        shortRef: row.short_ref ?? null,

        email: row.email ?? null,
        customerEmail: row.customer_email ?? null,
        name: row.name ?? null,
        phone: row.phone ?? null,

        shoeType: row.shoe_type ?? null,
        services: ensureStringArray(row.services),
        upgrades: ensureStringArray(row.upgrades),
        delivery: row.delivery ?? null,

        addressLine1: row.address_line1 ?? null,
        city: row.city ?? null,
        postcode: row.postcode ?? null,
        preferredDateTime: row.preferred_date_time ?? null,

        paymentMode: row.payment_mode ?? null,
        paymentStatus: row.payment_status ?? null,
        amountTotal: typeof row.amount_total === "number" ? row.amount_total : row.amount_total ?? null,
        currency: row.currency ?? null,

        checkoutUrl: row.checkout_url ?? null,

        mode: row.mode ?? null,
        stripeCustomerId: row.stripe_customer_id ?? null,
        stripeSubscriptionId: row.stripe_subscription_id ?? null,

        sendcloudStatus: row.sendcloud_status ?? null,
        sendcloudStatusUpdatedAt: row.sendcloud_status_updated_at
            ? new Date(row.sendcloud_status_updated_at).toISOString()
            : null,
        sendcloudStatusHistory: Array.isArray(row.sendcloud_status_history) ? row.sendcloud_status_history : [],

        shippingLabelId: row.shipping_label_id ?? null,
        trackingNumber: row.tracking_number ?? null,
        trackingUrl: row.tracking_url ?? null,

        abandonedStage: row.abandoned_stage ?? null,
        abandonedFirstAt: row.abandoned_first_at ? new Date(row.abandoned_first_at).toISOString() : null,
        abandonedLastAt: row.abandoned_last_at ? new Date(row.abandoned_last_at).toISOString() : null,
    };
}

/* ----------------------- PUBLIC API ----------------------- */

export function isPaid(order: any): boolean {
    const s = String(order?.paymentStatus ?? "").toLowerCase();
    return s === "paid";
}

export async function listOrders(): Promise<StoredOrder[]> {
    if (!usePostgres()) return readOrdersJson();

    const pool = getPool();
    if (!pool) throw new Error("DATABASE_URL is not set");

    const res = await pool.query(
        `select *
         from orders
         order by created_at desc`
    );

    return (res.rows ?? []).map(rowToOrder);
}

export async function getOrderById(id: string): Promise<StoredOrder | null> {
    if (!usePostgres()) return readOrdersJson().find((o) => o.id === id) ?? null;

    const pool = getPool();
    if (!pool) throw new Error("DATABASE_URL is not set");

    const res = await pool.query(`select * from orders where id = $1 limit 1`, [id]);
    const row = res.rows?.[0];
    return row ? rowToOrder(row) : null;
}

/**
 * Upsert order (only id required). Returns saved order.
 * Reads existing (to preserve shortRef/createdAt), merges, then writes full row.
 */
export async function upsertOrder(update: Partial<StoredOrder> & { id: string }): Promise<StoredOrder> {
    if (!usePostgres()) {
        const orders = readOrdersJson();
        const idx = orders.findIndex((o) => o.id === update.id);
        const existing = idx >= 0 ? orders[idx] : null;

        const shortRefHint = existing?.shortRef ?? generateShortRefFromExisting(orders);

        const merged = normaliseMergedOrder({ ...(existing ?? { id: update.id }), ...update }, existing, shortRefHint);

        if (idx >= 0) orders[idx] = merged;
        else orders.unshift(merged);

        writeOrdersJson(orders);
        return merged;
    }

    const pool = getPool();
    if (!pool) throw new Error("DATABASE_URL is not set");

    const existing = await getOrderById(update.id);

    // Generate a shortRef if we need it
    const shortRefHint =
        existing?.shortRef ?? (update.shortRef ? undefined : await generateShortRefPostgres());

    const merged = normaliseMergedOrder({ ...(existing ?? { id: update.id }), ...update }, existing, shortRefHint);

    // Keep aliases synced
    const email = merged.email ?? merged.customerEmail ?? null;
    const customerEmail = merged.customerEmail ?? merged.email ?? null;

    // Insert/update using your existing wide-column schema
    await pool.query(
        `
        insert into orders (
          id, created_at,
          short_ref,
          email, customer_email, name, phone,
          shoe_type, services, upgrades, delivery,
          address_line1, city, postcode, preferred_date_time,
          payment_mode, payment_status, amount_total, currency,
          checkout_url, mode, stripe_customer_id, stripe_subscription_id,
          sendcloud_status, sendcloud_status_updated_at, sendcloud_status_history,
          shipping_label_id, tracking_number, tracking_url,
          abandoned_stage, abandoned_first_at, abandoned_last_at
        )
        values (
          $1,  $2,
          $3,
          $4,  $5,  $6,  $7,
          $8,  $9::jsonb, $10::jsonb, $11,
          $12, $13, $14, $15,
          $16, $17, $18, $19,
          $20, $21, $22, $23,
          $24, $25, $26::jsonb,
          $27, $28, $29,
          $30, $31, $32
        )
        on conflict (id) do update set
          -- do NOT overwrite created_at on updates
          short_ref = excluded.short_ref,
          email = excluded.email,
          customer_email = excluded.customer_email,
          name = excluded.name,
          phone = excluded.phone,
          shoe_type = excluded.shoe_type,
          services = excluded.services,
          upgrades = excluded.upgrades,
          delivery = excluded.delivery,
          address_line1 = excluded.address_line1,
          city = excluded.city,
          postcode = excluded.postcode,
          preferred_date_time = excluded.preferred_date_time,
          payment_mode = excluded.payment_mode,
          payment_status = excluded.payment_status,
          amount_total = excluded.amount_total,
          currency = excluded.currency,
          checkout_url = excluded.checkout_url,
          mode = excluded.mode,
          stripe_customer_id = excluded.stripe_customer_id,
          stripe_subscription_id = excluded.stripe_subscription_id,
          sendcloud_status = excluded.sendcloud_status,
          sendcloud_status_updated_at = excluded.sendcloud_status_updated_at,
          sendcloud_status_history = excluded.sendcloud_status_history,
          shipping_label_id = excluded.shipping_label_id,
          tracking_number = excluded.tracking_number,
          tracking_url = excluded.tracking_url,
          abandoned_stage = excluded.abandoned_stage,
          abandoned_first_at = excluded.abandoned_first_at,
          abandoned_last_at = excluded.abandoned_last_at
        `,
        [
            merged.id,
            // created_at: preserve original if present; otherwise now
            merged.createdAt ? new Date(merged.createdAt) : new Date(),

            merged.shortRef ?? null,

            email,
            customerEmail,
            merged.name ?? null,
            merged.phone ?? null,

            merged.shoeType ?? null,
            JSON.stringify(merged.services ?? []),
            JSON.stringify(merged.upgrades ?? []),
            merged.delivery ?? null,

            merged.addressLine1 ?? null,
            merged.city ?? null,
            merged.postcode ?? null,
            merged.preferredDateTime ?? null,

            merged.paymentMode ?? null,
            merged.paymentStatus ?? null,
            merged.amountTotal ?? null,
            merged.currency ?? null,

            merged.checkoutUrl ?? null,
            merged.mode ?? null,
            merged.stripeCustomerId ?? null,
            merged.stripeSubscriptionId ?? null,

            merged.sendcloudStatus ?? null,
            merged.sendcloudStatusUpdatedAt ? new Date(merged.sendcloudStatusUpdatedAt) : null,
            JSON.stringify(merged.sendcloudStatusHistory ?? []),

            merged.shippingLabelId ?? null,
            merged.trackingNumber ?? null,
            merged.trackingUrl ?? null,

            merged.abandonedStage ?? null,
            merged.abandonedFirstAt ? new Date(merged.abandonedFirstAt) : null,
            merged.abandonedLastAt ? new Date(merged.abandonedLastAt) : null,
        ]
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
 * Note: caller is responsible for `await upsertOrder(next)`
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




