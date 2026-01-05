import GlowBackground from '@/components/GlowBackground';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import WhenToUse from '@/components/WhenToUse';
import HumanWorkflow from '@/components/HumanWorkflow';
import RealExample from '@/components/RealExample';
import FeatureGrid from '@/components/FeatureGrid';
import CLISection from '@/components/CLISection';
import CISection from '@/components/CISection';
import Footer from '@/components/Footer';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <GlowBackground />
      <Navbar />
      <Hero />
      <HowItWorks />
      <WhenToUse />
      <CISection />
      <RealExample />
      <HumanWorkflow />
      <FeatureGrid />
      <CLISection />
      <Footer />
    </main>
  );
}
