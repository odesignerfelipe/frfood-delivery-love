import {
  Globe,
  Users,
  ShoppingBag,
  Layers,
  Truck,
  MessageCircle,
  Tag,
  BarChart3,
  MapPin,
  Headphones,
  Infinity,
  Package,
} from "lucide-react";

const features = [
  { icon: Globe, title: "Site e Catálogo Online", description: "Catálogo digital profissional com sua marca e domínio próprio" },
  { icon: Users, title: "Visitantes Ilimitados", description: "Sem limite de acessos no seu cardápio digital" },
  { icon: Infinity, title: "Pedidos Ilimitados", description: "Receba quantos pedidos quiser, sem taxa por pedido" },
  { icon: Package, title: "Produtos Ilimitados", description: "Cadastre todos os itens do seu cardápio sem restrição" },
  { icon: Layers, title: "Variação de Produtos", description: "Tamanhos, sabores, adicionais e complementos" },
  { icon: Truck, title: "Opções de Entrega", description: "Delivery, retirada no local e consumo no estabelecimento" },
  { icon: MessageCircle, title: "Integração com WhatsApp", description: "Receba pedidos diretamente no WhatsApp do restaurante" },
  { icon: Tag, title: "Cupons de Desconto", description: "Crie cupons promocionais para fidelizar seus clientes" },
  { icon: BarChart3, title: "Painel com Relatórios", description: "Acompanhe vendas, pedidos e desempenho em tempo real" },
  { icon: MapPin, title: "Taxas por Bairro", description: "Configure taxas de entrega específicas para cada região" },
  { icon: Headphones, title: "Suporte Diário", description: "Atendimento todos os dias pelo WhatsApp" },
  { icon: ShoppingBag, title: "Gestão Completa", description: "Painel administrativo completo para gerenciar tudo" },
];

const Features = () => {
  return (
    <section id="funcionalidades" className="py-20 lg:py-28 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
            Funcionalidades
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            Tudo que seu delivery precisa
          </h2>
          <p className="text-muted-foreground text-lg">
            Uma plataforma completa para você vender mais e gerenciar seu
            negócio com facilidade.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group bg-card rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border border-border/50"
            >
              <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="font-bold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
