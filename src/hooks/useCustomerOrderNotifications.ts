import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useCustomerOrderNotifications = (orderId: string | undefined, currentStatus: string | undefined) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!orderId) return;

        audioRef.current = new Audio("https://www.myinstants.com/media/sounds/message-tone-1.mp3"); // Short crisp notification sound

        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        const channel = supabase
            .channel(`customer-order-${orderId}`)
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
                (payload: any) => {
                    const newStatus = payload.new.status;

                    // Only trigger notification when status changes specifically to ready_for_pickup
                    if (newStatus === "ready_for_pickup" && currentStatus !== "ready_for_pickup") {
                        playAlertSound();

                        // Show Desktop Notification
                        if ("Notification" in window && Notification.permission === "granted") {
                            new Notification("Opa! Seu pedido está pronto! 🛍️", {
                                body: "Passe aqui no local e faça a retirada do seu pedido.",
                                icon: "/logo-icon.png"
                            });
                        }

                        // In-app visual notification
                        toast.success("Seu pedido está pronto para retirada!", {
                            duration: 5000,
                            description: "Já pode vir buscar seu lanche.",
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
    }, [orderId, currentStatus]);

    const playAlertSound = async () => {
        if (!audioRef.current) return;
        try {
            audioRef.current.currentTime = 0;
            audioRef.current.loop = true;

            // Unmute and Play (Most modern browsers require user interaction first though)
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                await playPromise;
            }

            // Stop exactly after 2 seconds
            setTimeout(() => {
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.loop = false;
                    audioRef.current.currentTime = 0;
                }
            }, 2000);

        } catch (err) {
            console.warn("Client audio playback blocked:", err);
        }
    };
};
