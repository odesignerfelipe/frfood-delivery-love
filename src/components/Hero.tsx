import { Button } from "@/components/ui/button";
import { ArrowRight, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import heroImage from "@/assets/hero-image.png";

const Hero = () => {
  const { settings } = useGlobalSettings();

  return (
    <section className={`relative overflow-hidden bg-background ${settings.heroBgType === 'solid' && settings.heroBgColor ? settings.heroBgColor : ''}`}>
      {settings.heroBgType === 'gradient' && (
        <div className="absolute inset-0 opacity-5">
          <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl ${settings.heroBgColor || 'gradient-hero'}`} />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full gradient-warm blur-3xl" />
        </div>
      )}

      <div className="container relative mx-auto px-4 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground">
              <Smartphone className="w-4 h-4" />
              {settings.heroBadgeText || "Plataforma completa de delivery"}
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-foreground">
              {settings.heroTitle || (
                <>
                  Seu delivery online{" "}
                  <span className="text-primary">pronto em minutos</span>
                </>
              )}
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              {settings.heroSubtitle || "Crie seu catálogo digital, receba pedidos pelo WhatsApp e gerencie tudo em um único painel. Sem complicação, sem taxa por pedido."}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="lg" className="group" asChild>
                <Link to="/auth">
                  {settings.heroButtonText || "Começar agora"}
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/demo">Ver demonstração</Link>
              </Button>
            </div>

            <div className="flex items-center gap-8 pt-4">
              {(settings.heroStats || []).map((stat, i) => (
                <div key={i} className="flex items-center gap-8">
                  {i > 0 && <div className="w-px h-10 bg-border -ml-8 mr-0" />}
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="relative">
              {settings.heroBgType === 'gradient' && (
                <div className={`absolute -inset-4 rounded-3xl opacity-20 blur-2xl ${settings.heroBgColor || 'gradient-hero'}`} />
              )}
              <img
                src={settings.heroImageUrl || heroImage}
                alt={`${settings.siteName || 'FRFood'} - Plataforma de delivery`}
                className="relative w-full max-w-md rounded-3xl shadow-hero"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
