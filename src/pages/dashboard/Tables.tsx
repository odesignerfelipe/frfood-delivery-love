import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, QrCode as QrCodeIcon, Printer, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { printerService } from "@/lib/printer";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const Tables = () => {
    const { store } = useStore();
    const [tables, setTables] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [name, setName] = useState("");

    const [qrOpen, setQrOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState<any>(null);
    const [printerSettings, setPrinterSettings] = useState<any[]>([]);

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
        fetchPrinterSettings();
    }, [store]);

    const fetchPrinterSettings = async () => {
        if (!store) return;
        const { data } = await supabase.from("printer_settings").select("*").eq("store_id", store.id).eq("is_active", true);
        setPrinterSettings(data || []);
    };

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

    const handlePrint = async () => {
        if (!selectedTable || !store) return;

        const svgElement = document.getElementById("qr-code-svg")?.outerHTML;

        const html = `
      <html>
        <head>
          <title>Imprimir QR Code - ${selectedTable.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #fff;
            }
            .card {
              border: 1px solid #E5E7EB;
              border-radius: 16px;
              padding: 24px;
              width: 280px;
              box-sizing: border-box;
              background: #fff;
              text-align: center;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            }
            .logo { max-height: 48px; max-width: 180px; margin-bottom: 20px; object-fit: contain; }
            .title { font-size: 16px; font-weight: 800; margin-bottom: 6px; color: #111827; text-transform: uppercase; letter-spacing: 0.5px; }
            .instruction { font-size: 12px; margin-bottom: 20px; color: #6B7280; line-height: 1.4; }
            .qr-container { background: white; padding: 12px; border-radius: 12px; display: inline-block; margin-bottom: 20px; border: 1px solid #E5E7EB; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
            svg { width: 160px !important; height: 160px !important; display: block; }
            .table-name { font-size: 14px; font-weight: 800; color: #374151; padding: 8px 16px; background-color: #F3F4F6; border-radius: 8px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="card">
            ${store.logo_url ? `<img src="${store.logo_url}" class="logo" alt="Logo" />` : ''}
            <div class="title">Faça seu Pedido</div>
            <div class="instruction">Aponte a câmera do seu celular para o QR CODE para realizar o seu pedido</div>
            <div class="qr-container">${svgElement || ''}</div>
            <div class="table-name">${selectedTable.name}</div>
          </div>
        </body>
      </html>
    `;

        const cashierPrinter = printerSettings.find(s => s.type === 'cashier');
        if (cashierPrinter) {
            await printerService.printHTML(cashierPrinter.identifier, html);
        } else {
            const printWindow = window.open("", "_blank");
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
                printWindow.print();
            }
        }
    };

    const handleDownloadPNG = async () => {
        const element = document.getElementById("qr-card");
        if (!element) return;
        
        try {
            const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 3 });
            const dataUrl = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.download = `QR_Code_${selectedTable?.name || 'mesa'}.png`;
            link.href = dataUrl;
            link.click();
            toast.success("Imagem baixada com sucesso!");
        } catch (error) {
            console.error("Erro ao gerar imagem:", error);
            toast.error("Erro ao gerar a imagem do QR Code.");
        }
    };

    const handleDownloadPDF = async () => {
        const element = document.getElementById("qr-card");
        if (!element) return;

        try {
            toast.loading("Gerando PDF...");
            // Usamos uma escala alta para garantir nitidez no PDF
            const canvas = await html2canvas(element, { 
                backgroundColor: '#ffffff', 
                scale: 4,
                useCORS: true, // Garante que imagens externas (como logo) sejam carregadas se estiverem em domínios permitidos
                logging: false
            });
            
            const imgData = canvas.toDataURL('image/png', 1.0);
            
            // Calculamos o tamanho do PDF baseado nas proporções do card (280px de largura no CSS)
            // No PDF (A4 é ~210mm de largura), mas aqui usaremos o tamanho exato do elemento em mm
            const imgWidth = 80; // Largura em mm no PDF
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            const pdf = new jsPDF({
                orientation: imgHeight > imgWidth ? 'portrait' : 'landscape',
                unit: 'mm',
                format: [imgWidth + 20, imgHeight + 20] // Margem de 10mm em cada lado
            });
            
            pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight, undefined, 'FAST');
            pdf.save(`QR_Code_${selectedTable?.name || 'mesa'}.pdf`);
            
            toast.dismiss();
            toast.success("PDF gerado com sucesso!");
        } catch (error) {
            toast.dismiss();
            console.error("Erro ao gerar PDF:", error);
            toast.error("Erro ao gerar o PDF do QR Code.");
        }
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
                            
                            {/* Card que será exportado como imagem */}
                            <div id="qr-card" className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center w-full max-w-[280px] mx-auto text-center relative overflow-hidden">
                                {store.logo_url && <img src={store.logo_url} className="h-12 w-auto mb-4 object-contain" alt="Logo" />}
                                <h3 className="font-black text-lg text-foreground uppercase tracking-widest mb-2">Faça seu Pedido</h3>
                                <p className="text-xs font-medium text-muted-foreground mb-6 leading-tight">
                                    Aponte a câmera do seu celular para o QR CODE para realizar o seu pedido
                                </p>
                                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 mb-6">
                                    <QRCodeSVG
                                        id="qr-code-svg"
                                        value={`${window.location.protocol}//${window.location.host}/mesa/${selectedTable.id}`}
                                        size={160}
                                        level={"H"}
                                        includeMargin={false}
                                        fgColor={"#000000"}
                                        imageSettings={store.logo_url ? {
                                            src: store.logo_url,
                                            x: undefined,
                                            y: undefined,
                                            height: 38,
                                            width: 38,
                                            excavate: true,
                                        } : undefined}
                                    />
                                </div>
                                <div className="bg-muted px-4 py-2 rounded-lg font-black text-foreground text-sm uppercase tracking-widest inline-block border border-border">
                                    {selectedTable.name}
                                </div>
                            </div>

                            <p className="text-[10px] text-muted-foreground w-4/5 mx-auto mt-4 font-medium uppercase tracking-widest hidden sm:block">
                                Link direto: <span className="lowercase">{`${window.location.protocol}//${window.location.host}/mesa/${selectedTable.id}`}</span>
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-6">
                                <Button onClick={handlePrint} variant="outline" className="h-11 font-bold">
                                    <Printer className="w-4 h-4 mr-2" /> Imprimir
                                </Button>
                                <Button onClick={handleDownloadPDF} variant="hero" className="h-11 font-extrabold">
                                    <Download className="w-4 h-4 mr-2" /> Baixar PDF
                                </Button>
                                <Button onClick={handleDownloadPNG} variant="ghost" className="h-11 text-xs sm:col-span-2 opacity-70 hover:opacity-100">
                                    <Download className="w-3 h-3 mr-2" /> Baixar em PNG
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Tables;
