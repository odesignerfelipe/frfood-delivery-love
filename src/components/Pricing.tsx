import { Button } from "@/components/ui/button";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const allFeatures = [
  "Site e Catálogo Online",
  "Visitantes Ilimitados",
  "Pedidos Ilimitados",
  "Produtos Ilimitados",
  "Variação de Produtos",
  "Opções de Entrega",
  "Integração com WhatsApp",
  "Cadastrar Cupons de Desconto",
  "Painel com relatórios de pedidos",
  "Taxas de entregas por bairro",
  "Suporte diário pelo WhatsApp",
];

const plans = [
  {
    name: "Mensal",
    price: "149",
    cents: "90",
    period: "/mês",
    description: "Ideal para testar e começar a vender online",
    highlight: false,
    cta: "Começar agora",
  },
  {
    name: "Anual",
    price: "124",
    cents: "90",
    period: "/mês",
    description: "Economize mais de R$ 300 por ano",
    highlight: true,
    cta: "Assinar plano anual",
    badge: "Mais popular",
    installment: "12x de",
  },
];

const Pricing = () => {
  return (
    <section id="precos" className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
            Preços
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            Planos simples e transparentes
          </h2>
          <p className="text-muted-foreground text-lg">
            Todos os recursos inclusos em qualquer plano. Sem taxa por pedido.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative rounded-2xl p-8 transition-all duration-300",
                plan.highlight
                  ? "gradient-hero text-primary-foreground shadow-hero scale-[1.02]"
                  : "bg-card border border-border shadow-card hover:shadow-card-hover"
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-foreground px-4 py-1 text-xs font-bold text-background">
                  <Star className="w-3 h-3" />
                  {plan.badge}
                </div>
              )}

              <h3
                className={cn(
                  "text-xl font-bold mb-2",
                  plan.highlight ? "text-primary-foreground" : "text-foreground"
                )}
              >
                {plan.name}
              </h3>
              <p
                className={cn(
                  "text-sm mb-6",
                  plan.highlight
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground"
                )}
              >
                {plan.description}
              </p>

              <div className="mb-8">
                {plan.installment && (
                  <p
                    className={cn(
                      "text-sm mb-1",
                      plan.highlight
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    )}
                  >
                    {plan.installment}
                  </p>
                )}
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      plan.highlight
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    )}
                  >
                    R$
                  </span>
                  <span
                    className={cn(
                      "text-5xl font-extrabold",
                      plan.highlight
                        ? "text-primary-foreground"
                        : "text-foreground"
                    )}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={cn(
                      "text-xl font-bold",
                      plan.highlight
                        ? "text-primary-foreground"
                        : "text-foreground"
                    )}
                  >
                    ,{plan.cents}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      plan.highlight
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    )}
                  >
                    {plan.period}
                  </span>
                </div>
              </div>

              <Button
                variant={plan.highlight ? "heroInverted" : "hero"}
                size="lg"
                className="w-full mb-8"
              >
                {plan.cta}
              </Button>

              <ul className="space-y-3">
                {allFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                        plan.highlight
                          ? "bg-primary-foreground/20"
                          : "bg-secondary"
                      )}
                    >
                      <Check
                        className={cn(
                          "w-3 h-3",
                          plan.highlight
                            ? "text-primary-foreground"
                            : "text-primary"
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-sm",
                        plan.highlight
                          ? "text-primary-foreground/90"
                          : "text-muted-foreground"
                      )}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
