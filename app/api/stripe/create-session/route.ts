import { NextResponse } from "next/server";
import Stripe from "stripe";
import { upsertOrder } from "@/lib/orders";


export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type ShoeType = "trainers" | "heels" | "other";

type Body = {
    shoeType?: ShoeType | string;
    services?: string[];
    upgrades?: string[];
    delivery?: "postal" | "dropoff" | string;

    fullName?: string;
    email?: string;
    phone?: string;

    addressLine1?: string;
    city?: string;
    postcode?: string;

    // if your checkout uses `address` instead of `addressLine1`, we’ll map it
    address?: string;

    preferredTime?: string;
};

function gbp(amountPence: number) {
    return Math.max(0, Math.round(amountPence));
}

// ⚠️ Simple placeholder pricing (swap later)
// Keep this minimal so the session always builds.
const BASE_BY_SHOE: Record<string, number> = {
    trainers: 2500,
    heels: 3000,
    other: 2800,
};

const SERVICE_PRICE: Record<string, number> = {
    deep_clean: 1800,
    colour_restoration: 1500,
    sole_repaint: 1500,
    heel_repair: 2000,
    stitch_repair: 1500,
    suede_renewal: 1500,
    odour_treatment: 800,
    fabric_refresh: 1000,
    lace_replacement: 500,
};

const UPGRADE_PRICE: Record<string, number> = {
    protector_spray: 500,
    express_turnaround: 1000,
    // care_plan handled as subscription below
};

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as Body;

        const shoeType = String(body.shoeType ?? "other").toLowerCase();
        const services = Array.isArray(body.services) ? body.services : [];
        const upgrades = Array.isArray(body.upgrades) ? body.upgrades : [];
        const delivery = String(body.delivery ?? "postal");

        const fullName = String(body.fullName ?? "");
        const email = String(body.email ?? "");
        const phone = String(body.phone ?? "");

        const addressLine1 = String(body.addressLine1 ?? body.address ?? "");
        const city = String(body.city ?? "");
        const postcode = String(body.postcode ?? "");
        const preferredTime = String(body.preferredTime ?? "");

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        // Determine if care plan (subscription) is included
        const hasCarePlan = upgrades.includes("care_plan");

        // Build line items (one-time)
        const base = BASE_BY_SHOE[shoeType] ?? BASE_BY_SHOE.other;

        const serviceTotal = services.reduce((sum, s) => sum + (SERVICE_PRICE[s] ?? 0), 0);
        const upgradeTotal = upgrades
            .filter((u) => u !== "care_plan")
            .reduce((sum, u) => sum + (UPGRADE_PRICE[u] ?? 0), 0);

        const oneTimeTotal = gbp(base + serviceTotal + upgradeTotal);

        // NOTE: For prototype we use a single “bundle” line item
        const oneTimeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
            {
                price_data: {
                    currency: "gbp",
                    product_data: {
                        name: "Freshstepper Shoe Service",
                        description: `Shoe: ${shoeType} • Services: ${services.join(", ") || "none"} • Upgrades: ${upgrades.filter((u) => u !== "care_plan").join(", ") || "none"
                            }`,
                    },
                    unit_amount: oneTimeTotal,
                },
                quantity: 1,
            },
        ];

        // Subscription line item (care plan)
        // ✅ easiest way: use an existing Stripe Price ID if you have one
        // If you don’t have it yet, comment this out and run payment-mode only.
        const carePlanPriceId = process.env.STRIPE_CARE_PLAN_PRICE_ID || "";

        // Success/cancel URLs
        const origin =
            req.headers.get("origin") ||
            process.env.NEXT_PUBLIC_SITE_URL ||
            "http://localhost:3000";

        const success_url = `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`;
        const cancel_url = `${origin}/checkout?canceled=1`;

        const metadata: Record<string, string> = {
            shoeType: String(shoeType),
            services: JSON.stringify(services),
            upgrades: JSON.stringify(upgrades),
            delivery: String(delivery),

            // ✅ needed for Sendcloud
            addressLine1: String(addressLine1),
            city: String(city),
            postcode: String(postcode),
            country: "GB",

            // helpful extras
            fullName: String(fullName),
            phone: String(phone),
            preferredTime: String(preferredTime),
        };

        // If you want postal to require address fields:
        if (delivery.toLowerCase() === "postal") {
            if (!addressLine1 || !city || !postcode) {
                return NextResponse.json(
                    { error: "Postal delivery requires addressLine1, city, postcode" },
                    { status: 400 }
                );
            }
        }

        let session: Stripe.Checkout.Session;

        if (hasCarePlan) {
            if (!carePlanPriceId) {
                return NextResponse.json(
                    { error: "Missing STRIPE_CARE_PLAN_PRICE_ID for subscription mode" },
                    { status: 500 }
                );
            }

            // Subscription Checkout: recurring + optional one-time add-ons
            session = await stripe.checkout.sessions.create({
                mode: "subscription",
                customer_email: email,
                success_url,
                cancel_url,
                metadata,

                line_items: [
                    // recurring care plan
                    { price: carePlanPriceId, quantity: 1 },
                    // optional: include the one-time service as an “invoice item”
                    ...oneTimeLineItems,
                ],
            });
        } else {
            // Payment Checkout: one-time
            session = await stripe.checkout.sessions.create({
                mode: "payment",
                customer_email: email,
                success_url,
                cancel_url,
                metadata,
                line_items: oneTimeLineItems,
            });
        }

        // ✅ Save checkout-started order so abandoned checkouts exist even without payment
        upsertOrder({
            id: session.id,
            createdAt: new Date().toISOString(),

            customerEmail: email || null,
            email: email || null,
            name: fullName || null,
            phone: phone || null,

            mode: hasCarePlan ? "subscription" : "payment",
            paymentMode: hasCarePlan ? "subscription" : "one_off",
            paymentStatus: "unpaid",

            shoeType: shoeType || null,
            services,
            upgrades,
            delivery: String(delivery || "postal"),

            // store recovery link
            checkoutUrl: session.url || null,
        });


        return NextResponse.json({ url: session.url });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

