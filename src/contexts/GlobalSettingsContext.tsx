import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type GlobalThemeSettings = {
    primaryColor: string;
    logoUrl: string;
};

type GlobalSettingsContextType = {
    settings: GlobalThemeSettings;
    loading: boolean;
};

const defaultSettings: GlobalThemeSettings = {
    primaryColor: "#ea384c", // Default FRFood primary
    logoUrl: "/logo-icon.png",   // Default FRFood logo (now transparent via mix-blend)
};

const GlobalSettingsContext = createContext<GlobalSettingsContextType>({
    settings: defaultSettings,
    loading: true,
});

export const useGlobalSettings = () => useContext(GlobalSettingsContext);

export const GlobalSettingsProvider = ({ children }: { children: React.ReactNode }) => {
    const [settings, setSettings] = useState<GlobalThemeSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const { data, error } = await supabase
                    .from("platform_settings")
                    .select("value")
                    .eq("key", "global_theme")
                    .maybeSingle();

                if (error) {
                    console.error("Error loading global settings:", error);
                    return;
                }

                if (data && data.value) {
                    const val = data.value as any;
                    const newSettings = {
                        primaryColor: val.primaryColor || defaultSettings.primaryColor,
                        logoUrl: val.logoUrl || defaultSettings.logoUrl,
                    };

                    setSettings(newSettings);
                    applyCssVariables(newSettings);
                }
            } catch (err) {
                console.error("Failed to load global settings", err);
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, []);

    const applyCssVariables = (settings: GlobalThemeSettings) => {
        // Generate HSL values from Hex for Tailwind's convention
        const hexToHSL = (hex: string) => {
            let r = 0, g = 0, b = 0;
            if (hex.length === 4) {
                r = parseInt(hex[1] + hex[1], 16);
                g = parseInt(hex[2] + hex[2], 16);
                b = parseInt(hex[3] + hex[3], 16);
            } else if (hex.length === 7) {
                r = parseInt(hex[1] + hex[2], 16);
                g = parseInt(hex[3] + hex[4], 16);
                b = parseInt(hex[5] + hex[6], 16);
            }
            r /= 255;
            g /= 255;
            b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h = 0, s = 0, l = (max + min) / 2;
            if (max !== min) {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }
            return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
        };

        if (settings.primaryColor && settings.primaryColor.startsWith('#')) {
            const hsl = hexToHSL(settings.primaryColor);
            document.documentElement.style.setProperty('--primary', hsl);
        }
    };

    return (
        <GlobalSettingsContext.Provider value={{ settings, loading }}>
            <div data-global-theme-provider>
                {/* 
              Inject a style tag globally if needed, although CSS vars is usually enough. 
              Only using CSS vars on documentElement is cleaner.
            */}
            </div>
            {children}
        </GlobalSettingsContext.Provider>
    );
};
