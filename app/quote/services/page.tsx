"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/Container";
import { Progress } from "@/components/Progress";
import { getFunnelState, updateFunnelState } from "@/components/funnelStore";

type NeedId = "louboutin_sole_refresh" | "deoxidisation" | "new_laces";

type NeedOption = {
    id: NeedId;
    label: string;
    hint: string;
    price: number; // GBP
};

const NEEDS_BY_SHOETYPE: Record<string, NeedOption[]> = {
    trainers: [
        {
            id: "louboutin_sole_refresh",
            label: "Louboutin Sole Refresh (Standard Red)",
            hint: "Restore standard red sole finish.",
            price: 20,
        },
        {
            id: "deoxidisation",
            label: "De-oxidisation",
            hint: "Reduce yellowing / oxidation where possible.",
            price: 25,
        },
        {
            id: "new_laces",
            label: "New laces",
            hint: "Fresh replacement laces (when needed).",
            price: 10,
        },
    ],
    heels: [
        {
            id: "louboutin_sole_refresh",
            label: "Louboutin Sole Refresh (Standard Red)",
            hint: "Restore standard red sole finish.",
            price: 20,
        },
    ],
    // caps / kids / other skip this step entirely
};

function ToggleRow({
    checked,
    label,
    hint,
    price,
    onChange,
}: {
    checked: boolean;
    label: string;
    hint: string;
    price: number;
    onChange: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onChange}
            className="flex w-full items-start justify-between gap-4 rounded-xl border border-[#E5E5E5] bg-white p-4 text-left shadow-sm transition hover:border-[#1DB954]"
        >
            <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-3">
                    <div className="font-bold uppercase">{label}</div>
                    <div className="text-sm font-semibold text-black/70">£{price}</div>
                </div>
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
            services: (s.services ?? []) as string[], // we reuse services[] to store needs add-ons
        };
    }, []);

    // If they skipped Step 1, send them back
    useEffect(() => {
        if (!initial.shoeType) {
            router.push("/quote/type");
            return;
        }

        // Skip Step 2 for caps/kids/other
        if (initial.shoeType === "caps" || initial.shoeType === "kids" || initial.shoeType === "other") {
            router.push("/quote/upgrades");
            return;
        }
    }, [initial.shoeType, router]);

    const options: NeedOption[] = useMemo(() => {
        if (!initial.shoeType) return [];
        return NEEDS_BY_SHOETYPE[initial.shoeType] ?? [];
    }, [initial.shoeType]);

    const [selected, setSelected] = useState<string[]>(initial.services);

    function toggle(id: string) {
        setSelected((prev) => {
            const has = prev.includes(id);
            const next = has ? prev.filter((x) => x !== id) : [...prev, id];
            updateFunnelState({ services: next });
            return next;
        });
    }

    // ✅ Add-ons are optional now: always allow continue
    const canContinue = true;

    return (
        <main className="min-h-screen py-12">
            <Container>
                <Progress step={2} />

                <h1 className="text-3xl font-extrabold uppercase sm:text-4xl">What do your shoes need?</h1>
                <p className="mt-3 text-black/70">
                    Deep clean is included as standard — add any extras below (optional).
                </p>

                {/* Options */}
                <div className="mt-8 grid gap-3">
                    {options.length === 0 ? (
                        <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm text-black/70 shadow-sm">
                            No extra options for this item — continuing…
                        </div>
                    ) : (
                        options.map((opt) => (
                            <ToggleRow
                                key={opt.id}
                                checked={selected.includes(opt.id)}
                                label={opt.label}
                                hint={opt.hint}
                                price={opt.price}
                                onChange={() => toggle(opt.id)}
                            />
                        ))
                    )}
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
            </Container>
        </main>
    );
}

