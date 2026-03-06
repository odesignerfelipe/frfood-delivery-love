import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useOrderNotifications = (storeId: string | undefined, audioNotificationsEnabled: boolean = true) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!storeId || !audioNotificationsEnabled) return;

        // Som de telefone clássico (ringing)
        audioRef.current = new Audio("https://www.myinstants.com/media/sounds/old-telephone-ring.mp3");

        // Solicita permissão para notificações do sistema operacional (Desktop Push)
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        const playNotification = async () => {
            if (!audioRef.current) return;

            try {
                // Recarrega o áudio para garantir que toque novamente se já foi tocado
                audioRef.current.currentTime = 0;
                audioRef.current.loop = true; // Repetir o som do telefone

                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    await playPromise;
                }

                // Parar após 3 segundos
                setTimeout(() => {
                    if (audioRef.current) {
                        audioRef.current.pause();
                        audioRef.current.loop = false;
                        audioRef.current.currentTime = 0;
                    }
                }, 3000);
            } catch (err) {
                console.warn("Audio playback failed (browser auto-play policy):", err);
            }
        };

        const triggerSystemNotification = (orderNumber: number) => {
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification(`🔔 Novo Pedido #${orderNumber}!`, {
                    body: "Um novo pedido acabou de chegar na sua loja.",
                    icon: "/logo-icon.png",
                    requireInteraction: true // Mantém a notificação na tela até clicar
                });
            }
        };

        const channel = supabase
            .channel(`order-notifications-${storeId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
                (payload: any) => {
                    playNotification();
                    triggerSystemNotification(payload.new.order_number);
                    toast.info(`🔔 Novo pedido #${payload.new.order_number}!`, {
                        duration: 10000,
                        description: "Toque para ver os detalhes.",
                    });
                }
            )
            .subscribe();

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
            supabase.removeChannel(channel);
        };
    }, [storeId, audioNotificationsEnabled]);
};
