import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useOrderNotifications = (storeId: string | undefined, audioNotificationsEnabled: boolean = true) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!storeId || !audioNotificationsEnabled) return;

        // Pre-load audio
        // Using a more reliable "telephone ring" sound
        audioRef.current = new Audio("https://actions.google.com/sounds/v1/alarms/phone_ringing.ogg");

        const playNotification = async () => {
            if (!audioRef.current) return;

            try {
                audioRef.current.currentTime = 0;
                await audioRef.current.play();

                // Stop after 3 seconds
                setTimeout(() => {
                    if (audioRef.current) {
                        audioRef.current.pause();
                        audioRef.current.currentTime = 0;
                    }
                }, 3000);
            } catch (err) {
                console.warn("Audio playback failed:", err);
            }
        };

        const channel = supabase
            .channel(`order-notifications-${storeId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
                (payload: any) => {
                    playNotification();
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
