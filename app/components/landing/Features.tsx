"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

const featureCards = [
  {
    title: "From Blue Chips to Long Tails",
    description: "See and act on your assets across wallets and chains in one place",
    image: "/card-assets/from-blue-chip-to-long-tails.png",
  },
  {
    title: "AI-native Execution",
    description: "Nova powers the moment your words become on-chain reality",
    image: "/card-assets/ai-native-execution.png",
  },
  {
    title: "No menus. No manual steps.",
    description: "Express what you want to do. Nova prepares everything else in seconds",
    image: "/card-assets/no-menus-no-manual-step.png",
  },
  {
    title: "One link. Any payment method.",
    description: "Create a single payment link that adapts to how the payer wants to pay",
    image: "/card-assets/one-link-any-payment-method.png",
  },
  {
    title: "Address Intelligence",
    description: "Known contracts, fresh wallets, and risky patterns detected automatically",
    image: "/card-assets/address-intelegent.png",
  },
  {
    title: "One intent. Multiple actions.",
    description: "Send, swap, receive, and pay — all triggered through natural language",
    image: "/card-assets/one-intent-multiple-actions.png",
  },
];

export const Features = () => {
  return (
    <section id="features" className="py-24 relative">
      {/* Info Card */}
      <div className="container mx-auto px-6 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl get-to-know-nova-wallet-more p-8 md:p-12 card"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

          <div className="relative z-10 max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Get to Know Nova Wallet More
            </h2>
            <p className="text-white/70 mb-6 leading-relaxed">
              Nova is an AI-native interface designed to simplify how humans interact with blockchains. Instead of navigating complex wallet menus or block explorers, users express intent through conversation while Nova handles analysis, context, and execution across connected wallets.
            </p>
            <Link href="/chat">
              <Button className="nova-gradient rounded-full text-white gap-2 cursor-pointer navbar">
                <Zap className="w-4 h-4" />
                Get Started
              </Button>
            </Link>
          </div>

          {/* Floating icons image on the right */}
          <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:block">
            <div className="relative w-[280px] h-[200px]">
              <Image
                src="/get-to-know-nova-wallet-more.png"
                alt="Nova Wallet Features"
                fill
                className="object-contain"
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Feature Grid */}
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureCards.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative overflow-hidden rounded-2xl bg-[#0d0d0d] flex flex-col h-[340px] card"
            >
              {/* Image Container */}
              <div className="relative w-full flex-1 p-6 flex items-center justify-center">
                <div className="relative w-full h-full">
                  <Image
                    src={feature.image}
                    alt={feature.title}
                    fill
                    className="object-contain"
                  />
                </div>
              </div>

              {/* Text Content */}
              <div className="p-5 pt-0">
                <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-6 mt-24">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Let Nova Handle Complexity Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex-1 max-w-md"
          >
            <div className="relative w-full h-[400px]">
              <Image
                src="/let-nova-handle-the-complexity.png"
                alt="Let Nova Handle the Complexity"
                fill
                className="object-contain"
              />
            </div>
          </motion.div>

          {/* CTA Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex-1"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Let Nova Handle the Complexity
            </h2>
            <p className="text-white/60 text-lg mb-8">
              Your wallet. Your intent. One conversation
            </p>
            <Link href="/chat">
              <Button size="lg" className="nova-gradient rounded-full text-white gap-2 px-8 cursor-pointer navbar">
                <Zap className="w-5 h-5" />
                Get Started
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
