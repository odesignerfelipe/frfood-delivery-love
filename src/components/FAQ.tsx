import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Preciso ter conhecimento técnico para usar a plataforma?",
    a: "Não! A FRFood foi pensada para ser simples. Você configura seu catálogo em minutos e começa a receber pedidos pelo WhatsApp.",
  },
  {
    q: "Existe taxa por pedido?",
    a: "Absolutamente não. Você paga apenas a mensalidade fixa e recebe pedidos ilimitados sem nenhuma taxa adicional.",
  },
  {
    q: "Como funciona a integração com WhatsApp?",
    a: "Quando seu cliente finaliza o pedido no catálogo, ele é enviado automaticamente para o WhatsApp do seu restaurante com todos os detalhes.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim! Não há fidelidade. Você pode cancelar seu plano mensal quando quiser, sem multas ou taxas.",
  },
  {
    q: "Como configuro as taxas de entrega por bairro?",
    a: "No painel administrativo, você cadastra os bairros de atendimento e define o valor da taxa de entrega para cada um individualmente.",
  },
];

const FAQ = () => {
  return (
    <section id="faq" className="py-20 lg:py-28 bg-muted/50">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
            FAQ
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            Perguntas frequentes
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="bg-card rounded-xl border border-border/50 px-6 shadow-card"
            >
              <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQ;
