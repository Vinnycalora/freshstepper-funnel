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

// Keep a singleton across serverless invocations
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
 * Upsert order to Postgres. Merges with existing record to preserve fields similar to former JSON merge.
 */
export async function upsertOrder(incoming: StoredOrder): Promise<StoredOrder> {
  const sql = db();
  const o = normaliseMergedOrder(incoming);

  // Fetch existing to merge
  const existing = await getOrderById(o.id);
  const merged: StoredOrder = normaliseMergedOrder({ ...(existing ?? {}), ...o });

  const createdAt = merged.createdAt ?? new Date().toISOString();

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
  `;

  return merged;
}

/**
 * List recent orders (limit set to 500 to avoid huge payloads).
 */
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

/**
 * Update sendcloud-related fields and append history (orderId based).
 */
export async function applySendcloudStatusUpdate(
  orderId: string,
  status: string | null,
  opts?: { trackingNumber?: string | null; trackingUrl?: string | null; shippingLabelId?: number | null }
): Promise<void> {
  const existing = await getOrderById(orderId);
  if (!existing) return;

  const nowIso = new Date().toISOString();
  const history = Array.isArray(existing.sendcloudStatusHistory) ? [...existing.sendcloudStatusHistory] : [];
  if (status) history.push({ status, at: nowIso });

  await upsertOrder({
    ...existing,
    sendcloudStatus: status ?? existing.sendcloudStatus ?? null,
    sendcloudStatusUpdatedAt: nowIso,
    sendcloudStatusHistory: history,
    trackingNumber: opts?.trackingNumber ?? existing.trackingNumber ?? null,
    trackingUrl: opts?.trackingUrl ?? existing.trackingUrl ?? null,
    shippingLabelId: opts?.shippingLabelId ?? existing.shippingLabelId ?? null,
  });
}

/**
 * Mark abandoned stage (orderId based)
 */
export async function markAbandonedStage(orderId: string, stage: number, now: Date = new Date()): Promise<void> {
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

