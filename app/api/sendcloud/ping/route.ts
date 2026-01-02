export const runtime = "nodejs";

export async function GET() {
    const pub = process.env.SENDCLOUD_PUBLIC_KEY;
    const secret = process.env.SENDCLOUD_SECRET_KEY;
    if (!pub || !secret) {
        return new Response(JSON.stringify({ ok: false, error: "Missing Sendcloud keys" }), { status: 500 });
    }

    const auth = Buffer.from(`${pub}:${secret}`).toString("base64");

    // Sendcloud endpoint that returns shipping methods (good sanity check)
    const r = await fetch("https://panel.sendcloud.sc/api/v2/shipping_methods", {
        headers: { Authorization: `Basic ${auth}` },
        cache: "no-store",
    });

    const text = await r.text();
    return new Response(text, { status: r.status, headers: { "Content-Type": "application/json" } });
}
