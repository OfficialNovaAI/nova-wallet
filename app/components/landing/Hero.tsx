"use client";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        {/* Purple glow orbs */}
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-violet-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />

        {/* Diagonal purple beam */}
        <div className="absolute top-0 right-0 w-full h-full overflow-hidden">
          <div
            className="absolute -top-20 right-0 w-[600px] h-[800px] bg-gradient-to-b from-purple-600/40 via-purple-700/20 to-transparent"
            style={{
              transform: 'rotate(-15deg) translateX(200px)',
              borderRadius: '0 0 100% 100%'
            }}
          />
        </div>
      </div>

      {/* Hero Decoration Image */}
      <div className="absolute right-0 top-52 hidden lg:block">
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative w-[600px] h-[400px]"
        >
          <Image
            src="/hero-decoration.png"
            alt="Hero Decoration"
            fill
            className="object-contain object-right-top"
            priority
          />
        </motion.div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl">
          {/* Main Heading with special typography */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-8"
          >
            <span className="block text-5xl md:text-[70px] font-normal text-white/90 mb-2" style={{ fontFamily: 'var(--font-bruno-ace)', lineHeight: '100%', letterSpacing: '-0.02em' }}>
              AI-POWERED
            </span>
            <span className="block text-5xl md:text-[70px] font-normal text-white/90 flex items-center gap-3" style={{ fontFamily: 'var(--font-bruno-ace)', lineHeight: '100%', letterSpacing: '-0.02em' }}>
              CRYPTO
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/30">
                <Zap className="w-8 h-8 text-white" />
              </span>
            </span>
            <span className="block text-5xl md:text-[70px] font-normal text-white/90" style={{ fontFamily: 'var(--font-bruno-ace)', lineHeight: '100%', letterSpacing: '-0.02em' }}>
              SUPERWALLET
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg md:text-xl text-white/60 mb-10 max-w-xl leading-relaxed"
          >
            Nova is an AI-powered chat interface that lets you send, swap, and explore crypto using natural language on top of your existing wallet
          </motion.p>
        </div>
      </div>
    </section>
  );
};
