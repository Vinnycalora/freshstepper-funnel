import postgres from "postgres";

export type StoredOrder = {
  id: string;
  createdAt?: string;

  shortRef?: string | null;

  email?: string | null;
  customerEmail?: string | null;            
  name?: string | null;
  phone?: string | null;

  shoeType?: string | null;
  services?: string[];
  upgrades?: string[];
  delivery?: string | null;

  addressLine1?: string | null;
  city?: string | null;
  postcode?: string | null;
  preferredDateTime?: string | null;

  paymentMode?: "one_off" | "subscription" | string | null;
  paymentStatus?: "paid" | "unpaid" | string | null;
  amountTotal?: number | null;
  currency?: string | null;
  checkoutUrl?: string | null;

  mode?: "payment" | "subscription" | string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;

  // Sendcloud
  sendcloudStatus?: string | null;
  sendcloudStatusUpdatedAt?: string | null;
  sendcloudStatusHistory?: { status: string; at: string }[];
  shippingLabelId?: number | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;

  // Abandoned automation
  abandonedStage?: number | null;
  abandonedFirstAt?: string | null;
  abandonedLastAt?: string | null;

  [key: string]: any;
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

// Singleton-ish (important on Next/Vercel)
const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

function db() {
  if (!globalForDb.__sql) {
    globalForDb.__sql = postgres(requiredEnv("DATABASE_URL"), {
      ssl: "require",
      // If you see timeout issues on serverless, you can also add:
      // max: 5,
      // idle_timeout: 20,
      // connect_timeout: 10,
    });
  }
  return globalForDb.__sql!;
}

function normaliseMergedOrder(incoming: StoredOrder): StoredOrder {
  return {
    ...incoming,
    services: Array.isArray(incoming.services) ? incoming.services : [],
    upgrades: Array.isArray(incoming.upgrades) ? incoming.upgrades : [],
    sendcloudStatusHistory: Array.isArray(incoming.sendcloudStatusHistory) ? incoming.sendcloudStatusHistory : [],
  };
}

/**
 * Upsert order: merges fields (incoming overwrites), preserves arrays safely.
 * Mirrors your previous json "merge then write" behaviour.
 */
export async function upsertOrder(incoming: StoredOrder): Promise<StoredOrder> {
  const sql = db();
  const o = normaliseMergedOrder(incoming);

  // Fetch existing first to do a safe merge (same behaviour you had before)
  const existing = await getOrderById(o.id);
  const merged: StoredOrder = normaliseMergedOrder({ ...(existing ?? {}), ...o });

  const createdAt = merged.createdAt || new Date().toISOString();

  await sql`
    insert into public.orders (
      id, created_at,
      short_ref,
      email, customer_email, name, phone,
      shoe_type, services, upgrades, delivery,
      address_line1, city, postcode, preferred_date_time,
      payment_mode, payment_status, amount_total, currency, checkout_url,
      mode, stripe_customer_id, stripe_subscription_id,
      sendcloud_status, sendcloud_status_updated_at, sendcloud_status_history,
      shipping_label_id, tracking_number, tracking_url,
      abandoned_stage, abandoned_first_at, abandoned_last_at
    ) values (
      ${merged.id}, ${createdAt},
      ${merged.shortRef ?? null},
      ${merged.email ?? null}, ${merged.customerEmail ?? null}, ${merged.name ?? null}, ${merged.phone ?? null},
      ${merged.shoeType ?? null}, ${sql.json(merged.services ?? [])}, ${sql.json(merged.upgrades ?? [])}, ${merged.delivery ?? null},
      ${merged.addressLine1 ?? null}, ${merged.city ?? null}, ${merged.postcode ?? null}, ${merged.preferredDateTime ?? null},
      ${merged.paymentMode ?? null}, ${merged.paymentStatus ?? null}, ${merged.amountTotal ?? null}, ${merged.currency ?? null}, ${merged.checkoutUrl ?? null},
      ${merged.mode ?? null}, ${merged.stripeCustomerId ?? null}, ${merged.stripeSubscriptionId ?? null},
      ${merged.sendcloudStatus ?? null}, ${merged.sendcloudStatusUpdatedAt ?? null}, ${sql.json(merged.sendcloudStatusHistory ?? [])},
      ${merged.shippingLabelId ?? null}, ${merged.trackingNumber ?? null}, ${merged.trackingUrl ?? null},
      ${merged.abandonedStage ?? null}, ${merged.abandonedFirstAt ?? null}, ${merged.abandonedLastAt ?? null}
    )
    on conflict (id) do update set
      -- keep created_at from excluded (you could also use COALESCE if you prefer)
      created_at = excluded.created_at,
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
      -- Payment-related columns: only overwrite if new value is non-null (avoid wiping existing data)
      payment_status = COALESCE(excluded.payment_status, public.orders.payment_status),
      amount_total = COALESCE(excluded.amount_total, public.orders.amount_total),
      currency = COALESCE(excluded.currency, public.orders.currency),
      checkout_url = COALESCE(excluded.checkout_url, public.orders.checkout_url),
      mode = COALESCE(excluded.mode, public.orders.mode),
      stripe_customer_id = COALESCE(excluded.stripe_customer_id, public.orders.stripe_customer_id),
      stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, public.orders.stripe_subscription_id),
      -- Sendcloud & tracking
      sendcloud_status = excluded.sendcloud_status,
      sendcloud_status_updated_at = excluded.sendcloud_status_updated_at,
      sendcloud_status_history = excluded.sendcloud_status_history,
      shipping_label_id = excluded.shipping_label_id,
      tracking_number = excluded.tracking_number,
      tracking_url = excluded.tracking_url,
      abandoned_stage = excluded.abandoned_stage,
      abandoned_first_at = excluded.abandoned_first_at,
      abandoned_last_at = excluded.abandoned_last_at
  `;

  return merged;
}

export async function listOrders(): Promise<StoredOrder[]> {
  const sql = db();
  const rows = await sql`
    select
      id,
      created_at,
      short_ref,
      email, customer_email, name, phone,
      shoe_type, services, upgrades, delivery,
      address_line1, city, postcode, preferred_date_time,
      payment_mode, payment_status, amount_total, currency, checkout_url,
      mode, stripe_customer_id, stripe_subscription_id,
      sendcloud_status, sendcloud_status_updated_at, sendcloud_status_history,
      shipping_label_id, tracking_number, tracking_url,
      abandoned_stage, abandoned_first_at, abandoned_last_at
    from public.orders
    order by created_at desc
    limit 500
  `;

  return rows.map((r: any) => ({
    id: r.id,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
    shortRef: r.short_ref,

    email: r.email,
    customerEmail: r.customer_email,
    name: r.name,
    phone: r.phone,

    shoeType: r.shoe_type,
    services: r.services ?? [],
    upgrades: r.upgrades ?? [],
    delivery: r.delivery,

    addressLine1: r.address_line1,
    city: r.city,
    postcode: r.postcode,
    preferredDateTime: r.preferred_date_time,

    paymentMode: r.payment_mode,
    paymentStatus: r.payment_status,
    amountTotal: r.amount_total,
    currency: r.currency,
    checkoutUrl: r.checkout_url,

    mode: r.mode,
    stripeCustomerId: r.stripe_customer_id,
    stripeSubscriptionId: r.stripe_subscription_id,

    sendcloudStatus: r.sendcloud_status,
    sendcloudStatusUpdatedAt: r.sendcloud_status_updated_at ? new Date(r.sendcloud_status_updated_at).toISOString() : null,
    sendcloudStatusHistory: r.sendcloud_status_history ?? [],
    shippingLabelId: r.shipping_label_id,
    trackingNumber: r.tracking_number,
    trackingUrl: r.tracking_url,

    abandonedStage: r.abandoned_stage,
    abandonedFirstAt: r.abandoned_first_at ? new Date(r.abandoned_first_at).toISOString() : null,
    abandonedLastAt: r.abandoned_last_at ? new Date(r.abandoned_last_at).toISOString() : null,
  }));
}

export async function getOrderById(id: string): Promise<StoredOrder | null> {
  const sql = db();
  const rows = await sql`
    select
      id,
      created_at,
      short_ref,
      email, customer_email, name, phone,
      shoe_type, services, upgrades, delivery,
      address_line1, city, postcode, preferred_date_time,
      payment_mode, payment_status, amount_total, currency, checkout_url,
      mode, stripe_customer_id, stripe_subscription_id,
      sendcloud_status, sendcloud_status_updated_at, sendcloud_status_history,
      shipping_label_id, tracking_number, tracking_url,
      abandoned_stage, abandoned_first_at, abandoned_last_at
    from public.orders
    where id = ${id}
    limit 1
  `;

  const r: any = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
    shortRef: r.short_ref,

    email: r.email,
    customerEmail: r.customer_email,
    name: r.name,
    phone: r.phone,

    shoeType: r.shoe_type,
    services: r.services ?? [],
    upgrades: r.upgrades ?? [],
    delivery: r.delivery,

    addressLine1: r.address_line1,
    city: r.city,
    postcode: r.postcode,
    preferredDateTime: r.preferred_date_time,

    paymentMode: r.payment_mode,
    paymentStatus: r.payment_status,
    amountTotal: r.amount_total,
    currency: r.currency,
    checkoutUrl: r.checkout_url,

    mode: r.mode,
    stripeCustomerId: r.stripe_customer_id,
    stripeSubscriptionId: r.stripe_subscription_id,

    sendcloudStatus: r.sendcloud_status,
    sendcloudStatusUpdatedAt: r.sendcloud_status_updated_at ? new Date(r.sendcloud_status_updated_at).toISOString() : null,
    sendcloudStatusHistory: r.sendcloud_status_history ?? [],
    shippingLabelId: r.shipping_label_id,
    trackingNumber: r.tracking_number,
    trackingUrl: r.tracking_url,

    abandonedStage: r.abandoned_stage,
    abandonedFirstAt: r.abandoned_first_at ? new Date(r.abandoned_first_at).toISOString() : null,
    abandonedLastAt: r.abandoned_last_at ? new Date(r.abandoned_last_at).toISOString() : null,
  };
}

