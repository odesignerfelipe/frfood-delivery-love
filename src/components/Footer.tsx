import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";

const Footer = () => {
  const { settings } = useGlobalSettings();
  const name = settings.siteName || "FRFood";

  return (
    <footer className="bg-foreground py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={name} className="h-8 w-auto object-contain" />
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg gradient-hero flex items-center justify-center">
                  <span className="text-primary-foreground font-extrabold text-sm">FR</span>
                </div>
                <span className="text-xl font-extrabold text-background">
                  FR<span className="text-primary">Food</span>
                </span>
              </>
            )}
          </div>

          <p className="text-sm text-background/60">
            {settings.footerText || `© ${new Date().getFullYear()} ${name}. Todos os direitos reservados.`}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
