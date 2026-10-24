import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { Trust } from "@/components/site/Trust";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Features } from "@/components/site/Features";
import { Impact } from "@/components/site/Impact";
import { CTA } from "@/components/site/CTA";
import { Footer } from "@/components/site/Footer";
import { useReveal } from "@/hooks/use-reveal";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Ponto Mpate — Community funeral support, reimagined" },
      {
        name: "description",
        content:
          "South Africa's modern ward-based funeral support platform. Transparent contributions, instant family support, built for ubuntu at scale.",
      },
      { property: "og:title", content: "Ponto Mpate — Community funeral support" },
      {
        property: "og:description",
        content:
          "Transparent, ward-based funeral support for South African communities. Join 12,000+ families standing together.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

function Index() {
  useReveal();
  return (
    <main className="bg-cream text-foreground">
      <Navbar />
      <Hero />
      <Trust />
      <HowItWorks />
      <Features />
      <Impact />
      <CTA />
      <Footer />
    </main>
  );
}
