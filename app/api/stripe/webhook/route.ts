import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createSendcloudParcel } from "@/lib/sendcloud";
import { getOrderById, upsertOrder, applySendcloudStatusUpdate } from "@/lib/orders";

export const runtime = "nodejs";

// ✅ remove apiVersion to avoid TS mismatch (your Stripe types are newer)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET() {
    return new NextResponse("Webhook endpoint alive", { status: 200 });
}

function safeParseArray(value?: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function POST(req: Request) {
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig) {
        return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }
    if (!webhookSecret) {
        return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
    }

    let event: Stripe.Event;

    try {
        const rawBody = await req.text();
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Signature verification failed: ${msg}` }, { status: 400 });
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;

                const services = safeParseArray(session.metadata?.services);
                const upgrades = safeParseArray(session.metadata?.upgrades);

                const email = session.customer_details?.email ?? session.customer_email ?? null;

                // ✅ Standardised base order (canonical fields + legacy aliases)
                const savedOrder = upsertOrder({
                    id: session.id,
                    createdAt: new Date().toISOString(),

                    // canonical + alias
                    customerEmail: email,
                    email,

                    name: session.customer_details?.name ?? null,
                    phone: session.customer_details?.phone ?? session.metadata?.phone ?? null,

                    // canonical payment mode + legacy raw mode
                    mode: session.mode ?? null,
                    paymentMode:
                        session.mode === "subscription"
                            ? "subscription"
                            : session.mode === "payment"
                                ? "one_off"
                                : "unknown",

                    paymentStatus: session.payment_status ?? null,

                    shoeType: session.metadata?.shoeType ?? null,
                    services,
                    upgrades,
                    delivery: session.metadata?.delivery ?? null,

                    amountTotal: session.amount_total ?? null,
                    currency: session.currency ?? null,

                    stripeCustomerId: (session.customer as string) ?? null,
                    stripeSubscriptionId: (session.subscription as string) ?? null,
                });

                // ✅ If postal delivery, create Sendcloud parcel/label
                const delivery = (session.metadata?.delivery ?? "").toLowerCase();
                if (delivery === "postal") {
                    const methodId = Number(process.env.SENDCLOUD_SHIPPING_METHOD_ID);
                    if (!methodId) throw new Error("Missing SENDCLOUD_SHIPPING_METHOD_ID");

                    const fullName =
                        session.customer_details?.name ??
                        session.metadata?.fullName ??
                        "Customer";

                    const safeEmail =
                        session.customer_details?.email ??
                        session.customer_email ??
                        "unknown@example.com";

                    const phone = session.customer_details?.phone ?? session.metadata?.phone ?? null;


                    const addressLine1 = session.metadata?.addressLine1 ?? "";
                    const city = session.metadata?.city ?? "";
                    const postcode = session.metadata?.postcode ?? "";
                    const country = session.metadata?.country ?? "GB";

                    if (!addressLine1 || !city || !postcode) {
                        throw new Error("Missing addressLine1/city/postcode in Stripe metadata");
                    }

                    const parcelResp = await createSendcloudParcel({
                        // ✅ Use real shortRef (Sendcloud-safe), fallback only if needed
                        orderNumber:
                            savedOrder.shortRef ??
                            `FS-${String(session.id).replace(/^cs_/, "").slice(0, 44)}`,

                        name: fullName,
                        email: safeEmail,
                        phone,
                        address: addressLine1,
                        city,
                        postalCode: postcode,
                        country,
                        shipmentMethodId: methodId,
                        weightKg: 0.5,
                    });

                    const parcel = parcelResp?.parcel;

                    // ✅ Sendcloud update + history-safe merge
                    const existing = getOrderById(session.id);
                    const next = applySendcloudStatusUpdate(existing ?? { id: session.id }, {
                        parcelId: parcel?.id ?? null,
                        trackingNumber: parcel?.tracking_number ?? null,
                        trackingUrl: parcel?.tracking_url ?? null,
                        status: parcel?.status ?? null,
                    });

                    upsertOrder(next);

                    console.log("✅ Sendcloud parcel created:", parcel?.id);
                }

                break;
            }

            default:
                // keep quiet for now
                break;
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("❌ Webhook handler error:", msg);
    }

    return NextResponse.json({ received: true });
}


