import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, QrCode as QrCodeIcon, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const Tables = () => {
    const { store } = useStore();
    const [tables, setTables] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [name, setName] = useState("");

    const [qrOpen, setQrOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState<any>(null);

    const fetchTables = async () => {
        if (!store) return;
        const { data } = await supabase
            .from("tables")
            .select("*")
            .eq("store_id", store.id)
            .order("name");
        setTables(data || []);
    };

    useEffect(() => {
        fetchTables();
    }, [store]);

    const handleSave = async () => {
        if (!store || !name.trim()) return;
        if (editing) {
            await supabase.from("tables").update({ name }).eq("id", editing.id);
            toast.success("Mesa atualizada!");
        } else {
            await supabase.from("tables").insert({ name, store_id: store.id });
            toast.success("Mesa criada!");
        }
        setOpen(false);
        setName("");
        setEditing(null);
        fetchTables();
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Excluir esta mesa? Comandas vinculadas poderão ser afetadas.")) return;
        await supabase.from("tables").delete().eq("id", id);
        toast.success("Mesa excluída!");
        fetchTables();
    };

    const openEdit = (table: any) => {
        setEditing(table);
        setName(table.name);
        setOpen(true);
    };

    const openNew = () => {
        setEditing(null);
        setName("");
        setOpen(true);
    };

    const openQR = (table: any) => {
        setSelectedTable(table);
        setQrOpen(true);
    };

    const handlePrint = () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow || !selectedTable || !store) return;

        const tableUrl = `${window.location.protocol}//${window.location.host}/mesa/${selectedTable.id}`;

        // Obter o SVG do QR Code desenhado na tela
        const svgElement = document.getElementById("qr-code-svg")?.outerHTML;

        printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR Code - ${selectedTable.name}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
              color: #333;
            }
            .card {
              border: 2px solid ${store.primary_color || '#ea580c'};
              border-radius: 20px;
              padding: 40px;
              max-width: 400px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
            .logo {
              max-height: 80px;
              max-width: 250px;
              margin-bottom: 20px;
              border-radius: 8px;
            }
            .title {
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 10px;
              color: ${store.primary_color || '#ea580c'};
            }
            .instruction {
              font-size: 18px;
              margin-bottom: 30px;
              color: #555;
            }
            .qr-container {
              background: white;
              padding: 20px;
              border-radius: 12px;
              display: inline-block;
              margin-bottom: 20px;
              border: 1px solid #ddd;
            }
            svg {
              width: 250px !important;
              height: 250px !important;
            }
            .table-name {
              font-size: 24px;
              font-weight: bold;
              color: #000;
              margin-top: 10px;
              padding: 10px 20px;
              background-color: #f5f5f5;
              border-radius: 10px;
              display: inline-block;
            }
          </style>
        </head>
        <body>
          <div class="card">
            ${store.logo_url ? `<img src="${store.logo_url}" class="logo" alt="Logo" />` : ''}
            <div class="title">Faça seu pedido</div>
            <div class="instruction">
              Aponte a câmera do seu celular para este QR Code e acesse nosso cardápio digital.
            </div>
            <div class="qr-container">
              ${svgElement || ''}
            </div>
            <div class="table-name">${selectedTable.name}</div>
          </div>
          <script>
            window.onload = () => {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
        printWindow.document.close();
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Mesas</h2>
                    <p className="text-muted-foreground text-sm">Gerencie as mesas do estabelecimento e gere os QR Codes.</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button variant="hero" size="sm" onClick={openNew}>
                            <Plus className="w-4 h-4 mr-1" /> Nova Mesa
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editing ? "Editar Mesa" : "Nova Mesa"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>Nome ou Número da Mesa</Label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Mesa 01" />
                            </div>
                            <Button variant="hero" onClick={handleSave} className="w-full">
                                {editing ? "Salvar" : "Criar"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-4">
                {tables.length === 0 && (
                    <div className="text-center py-16 bg-card rounded-xl border border-dashed border-border">
                        <QrCodeIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium text-foreground mb-1">Nenhuma mesa cadastrada</h3>
                        <p className="text-muted-foreground mb-4">Adicione mesas para gerar os QR Codes de pedidos.</p>
                        <Button variant="outline" onClick={openNew}>
                            <Plus className="w-4 h-4 mr-1" /> Associar Mesa
                        </Button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tables.map((table) => (
                        <div key={table.id} className="bg-card rounded-xl p-5 shadow-sm border border-border/50 flex flex-col items-center justify-between text-center group hover:border-primary/50 transition-colors">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                                <QrCodeIcon className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-4">{table.name}</h3>

                            <div className="flex w-full gap-2">
                                <Button variant="outline" className="flex-1" onClick={() => openQR(table)}>
                                    <QrCodeIcon className="w-4 h-4 mr-2" /> QR Code
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openEdit(table)}>
                                    <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(table.id)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* QR Code Dialog */}
            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                <DialogContent className="sm:max-w-md text-center">
                    <DialogHeader>
                        <DialogTitle>QR Code - {selectedTable?.name}</DialogTitle>
                    </DialogHeader>
                    {selectedTable && store && (
                        <div className="flex flex-col items-center justify-center py-6 space-y-6">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm inline-block">
                                <QRCodeSVG
                                    id="qr-code-svg"
                                    value={`${window.location.protocol}//${window.location.host}/mesa/${selectedTable.id}`}
                                    size={200}
                                    level={"H"}
                                    includeMargin={false}
                                    fgColor={store.primary_color || "#000000"}
                                    imageSettings={store.logo_url ? {
                                        src: store.logo_url,
                                        x: undefined,
                                        y: undefined,
                                        height: 48,
                                        width: 48,
                                        excavate: true,
                                    } : undefined}
                                />
                            </div>
                            <p className="text-sm text-muted-foreground w-4/5 mx-auto">
                                Este é o link que o cliente acessará:
                                <br />
                                <span className="font-mono text-xs text-foreground bg-muted px-2 py-1 rounded mt-2 block break-all">
                                    {`${window.location.protocol}//${window.location.host}/mesa/${selectedTable.id}`}
                                </span>
                            </p>
                            <Button onClick={handlePrint} className="w-full sm:w-auto" variant="hero">
                                <Printer className="w-4 h-4 mr-2" /> Imprimir Card de Mesa
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Tables;
