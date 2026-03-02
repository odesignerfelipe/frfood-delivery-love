import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, Search, FileDown, FileSpreadsheet, Phone } from "lucide-react";

interface Customer {
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    neighborhood: string;
    total_orders: number;
    last_order_date: string;
}

const Customers = () => {
    const { store } = useStore();
    const [orders, setOrders] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!store) return;
        const fetchOrders = async () => {
            const { data } = await supabase
                .from("orders")
                .select("customer_name, customer_phone, customer_address, neighborhood, created_at")
                .eq("store_id", store.id)
                .order("created_at", { ascending: false });
            setOrders(data || []);
            setLoading(false);
        };
        fetchOrders();
    }, [store]);

    const customers: Customer[] = useMemo(() => {
        const map = new Map<string, Customer>();
        for (const order of orders) {
            const key = `${(order.customer_phone || "").trim().toLowerCase()}`;
            if (!key) continue;
            const existing = map.get(key);
            if (existing) {
                existing.total_orders += 1;
                // Keep most recent address
                if (!existing.customer_address && order.customer_address) {
                    existing.customer_address = order.customer_address;
                    existing.neighborhood = order.neighborhood || "";
                }
                // Keep most recent name
                if (!existing.customer_name && order.customer_name) {
                    existing.customer_name = order.customer_name;
                }
            } else {
                map.set(key, {
                    customer_name: order.customer_name || "",
                    customer_phone: order.customer_phone || "",
                    customer_address: order.customer_address || "",
                    neighborhood: order.neighborhood || "",
                    total_orders: 1,
                    last_order_date: order.created_at,
                });
            }
        }
        return Array.from(map.values());
    }, [orders]);

    const filtered = useMemo(() => {
        if (!search.trim()) return customers;
        const q = search.toLowerCase();
        return customers.filter(
            (c) =>
                c.customer_name.toLowerCase().includes(q) ||
                c.customer_phone.toLowerCase().includes(q) ||
                c.customer_address.toLowerCase().includes(q)
        );
    }, [customers, search]);

    const exportCSV = () => {
        if (filtered.length === 0) {
            toast.error("Nenhum cliente para exportar");
            return;
        }
        const header = "Nome,Telefone/WhatsApp,Endereço,Bairro,Total de Pedidos";
        const rows = filtered.map(
            (c) =>
                `"${c.customer_name}","${c.customer_phone}","${c.customer_address}","${c.neighborhood}",${c.total_orders}`
        );
        const csv = [header, ...rows].join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `clientes_${store?.name || "loja"}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Planilha exportada!");
    };

    const exportPDF = () => {
        if (filtered.length === 0) {
            toast.error("Nenhum cliente para exportar");
            return;
        }
        const printContent = `
      <html>
      <head><title>Clientes - ${store?.name || "Loja"}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #000; }
        h1 { font-size: 18px; text-align: center; margin-bottom: 5px; }
        h2 { font-size: 14px; text-align: center; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: bold; }
        tr:nth-child(even) { background: #fafafa; }
        .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #999; }
      </style></head>
      <body>
        <h1>${store?.name || "Loja"}</h1>
        <h2>Lista de Clientes — ${filtered.length} cliente${filtered.length !== 1 ? "s" : ""}</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nome</th>
              <th>Telefone / WhatsApp</th>
              <th>Endereço</th>
              <th>Bairro</th>
              <th>Pedidos</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
                .map(
                    (c, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${c.customer_name}</td>
                <td>${c.customer_phone}</td>
                <td>${c.customer_address}</td>
                <td>${c.neighborhood}</td>
                <td>${c.total_orders}</td>
              </tr>`
                )
                .join("")}
          </tbody>
        </table>
        <p class="footer">Gerado por FRFood em ${new Date().toLocaleDateString("pt-BR")}</p>
      </body></html>
    `;
        const win = window.open("", "_blank", "width=800,height=600");
        if (win) {
            win.document.write(printContent);
            win.document.close();
            win.print();
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Clientes</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {customers.length} cliente{customers.length !== 1 ? "s" : ""} cadastrado{customers.length !== 1 ? "s" : ""}
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportPDF}>
                        <FileDown className="w-4 h-4 mr-1" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportCSV}>
                        <FileSpreadsheet className="w-4 h-4 mr-1" /> Planilha
                    </Button>
                </div>
            </div>

            <div className="relative mb-4 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar cliente por nome, telefone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                />
            </div>

            <div className="bg-card rounded-xl border border-border/50 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                            <tr>
                                <th className="px-4 py-3">Nome</th>
                                <th className="px-4 py-3">Telefone / WhatsApp</th>
                                <th className="px-4 py-3">Endereço</th>
                                <th className="px-4 py-3">Bairro</th>
                                <th className="px-4 py-3">Pedidos</th>
                                <th className="px-4 py-3">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c, i) => (
                                <tr key={i} className="border-b border-border hover:bg-muted/20">
                                    <td className="px-4 py-3 font-medium text-foreground">{c.customer_name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{c.customer_phone}</td>
                                    <td className="px-4 py-3">{c.customer_address || "—"}</td>
                                    <td className="px-4 py-3">{c.neighborhood || "—"}</td>
                                    <td className="px-4 py-3">
                                        <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-bold">
                                            {c.total_orders}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {c.customer_phone && (
                                            <a
                                                href={`https://wa.me/55${c.customer_phone.replace(/\D/g, "")}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium"
                                            >
                                                <Phone className="w-3 h-3" /> WhatsApp
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="p-12 text-center text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Nenhum cliente encontrado</p>
                            <p className="text-sm mt-1">Os clientes aparecerão aqui automaticamente ao fazerem pedidos.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Customers;
