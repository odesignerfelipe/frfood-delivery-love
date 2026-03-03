import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  const [landingData, setLandingData] = useState<any>(null);

  useEffect(() => {
    const fetchLandingData = async () => {
      const { data, error } = await (supabase
        .from("platform_settings" as any) as any)
        .select("value")
        .eq("key", "landing_page")
        .single();

      if (!error && data) {
        setLandingData(data.value);
      }
    };
    fetchLandingData();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero
          title={landingData?.hero?.title}
          subtitle={landingData?.hero?.subtitle}
        />
        <Features
          customFeatures={landingData?.features}
        />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
