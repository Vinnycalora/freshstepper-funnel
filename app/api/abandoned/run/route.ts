import { NextResponse } from "next/server";
import { listOrders, upsertOrder } from "@/lib/orders";
import { buildStage1, buildStage2, buildStage3 } from "@/lib/abandonedMessages";

export const runtime = "nodejs";

function isPaid(order: any): boolean {
    const s = String(order?.paymentStatus ?? "").toLowerCase();
    return s === "paid";
}

function minutesSinceCreated(order: any): number {
    const createdAt = Date.parse(String(order?.createdAt ?? ""));
    if (!Number.isFinite(createdAt)) return 0;
    return (Date.now() - createdAt) / 60000;
}

function nowIso() {
    return new Date().toISOString();
}

/**
 * Vercel Cron security:
 * If CRON_SECRET is set, Vercel will send:
 *   Authorization: Bearer <CRON_SECRET>
 * when invoking the cron URL. :contentReference[oaicite:2]{index=2}
 *
 * Locally, if CRON_SECRET is NOT set, we allow requests (dev convenience).
 */
function isCronAuthorized(req: Request): boolean {
    const secret = process.env.CRON_SECRET;

    // Dev convenience: no secret set => allow
    if (!secret) return true;

    const auth = req.headers.get("authorization") || "";
    if (auth === `Bearer ${secret}`) return true;

    // Optional fallbacks (helpful if you ever trigger manually):
    const headerSecret = req.headers.get("x-cron-secret") || "";
    if (headerSecret === secret) return true;

    try {
        const url = new URL(req.url);
        const qs = url.searchParams.get("secret") || "";
        if (qs === secret) return true;
    } catch {
        // ignore
    }

    return false;
}

function getDefaultStageMins() {
    return {
        stage1Min: Number(process.env.ABANDONED_STAGE1_MIN ?? 10),
        stage2Min: Number(process.env.ABANDONED_STAGE2_MIN ?? 20),
        stage3Min: Number(process.env.ABANDONED_STAGE3_MIN ?? 1440),
    };
}

function runOnce(opts: { stage1Min: number; stage2Min: number; stage3Min: number }) {
    const { stage1Min, stage2Min, stage3Min } = opts;

    const orders = listOrders();

    // Candidates: unpaid only + has a checkoutUrl (otherwise no recovery)
    const candidates = orders.filter((o: any) => !isPaid(o) && !!o?.checkoutUrl);

    // Process oldest first (so we don’t “skip” earlier abandons)
    candidates.sort((a: any, b: any) => {
        const ta = Date.parse(String(a?.createdAt ?? "")) || 0;
        const tb = Date.parse(String(b?.createdAt ?? "")) || 0;
        return ta - tb;
    });

    const processed: any[] = [];

    for (const order of candidates) {
        const mins = minutesSinceCreated(order);
        const currentStage = Number(order?.abandonedStage ?? 0);

        // Decide which stage is eligible (only ONE stage per run)
        let nextStage: 1 | 2 | 3 | null = null;
        if (currentStage < 1 && mins >= stage1Min) nextStage = 1;
        else if (currentStage < 2 && mins >= stage2Min) nextStage = 2;
        else if (currentStage < 3 && mins >= stage3Min) nextStage = 3;

        if (!nextStage) continue;

        const firstAt = order?.abandonedFirstAt || nowIso();
        const lastAt = nowIso();

        // Build the message payloads (LOG-ONLY for now)
        let msg: any = null;
        if (nextStage === 1) msg = buildStage1(order);
        if (nextStage === 2) msg = buildStage2(order);
        if (nextStage === 3) msg = buildStage3(order);

        // Persist stage update
        upsertOrder({
            ...order,
            abandonedStage: nextStage,
            abandonedFirstAt: firstAt,
            abandonedLastAt: lastAt,
        });

        processed.push({
            id: order?.id,
            shortRef: order?.shortRef,
            stage: nextStage,
            minutesSinceCreated: Math.round(mins),
            log: msg, // still log-only
        });

        // IMPORTANT: one-stage-per-run to prevent spam
        break;
    }

    return processed;
}

/**
 * ✅ GET handler for Vercel Cron:
 * Vercel Cron calls your path with GET. :contentReference[oaicite:3]{index=3}
 */
export async function GET(req: Request) {
    if (!isCronAuthorized(req)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { stage1Min, stage2Min, stage3Min } = getDefaultStageMins();
        const processed = runOnce({ stage1Min, stage2Min, stage3Min });

        return NextResponse.json({
            ok: true,
            stage1Min,
            stage2Min,
            stage3Min,
            processed: processed.length,
            results: processed,
            source: "cron-get",
        });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err?.message ?? String(err) },
            { status: 500 }
        );
    }
}

/**
 * ✅ POST handler (keeps your manual test workflow)
 */
export async function POST(req: Request) {
    if (!isCronAuthorized(req)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const defaults = getDefaultStageMins();

        const stage1Min = Number(body?.stage1Min ?? defaults.stage1Min);
        const stage2Min = Number(body?.stage2Min ?? defaults.stage2Min);
        const stage3Min = Number(body?.stage3Min ?? defaults.stage3Min);

        const processed = runOnce({ stage1Min, stage2Min, stage3Min });

        return NextResponse.json({
            ok: true,
            stage1Min,
            stage2Min,
            stage3Min,
            processed: processed.length,
            results: processed,
            source: "manual-post",
        });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err?.message ?? String(err) },
            { status: 500 }
        );
    }
}
