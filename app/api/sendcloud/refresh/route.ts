import { NextResponse } from "next/server";
import { getOrderById, upsertOrder } from "@/lib/orders";
import { getSendcloudParcel } from "@/lib/sendcloud";
import { applySendcloudStatusUpdate } from "@/lib/orders";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const orderId = String(body?.orderId ?? "");

        if (!orderId) {
            return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
        }

        const existing = getOrderById(orderId);
        if (!existing) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        const parcelId = Number(existing.shippingLabelId);
        if (!parcelId) {
            return NextResponse.json({ error: "No Sendcloud parcel id for this order" }, { status: 400 });
        }

        const resp = await getSendcloudParcel(parcelId);
        const parcel = resp?.parcel;

        const updated = applySendcloudStatusUpdate(existing, {
            parcelId: parcel?.id ?? parcelId,
            trackingNumber: parcel?.tracking_number ?? null,
            trackingUrl: parcel?.tracking_url ?? null,
            status: parcel?.status ?? null,
        });

        upsertOrder(updated);

        return NextResponse.json({ ok: true, order: updated });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
    }
}
