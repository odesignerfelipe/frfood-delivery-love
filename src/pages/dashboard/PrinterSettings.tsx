import { useStore } from "@/hooks/useStore";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { printerService } from "@/lib/printer";
import {
    Printer,
    RefreshCw,
    Settings2,
    CheckCircle2,
    AlertCircle,
    ToggleLeft,
    ToggleRight,
    Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

const PrinterSettings = () => {
    const { store } = useStore();
    const [localPrinters, setLocalPrinters] = useState<string[]>([]);
    const [savedSettings, setSavedSettings] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        if (!store) return;
        setLoading(true);
        const { data } = await supabase
            .from("printer_settings")
            .select("*")
            .eq("store_id", store.id);
        setSavedSettings(data || []);
        setLoading(false);
    };

    const searchPrinters = async () => {
        setIsSearching(true);
        try {
            const printers = await printerService.findPrinters();
            setLocalPrinters(printers);
            toast.success(`${printers.length} impressoras encontradas.`);
        } catch (err) {
            toast.error("Erro ao buscar impressoras. QZ Tray está rodando?");
        } finally {
            setIsSearching(false);
        }
    };

    const handleSavePrinter = async (type: string, identifier: string) => {
        if (!store) return;

        try {
            // Delete existing for this type
            await supabase.from("printer_settings").delete().eq("store_id", store.id).eq("type", type);

            // Insert new
            const { error } = await supabase.from("printer_settings").insert({
                store_id: store.id,
                name: `Impressora ${type.charAt(0).toUpperCase() + type.slice(1)}`,
                identifier,
                type,
                is_active: true
            });

            if (error) throw error;
            toast.success(`Impressora do ${type} configurada!`);
            fetchSettings();
        } catch (err: any) {
            toast.error("Erro ao salvar: " + err.message);
        }
    };

    useEffect(() => {
        if (store) {
            fetchSettings();
            searchPrinters();
        }
    }, [store]);

    const getSavedPrinter = (type: string) => savedSettings.find(s => s.type === type);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Configurações de Impressão</h2>
                    <p className="text-sm text-muted-foreground">Vincule suas impressoras térmicas para impressão automática</p>
                </div>
                <Button variant="outline" onClick={searchPrinters} disabled={isSearching}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isSearching ? "animate-spin" : ""}`} />
                    Recarregar Impressoras
                </Button>
            </div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 items-start">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                    <p className="font-bold mb-1">Como funciona?</p>
                    <p>Este sistema utiliza o <strong>QZ Tray</strong> para comunicação direta com o hardware. Certifique-se de que o QZ Tray está instalado e aberto no computador onde as impressoras estão conectadas.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {[
                    { type: 'cashier', label: 'Caixa / Balcão', description: 'Impressão de recibos e fechamentos' },
                    { type: 'kitchen', label: 'Cozinha', description: 'Impressão de comandas de produção' },
                    { type: 'bar', label: 'Copa / Bebidas', description: 'Impressão de tickets de bebidas' }
                ].map(printerType => {
                    const saved = getSavedPrinter(printerType.type);
                    return (
                        <Card key={printerType.type} className="border-border/50 shadow-sm relative overflow-hidden">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                        <Printer className="w-6 h-6" />
                                    </div>
                                    {saved ? (
                                        <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Configurada
                                        </span>
                                    ) : (
                                        <span className="bg-orange-100 text-orange-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" /> Pendente
                                        </span>
                                    )}
                                </div>
                                <CardTitle className="mt-4">{printerType.label}</CardTitle>
                                <CardDescription>{printerType.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted-foreground uppercase">Selecionar Impressora</label>
                                        <select
                                            className="w-full bg-muted border-none rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-primary"
                                            value={saved?.identifier || ""}
                                            onChange={(e) => handleSavePrinter(printerType.type, e.target.value)}
                                        >
                                            <option value="">Nenhuma selecionada</option>
                                            {localPrinters.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {saved && (
                                        <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">ID Ativo:</p>
                                            <p className="text-sm font-mono truncate">{saved.identifier}</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default PrinterSettings;
