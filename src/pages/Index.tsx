import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalSettings } from "@/contexts/GlobalSettingsContext";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  const { settings } = useGlobalSettings();
  const [features, setFeatures] = useState<string[]>([]);

  useEffect(() => {
    const fetchFeatures = async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .limit(1)
        .maybeSingle();

      if (data && data.value) {
        setFeatures((data.value as any).features || []);
      }
    };
    fetchFeatures();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero
          title={settings.heroTitle}
          subtitle={settings.heroSubtitle}
          buttonText={settings.heroButtonText}
          imageUrl={settings.heroImageUrl}
          bgType={settings.heroBgType}
          bgColor={settings.heroBgColor}
        />
        <Features
          customFeatures={features.length > 0 ? features : undefined}
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