export async function applySendcloudStatusUpdate(
  orderId: string,
  status: string,
  opts?: { trackingNumber?: string; trackingUrl?: string; shippingLabelId?: number }
) {
  const existing = await getOrderById(orderId);
  if (!existing) return;

  const now = new Date().toISOString();
  const history = Array.isArray(existing.sendcloudStatusHistory) ? existing.sendcloudStatusHistory.slice() : [];
  history.push({ status, at: now });

  await upsertOrder({
    ...existing,
    sendcloudStatus: status,
    sendcloudStatusUpdatedAt: now,
    sendcloudStatusHistory: history,
    trackingNumber: opts?.trackingNumber ?? existing.trackingNumber ?? null,
    trackingUrl: opts?.trackingUrl ?? existing.trackingUrl ?? null,
    shippingLabelId: opts?.shippingLabelId ?? existing.shippingLabelId ?? null,
  });
}

export async function markAbandonedStage(
  orderId: string,
  stage: number,
  now: Date = new Date()
): Promise<void> {
  const existing = await getOrderById(orderId);
  if (!existing) return;

  const nowIso = now.toISOString();

  await upsertOrder({
    ...existing,
    abandonedStage: stage,
    abandonedFirstAt: existing.abandonedFirstAt ?? nowIso,
    abandonedLastAt: nowIso,
  });
}

