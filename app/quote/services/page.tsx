"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/Container";
import { Progress } from "@/components/Progress";
import { getFunnelState, updateFunnelState } from "@/components/funnelStore";
import { SERVICE_OPTIONS, ServiceId } from "@/components/servicesCatalog";

function ToggleRow({
    checked,
    label,
    hint,
    onChange,
}: {
    checked: boolean;
    label: string;
    hint: string;
    onChange: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onChange}
            className="flex w-full items-start justify-between gap-4 rounded-xl border border-[#E5E5E5] bg-white p-4 text-left shadow-sm transition hover:border-[#1DB954]"
        >
            <div>
                <div className="font-bold uppercase">{label}</div>
                <div className="mt-1 text-sm text-black/65">{hint}</div>
            </div>

            <div
                className={[
                    "mt-1 h-6 w-6 flex-shrink-0 rounded-md border transition",
                    checked ? "border-[#1DB954] bg-[#1DB954]" : "border-black/20 bg-white",
                ].join(" ")}
                aria-hidden="true"
            />
        </button>
    );
}

export default function QuoteServicesPage() {
    const router = useRouter();

    const initial = useMemo(() => {
        const s = getFunnelState();
        return {
            shoeType: s.shoeType ?? null,
            services: (s.services ?? []) as ServiceId[],
            unsure: (s.services ?? []).includes("unsure"),
        };
    }, []);

    // If they skipped Step 1, send them back
    if (!initial.shoeType) {
        router.push("/quote/type");
    }

    const [selected, setSelected] = useState<ServiceId[]>(initial.services);
    const unsure = selected.includes("unsure" as any);

    function toggle(id: ServiceId) {
        setSelected((prev) => {
            const has = prev.includes(id);
            const next = has ? prev.filter((x) => x !== id) : [...prev, id];
            updateFunnelState({ services: next });
            return next;
        });
    }

    function setUnsure(on: boolean) {
        setSelected((prev) => {
            const cleaned = prev.filter((x) => x !== ("unsure" as any));
            const next = on ? [...cleaned, "unsure" as any] : cleaned;
            updateFunnelState({ services: next });
            return next;
        });
    }

    const canContinue = selected.length > 0;

    return (
        <main className="min-h-screen py-12">
            <Container>
                <Progress step={2} />

                <h1 className="text-3xl font-extrabold uppercase sm:text-4xl">
                    What do your shoes need?
                </h1>
                <p className="mt-3 text-black/70">
                    Select everything that applies — we’ll confirm details during processing.
                </p>

                {/* Unsure helper */}
                <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="font-extrabold uppercase">Not sure?</div>
                            <div className="mt-1 text-sm text-black/70">
                                Choose this and we’ll assess the best restoration options for you.
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setUnsure(!unsure)}
                            className={[
                                "rounded-lg px-4 py-2 font-semibold transition",
                                unsure ? "bg-[#1DB954] text-white" : "border border-black/20 bg-white hover:bg-black/5",
                            ].join(" ")}
                        >
                            {unsure ? "Selected" : "Add 'Unsure'"}
                        </button>
                    </div>
                </div>

                {/* Options */}
                <div className="mt-8 grid gap-3">
                    {SERVICE_OPTIONS.map((opt) => (
                        <ToggleRow
                            key={opt.id}
                            checked={selected.includes(opt.id)}
                            label={opt.label}
                            hint={opt.hint}
                            onChange={() => toggle(opt.id)}
                        />
                    ))}
                </div>

                <div className="mt-10 flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push("/quote/type")}
                        className="rounded-lg border border-black/20 bg-white px-6 py-3 font-semibold hover:bg-black/5"
                    >
                        Back
                    </button>

                    <button
                        type="button"
                        disabled={!canContinue}
                        onClick={() => router.push("/quote/upgrades")}
                        className={[
                            "rounded-lg px-6 py-3 font-semibold text-white transition",
                            canContinue ? "bg-[#1DB954] hover:opacity-90" : "bg-black/20 cursor-not-allowed",
                        ].join(" ")}
                    >
                        Continue
                    </button>
                </div>

                <div className="mt-6 text-sm text-black/60">
                    Tip: Select “Deep clean” for most pairs. Add “Odour treatment” if they smell.
                </div>
            </Container>
        </main>
    );
}
