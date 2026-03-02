import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const CTA = () => {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="gradient-hero rounded-3xl p-12 md:p-16 text-center shadow-hero">
          <h2 className="text-3xl md:text-4xl font-extrabold text-primary-foreground mb-4">
            Pronto para vender mais?
          </h2>
          <p className="text-primary-foreground/80 text-lg max-w-xl mx-auto mb-8">
            Comece agora e tenha seu delivery online funcionando em minutos.
            Sem taxa por pedido, sem complicação.
          </p>
          <Button variant="heroInverted" size="lg" className="group" asChild>
            <Link to="/checkout">
              Criar minha loja agora
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTA;
