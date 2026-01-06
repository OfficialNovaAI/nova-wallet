import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0014] text-white overflow-hidden relative">
      {/* Gradient Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top purple glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-purple-600/20 rounded-full blur-[120px]" />
        {/* Middle pink/purple glow */}
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-gradient-to-b from-purple-500/15 via-fuchsia-500/10 to-transparent rounded-full blur-[150px]" />
        {/* Bottom subtle glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-400/10 rounded-full blur-[100px]" />
      </div>
      <Navbar />
      <Hero />
      <Features />
      <Footer />
    </div>
  );
}
