import * as qz from "qz-tray";
import { toast } from "sonner";

export interface PrinterData {
    identifier: string;
    type: 'kitchen' | 'bar' | 'cashier';
}

class PrinterService {
    private isConnected = false;

    async connect() {
        if (this.isConnected) return;
        try {
            // Check if already connected or trying to connect
            if (qz.websocket.isActive()) {
                this.isConnected = true;
                return;
            }

            await qz.websocket.connect();
            this.isConnected = true;
        } catch (err: any) {
            console.error("QZ Tray Connection Error:", err);
            // toast.error("Não foi possível conectar ao QZ Tray. Verifique se o serviço está rodando.");
        }
    }

    async findPrinters() {
        await this.connect();
        if (!this.isConnected) return [];
        return await qz.printers.find();
    }

    async printHTML(printerName: string, htmlContent: string) {
        try {
            await this.connect();
            if (!this.isConnected) throw new Error("QZ Tray não conectado");

            const config = qz.configs.create(printerName);
            const data = [
                {
                    type: 'html',
                    format: 'plain',
                    data: htmlContent
                }
            ];

            await qz.print(config, data);
            toast.success("Impressão enviada!");
        } catch (err: any) {
            console.error("Print Error:", err);
            toast.error("Erro ao imprimir: " + err.message);
        }
    }
}

export const printerService = new PrinterService();
