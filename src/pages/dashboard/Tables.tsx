import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, QrCode as QrCodeIcon, Printer, Download } from "lucide-react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
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
    const [logoDataUrl, setLogoDataUrl] = useState<string>("");

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

    const preloadLogo = async () => {
        if (!store?.logo_url) {
            setLogoDataUrl("");
            return;
        }
        try {
            const response = await fetch(store.logo_url);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoDataUrl(reader.result as string);
            };
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error("Error preloading logo:", error);
            setLogoDataUrl(store.logo_url); // Fallback to original URL
        }
    };

    useEffect(() => {
        if (store) preloadLogo();
    }, [store?.logo_url]);

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

        const canvas = document.getElementById("qr-code-canvas") as HTMLCanvasElement;
        const qrImage = canvas ? canvas.toDataURL("image/png") : "";
        const qrHtml = qrImage ? `<img src="${qrImage}" style="width: 160px; height: 160px; display: block;" />` : "";
        const logoUrl = logoDataUrl || store.logo_url;

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
              min-height: 100vh;
              margin: 0;
              background-color: #fff;
            }
            .card {
              border: 1px solid #E5E7EB;
              border-radius: 24px;
              padding: 32px 24px;
              width: 280px;
              box-sizing: border-box;
              background: #fff;
              text-align: center;
              position: relative;
            }
            .logo { height: 48px; width: auto; margin-bottom: 16px; object-fit: contain; }
            .title { font-size: 18px; font-weight: 800; margin-bottom: 8px; color: #111827; text-transform: uppercase; letter-spacing: 1px; }
            .instruction { font-size: 12px; font-weight: 500; margin-bottom: 24px; color: #6B7280; line-height: 1.4; padding: 0 16px; }
            .qr-container { background: white; padding: 12px; border-radius: 16px; display: inline-block; margin-bottom: 24px; border: 1px solid #F3F4F6; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); }
            .qr-container img { width: 160px !important; height: 160px !important; display: block; }
            .table-badge { background-color: #F3F4F6; padding: 8px 16px; border-radius: 8px; font-weight: 900; color: #111827; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #E5E7EB; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="card">
            ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" />` : ''}
            <div class="title">Faça seu Pedido</div>
            <p class="instruction">Aponte a câmera do seu celular para o QR CODE para realizar o seu pedido</p>
            <div class="qr-container">${qrHtml}</div>
            <div class="table-badge">${selectedTable.name}</div>
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
                            <div id="qr-card" className="bg-white p-8 rounded-[24px] border border-gray-200 shadow-sm flex flex-col items-center w-full max-w-[280px] mx-auto text-center relative overflow-hidden">
                                {store.logo_url && <img src={logoDataUrl || store.logo_url} className="h-12 w-auto mb-4 object-contain" alt="Logo" />}
                                <h3 className="font-black text-lg text-gray-900 uppercase tracking-widest mb-2">Faça seu Pedido</h3>
                                <p className="text-xs font-medium text-gray-500 mb-6 leading-tight px-2">
                                    Aponte a câmera do seu celular para o QR CODE para realizar o seu pedido
                                </p>
                                <div className="bg-white p-3 rounded-[16px] shadow-sm border border-gray-100 mb-6">
                                    <QRCodeCanvas
                                        id="qr-code-canvas"
                                        value={`${window.location.protocol}//${window.location.host}/mesa/${selectedTable.id}`}
                                        size={160}
                                        level={"H"}
                                        includeMargin={false}
                                        imageSettings={store.logo_url ? {
                                            src: logoDataUrl || store.logo_url,
                                            height: 40,
                                            width: 40,
                                            excavate: true,
                                        } : undefined}
                                    />
                                </div>
                                <div className="bg-[#F3F4F6] px-4 py-2 rounded-lg font-black text-gray-900 text-sm uppercase tracking-widest inline-block border border-gray-200">
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
