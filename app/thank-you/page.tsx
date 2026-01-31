import { Suspense } from "react";
import ThankYouClient from "./ThankYouClient";

export default function ThankYouPage() {
    return (
        <Suspense fallback={<div className="min-h-screen p-10 text-sm text-black/70">Loading…</div>}>
            <ThankYouClient />
        </Suspense>
    );
}



