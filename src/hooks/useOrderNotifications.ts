import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useOrderNotifications = (storeId: string | undefined, audioNotificationsEnabled: boolean = true) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const playNotification = async () => {
        if (!audioRef.current) {
            audioRef.current = new Audio("https://www.myinstants.com/media/sounds/old-telephone-ring.mp3");
        }

        try {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.loop = true;

            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                await playPromise;
                setTimeout(() => {
                    if (audioRef.current) {
                        audioRef.current.pause();
                        audioRef.current.loop = false;
                        audioRef.current.currentTime = 0;
                    }
                }, 3000);
            }
        } catch (err) {
            console.warn("Audio playback failed:", err);
        }
    };

    const triggerSystemNotification = (orderNumber: string | number) => {
        if ("Notification" in window) {
            if (Notification.permission === "granted") {
                new Notification(`🔔 Novo Pedido #${orderNumber}!`, {
                    body: "Um novo pedido acabou de chegar na sua loja.",
                    icon: "/logo-icon.png",
                    requireInteraction: true,
                    silent: false,
                });
            } else if (Notification.permission === "default") {
                Notification.requestPermission();
            }
        }
    };

    useEffect(() => {
        if (!storeId) return;

        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        const channel = supabase
            .channel(`all-notifications-${storeId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
                (payload: any) => {
                    if (audioNotificationsEnabled) playNotification();
                    triggerSystemNotification(payload.new.order_number);
                    toast.info(`🔔 Novo pedido #${payload.new.order_number}!`, {
                        duration: 10000,
                        description: "Clique aqui para gerenciar.",
                        action: {
                            label: "Ver Pedido",
                            onClick: () => window.location.hash = "/dashboard/orders"
                        }
                    });
                }
            )
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "order_payments", filter: `store_id=eq.${storeId}` },
                (payload: any) => {
                    if (payload.new.status === 'pending' && (payload.new.payment_method === 'cartao_credito' || payload.new.payment_method === 'cartao_debito')) {
                        if (audioNotificationsEnabled) playNotification();
                        toast.warning(`💳 Pagamento no Caixa: R$ ${payload.new.amount.toFixed(2)}`, {
                            duration: 15000,
                            description: `O cliente está a caminho para pagar via ${payload.new.payment_method.replace('cartao_', '')}.`,
                        });
                    }
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

    return {
        testSound: playNotification,
        testNotification: () => triggerSystemNotification("TESTE"),
        requestPermission: () => Notification.requestPermission()
    };
};
