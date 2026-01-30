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
      // tune pool in env if needed
    });
  }
  return globalForDb.__sql!;
}

function normaliseMergedOrder(incoming: StoredOrder): StoredOrder {
  return {
    ...incoming,
    services: Array.isArray(incoming.services) ? incoming.services : [],
    upgrades: Array.isArray(incoming.upgrades) ? incoming.upgrades : [],
    sendcloudStatusHistory: Array.isArray(incoming.sendcloudStatusHistory)
      ? incoming.sendcloudStatusHistory
      : [],
  };
}

/**
 * Upsert order: merges fields (incoming overwrites), preserves arrays safely.
 * Uses INSERT ... ON CONFLICT (id) DO UPDATE and prevents NULLs from overwriting
 * existing payment fields by using COALESCE(EXCLUDED.col, public.orders.col).
 */
export async function upsertOrder(incoming: StoredOrder): Promise<StoredOrder> {
  const sql = db();
  const o = normaliseMergedOrder(incoming);

  // Fetch existing to merge client-side so returned object contains merged values
  const existing = await getOrderById(o.id);
  const merged: StoredOrder = normaliseMergedOrder({ ...(existing ?? {}), ...o });

  // created_at: if merged.createdAt provided use it, otherwise let SQL use now()
  const createdAtValue = merged.createdAt ?? null;

  await sql`
    INSERT INTO public.orders (
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
    ) VALUES (
      ${merged.id},
      ${createdAtValue ?? sql`now()`},
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
    ON CONFLICT (id) DO UPDATE SET
      -- Preserve original created_at if present, otherwise use incoming
      created_at = COALESCE(public.orders.created_at, excluded.created_at),

      short_ref = COALESCE(excluded.short_ref, public.orders.short_ref),

      email = COALESCE(excluded.email, public.orders.email),
      customer_email = COALESCE(excluded.customer_email, public.orders.customer_email),
      name = COALESCE(excluded.name, public.orders.name),
      phone = COALESCE(excluded.phone, public.orders.phone),

      shoe_type = COALESCE(excluded.shoe_type, public.orders.shoe_type),
      services = COALESCE(excluded.services, public.orders.services),
      upgrades = COALESCE(excluded.upgrades, public.orders.upgrades),
      delivery = COALESCE(excluded.delivery, public.orders.delivery),

      address_line1 = COALESCE(excluded.address_line1, public.orders.address_line1),
      city = COALESCE(excluded.city, public.orders.city),
      postcode = COALESCE(excluded.postcode, public.orders.postcode),
      preferred_date_time = COALESCE(excluded.preferred_date_time, public.orders.preferred_date_time),

      payment_mode = COALESCE(excluded.payment_mode, public.orders.payment_mode),

      -- Payment-related columns: do NOT allow NULL to overwrite existing values
      payment_status = COALESCE(excluded.payment_status, public.orders.payment_status),
      amount_total = COALESCE(excluded.amount_total, public.orders.amount_total),
      currency = COALESCE(excluded.currency, public.orders.currency),
      checkout_url = COALESCE(excluded.checkout_url, public.orders.checkout_url),

      mode = COALESCE(excluded.mode, public.orders.mode),
      stripe_customer_id = COALESCE(excluded.stripe_customer_id, public.orders.stripe_customer_id),
      stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, public.orders.stripe_subscription_id),

      sendcloud_status = COALESCE(excluded.sendcloud_status, public.orders.sendcloud_status),
      sendcloud_status_updated_at = COALESCE(excluded.sendcloud_status_updated_at, public.orders.sendcloud_status_updated_at),
      sendcloud_status_history = COALESCE(excluded.sendcloud_status_history, public.orders.sendcloud_status_history),

      shipping_label_id = COALESCE(excluded.shipping_label_id, public.orders.shipping_label_id),
      tracking_number = COALESCE(excluded.tracking_number, public.orders.tracking_number),
      tracking_url = COALESCE(excluded.tracking_url, public.orders.tracking_url),

      abandoned_stage = COALESCE(excluded.abandoned_stage, public.orders.abandoned_stage),
      abandoned_first_at = COALESCE(excluded.abandoned_first_at, public.orders.abandoned_first_at),
      abandoned_last_at = COALESCE(excluded.abandoned_last_at, public.orders.abandoned_last_at)
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
    shortRef: r.short_ref ?? undefined,

    email: r.email ?? undefined,
    customerEmail: r.customer_email ?? undefined,
    name: r.name ?? undefined,
    phone: r.phone ?? undefined,

    shoeType: r.shoe_type ?? undefined,
    services: r.services ?? [],
    upgrades: r.upgrades ?? [],
    delivery: r.delivery ?? undefined,

    addressLine1: r.address_line1 ?? undefined,
    city: r.city ?? undefined,
    postcode: r.postcode ?? undefined,
    preferredDateTime: r.preferred_date_time ?? undefined,

    paymentMode: r.payment_mode ?? undefined,
    paymentStatus: r.payment_status ?? undefined,
    amountTotal: r.amount_total ?? undefined,
    currency: r.currency ?? undefined,
    checkoutUrl: r.checkout_url ?? undefined,

    mode: r.mode ?? undefined,
    stripeCustomerId: r.stripe_customer_id ?? undefined,
    stripeSubscriptionId: r.stripe_subscription_id ?? undefined,

    sendcloudStatus: r.sendcloud_status ?? undefined,
    sendcloudStatusUpdatedAt: r.sendcloud_status_updated_at
      ? new Date(r.sendcloud_status_updated_at).toISOString()
      : undefined,
    sendcloudStatusHistory: r.sendcloud_status_history ?? [],
    shippingLabelId: r.shipping_label_id ?? undefined,
    trackingNumber: r.tracking_number ?? undefined,
    trackingUrl: r.tracking_url ?? undefined,

    abandonedStage: r.abandoned_stage ?? undefined,
    abandonedFirstAt: r.abandoned_first_at ? new Date(r.abandoned_first_at).toISOString() : undefined,
    abandonedLastAt: r.abandoned_last_at ? new Date(r.abandoned_last_at).toISOString() : undefined,
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
    shortRef: r.short_ref ?? undefined,

    email: r.email ?? undefined,
    customerEmail: r.customer_email ?? undefined,
    name: r.name ?? undefined,
    phone: r.phone ?? undefined,

    shoeType: r.shoe_type ?? undefined,
    services: r.services ?? [],
    upgrades: r.upgrades ?? [],
    delivery: r.delivery ?? undefined,

    addressLine1: r.address_line1 ?? undefined,
    city: r.city ?? undefined,
    postcode: r.postcode ?? undefined,
    preferredDateTime: r.preferred_date_time ?? undefined,

    paymentMode: r.payment_mode ?? undefined,
    paymentStatus: r.payment_status ?? undefined,
    amountTotal: r.amount_total ?? undefined,
    currency: r.currency ?? undefined,
    checkoutUrl: r.checkout_url ?? undefined,

    mode: r.mode ?? undefined,
    stripeCustomerId: r.stripe_customer_id ?? undefined,
    stripeSubscriptionId: r.stripe_subscription_id ?? undefined,

    sendcloudStatus: r.sendcloud_status ?? undefined,
    sendcloudStatusUpdatedAt: r.sendcloud_status_updated_at
      ? new Date(r.sendcloud_status_updated_at).toISOString()
      : undefined,
    sendcloudStatusHistory: r.sendcloud_status_history ?? [],
    shippingLabelId: r.shipping_label_id ?? undefined,
    trackingNumber: r.tracking_number ?? undefined,
    trackingUrl: r.tracking_url ?? undefined,

    abandonedStage: r.abandoned_stage ?? undefined,
    abandonedFirstAt: r.abandoned_first_at ? new Date(r.abandoned_first_at).toISOString() : undefined,
    abandonedLastAt: r.abandoned_last_at ? new Date(r.abandoned_last_at).toISOString() : undefined,
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

