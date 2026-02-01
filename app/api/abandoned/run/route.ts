import { NextResponse } from "next/server";
import { listOrders, upsertOrder } from "@/lib/orders";
import { buildStage1, buildStage2, buildStage3 } from "@/lib/abandonedMessages";

export const runtime = "nodejs";

/**
 * Behavior:
 * - One stage per order per run (anti-spam)
 * - Multiple orders per run (prevents backlog starvation)
 * - Oldest orders processed first
 */

function getBearerToken(req: Request): string | null {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!auth) return null;
    const m = auth.match(/^Bearer\s+(.+)$/i);
    return m?.[1]?.trim() ?? null;
}

function isAuthorized(req: Request): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return true; // allow local if not set (you can tighten if you want)

    const url = new URL(req.url);
    const qsSecret = url.searchParams.get("secret") || url.searchParams.get("cron_secret");
    const bearer = getBearerToken(req);

    return qsSecret === secret || bearer === secret;
}

function isPaid(order: any): boolean {
    const s = String(order?.paymentStatus ?? "").toLowerCase();
    return s === "paid";
}

function minutesSinceCreated(order: any): number {
    const createdAtStr = String(order?.createdAt ?? "");
    const createdAt = Date.parse(createdAtStr);
    if (!Number.isFinite(createdAt)) return NaN;
    return (Date.now() - createdAt) / 60000;
}

function toStage(order: any): number {
    const n = Number(order?.abandonedStage ?? 0);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(3, Math.floor(n)));
}

function defaultConfig() {
    return {
        stage1Min: Number(process.env.ABANDONED_STAGE1_MIN ?? 10),
        stage2Min: Number(process.env.ABANDONED_STAGE2_MIN ?? 20),
        stage3Min: Number(process.env.ABANDONED_STAGE3_MIN ?? 1440),
        maxPerRun: Number(process.env.ABANDONED_MAX_PER_RUN ?? 20),
    };
}

function clampInt(n: unknown, fallback: number, min: number, max: number) {
    const v = Number(n);
    if (!Number.isFinite(v)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(v)));
}

function computeNextStage(stage: number, mins: number, stage1Min: number, stage2Min: number, stage3Min: number) {
    if (!Number.isFinite(mins)) return null;

    // One-stage-per-order-per-run
    if (stage <= 0 && mins >= stage1Min) return 1;
    if (stage === 1 && mins >= stage2Min) return 2;
    if (stage === 2 && mins >= stage3Min) return 3;

    return null;
}

function hasRecoveryLink(order: any): boolean {
    const url = String(order?.checkoutUrl ?? "").trim();
    return url.startsWith("http");
}

function hasContact(order: any): boolean {
    const email = String(order?.email ?? order?.customerEmail ?? "").trim();
    const phone = String(order?.phone ?? "").trim();
    // Stage 1 wants WhatsApp+Email, Stage 2 wants SMS. We allow if either exists.
    return Boolean(email || phone);
}

function sortByCreatedAtOldestFirst(a: any, b: any) {
    const ta = Date.parse(String(a?.createdAt ?? ""));
    const tb = Date.parse(String(b?.createdAt ?? ""));
    const va = Number.isFinite(ta) ? ta : 0;
    const vb = Number.isFinite(tb) ? tb : 0;
    return va - vb;
}

function sourceLabel(req: Request): string {
    // Helps distinguish local/manual vs cron pings
    if (req.headers.get("x-vercel-cron")) return "vercel-cron";
    if (req.headers.get("user-agent")?.toLowerCase().includes("vercel")) return "vercel";
    return "manual-post";
}

export async function POST(req: Request) {
    try {
        if (!isAuthorized(req)) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json().catch(() => ({} as any));
        const def = defaultConfig();

        const stage1Min = clampInt(body?.stage1Min ?? def.stage1Min, def.stage1Min, 0, 60 * 24 * 30);
        const stage2Min = clampInt(body?.stage2Min ?? def.stage2Min, def.stage2Min, 0, 60 * 24 * 30);
        const stage3Min = clampInt(body?.stage3Min ?? def.stage3Min, def.stage3Min, 0, 60 * 24 * 30);
        const maxPerRun = clampInt(body?.maxPerRun ?? def.maxPerRun, def.maxPerRun, 1, 200);

        const orders = await listOrders();

        // Eligible base set: unpaid + recovery link + contact
        const candidates = orders
            .filter((o: any) => !isPaid(o))
            .filter((o: any) => hasRecoveryLink(o))
            .filter((o: any) => hasContact(o))
            .slice()
            .sort(sortByCreatedAtOldestFirst);

        const nowIso = new Date().toISOString();
        const results: any[] = [];

        for (const o of candidates) {
            if (results.length >= maxPerRun) break;

            const mins = minutesSinceCreated(o);
            const stage = toStage(o);
            const nextStage = computeNextStage(stage, mins, stage1Min, stage2Min, stage3Min);
            if (!nextStage) continue;

            // Build log-only message payloads
            let log: any = {};
            if (nextStage === 1) log = buildStage1(o);
            if (nextStage === 2) log = buildStage2(o);
            if (nextStage === 3) log = buildStage3(o);

            const abandonedFirstAt = o?.abandonedFirstAt ?? nowIso;
            const updated = await upsertOrder({
                ...o,
                abandonedStage: nextStage,
                abandonedFirstAt,
                abandonedLastAt: nowIso,
            });

            results.push({
                id: updated?.id ?? o?.id,
                shortRef: updated?.shortRef ?? o?.shortRef ?? null,
                stage: nextStage,
                minutesSinceCreated: Number.isFinite(mins) ? Math.floor(mins) : null,
                log,
            });
        }

        return NextResponse.json(
            {
                ok: true,
                stage1Min,
                stage2Min,
                stage3Min,
                maxPerRun,
                processed: results.length,
                results,
                source: sourceLabel(req),
            },
            { status: 200 }
        );
    } catch (e: any) {
        return NextResponse.json(
            { ok: false, error: e?.message || "Failed to run abandoned checker" },
            { status: 500 }
        );
    }
}


