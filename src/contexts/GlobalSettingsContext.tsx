import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type HeroStat = { value: string; label: string };
type FaqItem = { q: string; a: string };

type GlobalThemeSettings = {
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string;
    faviconUrl: string;
    siteName: string;
    navbarButtonText: string;
    // Hero
    heroTitle: string;
    heroSubtitle: string;
    heroButtonText: string;
    heroImageUrl: string;
    heroBgType: string;
    heroBgColor: string;
    heroBadgeText: string;
    heroStats: HeroStat[];
    // Pricing
    pricingTitle: string;
    pricingSubtitle: string;
    monthlyPrice: string;
    yearlyPrice: string;
    // CTA
    ctaTitle: string;
    ctaSubtitle: string;
    ctaButtonText: string;
    // FAQ
    faqItems: FaqItem[];
    // Footer
    footerText: string;
    // Features
    features: string[];
};

type GlobalSettingsContextType = {
    settings: GlobalThemeSettings;
    loading: boolean;
};

const defaultSettings: GlobalThemeSettings = {
    primaryColor: "#ea384c",
    secondaryColor: "#f97316",
    logoUrl: "/logo-icon.png",
    faviconUrl: "",
    siteName: "FRFood",
    navbarButtonText: "Criar conta",
    heroTitle: "O melhor sistema para o seu Delivery",
    heroSubtitle: "Receba pedidos ilimitados direto no seu WhatsApp. Sem comissões, sem taxas ocultas.",
    heroButtonText: "Começar agora",
    heroImageUrl: "",
    heroBgType: "gradient",
    heroBgColor: "from-orange-500 to-orange-600",
    heroBadgeText: "Plataforma completa de delivery",
    heroStats: [
        { value: "5.000+", label: "Restaurantes" },
        { value: "1M+", label: "Pedidos/mês" },
        { value: "0%", label: "Taxa por pedido" },
    ],
    pricingTitle: "Planos simples e transparentes",
    pricingSubtitle: "Todos os recursos inclusos em qualquer plano. Sem taxa por pedido.",
    monthlyPrice: "149,90",
    yearlyPrice: "124,90",
    ctaTitle: "Pronto para vender mais?",
    ctaSubtitle: "Comece agora e tenha seu delivery online funcionando em minutos. Sem taxa por pedido, sem complicação.",
    ctaButtonText: "Criar minha loja agora",
    faqItems: [
        { q: "Preciso ter conhecimento técnico para usar a plataforma?", a: "Não! A FRFood foi pensada para ser simples. Você configura seu catálogo em minutos e começa a receber pedidos pelo WhatsApp." },
        { q: "Existe taxa por pedido?", a: "Absolutamente não. Você paga apenas a mensalidade fixa e recebe pedidos ilimitados sem nenhuma taxa adicional." },
        { q: "Como funciona a integração com WhatsApp?", a: "Quando seu cliente finaliza o pedido no catálogo, ele é enviado automaticamente para o WhatsApp do seu restaurante com todos os detalhes." },
        { q: "Posso cancelar a qualquer momento?", a: "Sim! Não há fidelidade. Você pode cancelar seu plano mensal quando quiser, sem multas ou taxas." },
        { q: "Como configuro as taxas de entrega por bairro?", a: "No painel administrativo, você cadastra os bairros de atendimento e define o valor da taxa de entrega para cada um individualmente." },
    ],
    footerText: "",
    features: [],
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
                    .select("*")
                    .limit(1)
                    .maybeSingle();

                if (error) {
                    console.error("Error loading global settings:", error);
                    return;
                }

                if (data) {
                    const row = data as any;
                    const val = row.value || {};
                    const newSettings: GlobalThemeSettings = {
                        primaryColor: row.primary_color || val.primaryColor || defaultSettings.primaryColor,
                        secondaryColor: val.secondaryColor || row.secondary_color || defaultSettings.secondaryColor,
                        logoUrl: row.logo_url || val.logoUrl || defaultSettings.logoUrl,
                        faviconUrl: val.faviconUrl || row.favicon_url || defaultSettings.faviconUrl,
                        siteName: val.siteName || row.site_name || defaultSettings.siteName,
                        navbarButtonText: val.navbarButtonText || row.navbar_button_text || defaultSettings.navbarButtonText,
                        heroTitle: val.heroTitle || row.hero_title || defaultSettings.heroTitle,
                        heroSubtitle: val.heroSubtitle || row.hero_subtitle || defaultSettings.heroSubtitle,
                        heroButtonText: val.heroButtonText || row.hero_button_text || defaultSettings.heroButtonText,
                        heroImageUrl: val.heroImageUrl || row.hero_image_url || defaultSettings.heroImageUrl,
                        heroBgType: val.heroBgType || row.hero_bg_type || defaultSettings.heroBgType,
                        heroBgColor: val.heroBgColor || row.hero_bg_color || defaultSettings.heroBgColor,
                        heroBadgeText: val.heroBadgeText || row.hero_badge_text || defaultSettings.heroBadgeText,
                        heroStats: val.heroStats || row.hero_stats || defaultSettings.heroStats,
                        pricingTitle: val.pricingTitle || row.pricing_title || defaultSettings.pricingTitle,
                        pricingSubtitle: val.pricingSubtitle || row.pricing_subtitle || defaultSettings.pricingSubtitle,
                        monthlyPrice: val.monthlyPrice || row.monthly_price || defaultSettings.monthlyPrice,
                        yearlyPrice: val.yearlyPrice || row.yearly_price || defaultSettings.yearlyPrice,
                        ctaTitle: val.ctaTitle || row.cta_title || defaultSettings.ctaTitle,
                        ctaSubtitle: val.ctaSubtitle || row.cta_subtitle || defaultSettings.ctaSubtitle,
                        ctaButtonText: val.ctaButtonText || row.cta_button_text || defaultSettings.ctaButtonText,
                        faqItems: val.faqItems || row.faq_items || defaultSettings.faqItems,
                        footerText: val.footerText || row.footer_text || defaultSettings.footerText,
                        features: val.features || row.features || defaultSettings.features,
                    };

                    setSettings(newSettings);
                    applyCssVariables(newSettings);
                    applyMetaTags(newSettings);
                }
            } catch (err) {
                console.error("Failed to load global settings", err);
            } finally {
                setLoading(false);
            }
        };

        loadSettings();
    }, []);

    const applyMetaTags = (s: GlobalThemeSettings) => {
        // Favicon
        if (s.faviconUrl) {
            let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = s.faviconUrl;
        }
        // Title
        if (s.siteName) {
            document.title = s.siteName;
        }
    };

    const applyCssVariables = (settings: GlobalThemeSettings) => {
        const isPublicPage = ["/", "/checkout", "/demo", "/auth"].includes(window.location.pathname);
        if (!isPublicPage) return;

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
            r /= 255; g /= 255; b /= 255;
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
            {children}
        </GlobalSettingsContext.Provider>
    );
};
