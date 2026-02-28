import { Button } from "@/components/ui/button";
import { ArrowRight, Smartphone } from "lucide-react";
import heroImage from "@/assets/hero-image.png";

const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full gradient-hero blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full gradient-warm blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground">
              <Smartphone className="w-4 h-4" />
              Plataforma completa de delivery
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-foreground">
              Seu delivery online{" "}
              <span className="text-primary">pronto em minutos</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              Crie seu catálogo digital, receba pedidos pelo WhatsApp e gerencie
              tudo em um único painel. Sem complicação, sem taxa por pedido.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="lg" className="group">
                Começar agora
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="outline" size="lg">
                Ver demonstração
              </Button>
            </div>

            <div className="flex items-center gap-8 pt-4">
              <div>
                <p className="text-2xl font-bold text-foreground">5.000+</p>
                <p className="text-sm text-muted-foreground">Restaurantes</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div>
                <p className="text-2xl font-bold text-foreground">1M+</p>
                <p className="text-sm text-muted-foreground">Pedidos/mês</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div>
                <p className="text-2xl font-bold text-foreground">0%</p>
                <p className="text-sm text-muted-foreground">Taxa por pedido</p>
              </div>
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl gradient-hero opacity-20 blur-2xl" />
              <img
                src={heroImage}
                alt="FRFood - Plataforma de delivery com cardápio digital e gestão de pedidos"
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
