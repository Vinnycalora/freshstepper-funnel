export function Progress({ step }: { step: 1 | 2 | 3 | 4 }) {
    const pct = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100;

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-black/70">
                <div className="font-semibold">Step {step} of 4</div>
                <div>{pct}%</div>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-black/10">
                <div
                    className="h-2 rounded-full bg-[#1DB954] transition-all"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}
