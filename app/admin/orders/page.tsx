// app/admin/orders/page.tsx
import { listOrders } from "@/lib/orders";
import AdminOrdersClient from "./AdminOrdersClient";

export default function AdminOrdersPage() {
    const orders = listOrders()
        .slice()
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    return (
        <main className="min-h-screen py-12">
            <div className="mx-auto w-full max-w-5xl px-6">
                <h1 className="text-3xl font-extrabold uppercase">Orders (Local)</h1>
                <p className="mt-2 text-black/60">Temporary storage in data/orders.json</p>

                <div className="mt-6">
                    <AdminOrdersClient initialOrders={orders as any[]} />
                </div>
            </div>
        </main>
    );
}




