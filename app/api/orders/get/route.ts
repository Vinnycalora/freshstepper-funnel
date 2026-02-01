import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const sessionId =
            url.searchParams.get("session_id") || url.searchParams.get("sessionId");

        if (!sessionId) {
            return NextResponse.json(
                { ok: false, error: "Missing session_id" },
                { status: 400 }
            );
        }

        // ✅ IMPORTANT: await because Postgres version is async
        const order = await getOrderById(sessionId);

        if (!order) {
            return NextResponse.json(
                { ok: false, error: "Order not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ ok: true, order }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message || "Failed to load order" },
            { status: 500 }
        );
    }
}

