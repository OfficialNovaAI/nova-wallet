"use client";

import { Send, Download, ArrowLeftRight, Link, Wallet, Zap, BrainCircuit, HandCoins } from "lucide-react";
import Image from "next/image";

interface WelcomeScreenProps {
  onActionClick: (action: "send" | "receive" | "swap" | "paylink" | "portfolio" | "search" | "slippage") => void;
}

export const WelcomeScreen = ({ onActionClick }: WelcomeScreenProps) => {
  const actions = [
    {
      id: "receive" as const,
      icon: Download,
      title: "Receive",
      description: "Get your wallet address to receive crypto",
      // Pink/Rose Theme - Soft pastel bg, vibrant text/icon
      bgClass: "bg-gradient-to-br from-pink-50 via-white to-rose-50 border-pink-100/50",
      iconBg: "bg-gradient-to-br from-pink-400 to-rose-500",
      titleGradient: "from-pink-500 to-rose-500",
      descriptionColor: "text-slate-600",
      glowColor: "bg-pink-500/5",
      sparkleColor: "text-pink-400"
    },
    {
      id: "send" as const,
      icon: Send,
      title: "Send",
      description: "Transfer your assets to another wallet",
      // Amber/Orange Theme
      bgClass: "bg-gradient-to-br from-amber-50 via-white to-orange-50 border-amber-100/50",
      iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
      titleGradient: "from-amber-500 to-orange-500",
      descriptionColor: "text-slate-600",
      glowColor: "bg-amber-500/5",
      sparkleColor: "text-amber-400"
    },
    {
      id: "portfolio" as const,
      icon: Wallet,
      title: "Check Portfolio",
      description: "View all your assets across wallets and networks",
      // Indigo/Purple Theme
      bgClass: "bg-gradient-to-br from-indigo-50 via-white to-purple-50 border-indigo-100/50",
      iconBg: "bg-gradient-to-br from-indigo-400 to-purple-500",
      titleGradient: "from-indigo-500 to-purple-600",
      descriptionColor: "text-slate-600",
      glowColor: "bg-purple-500/5",
      sparkleColor: "text-indigo-400"
    },
    {
      id: "paylink" as const,
      icon: HandCoins,
      title: "Paylink",
      description: "Create a payment link for anyone to pay you",
      // Cyan/Emerald/Yellow Mix (from image reference: Paylink text is golden/yellow, Icon is Cyan)
      bgClass: "bg-gradient-to-br from-cyan-50 via-white to-emerald-50 border-cyan-100/50",
      iconBg: "bg-gradient-to-br from-cyan-400 to-emerald-400",
      titleGradient: "from-amber-400 to-orange-500", // "Paylink" text is often gold in the design
      descriptionColor: "text-slate-600",
      glowColor: "bg-cyan-500/5",
      sparkleColor: "text-cyan-400"
    },
    {
      id: "search" as const,
      icon: Link,
      title: "Onchain Search",
      description: "Understand on-chain activity instantly",
      // Violet/Fuchsia Theme
      bgClass: "bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 border-violet-100/50",
      iconBg: "bg-gradient-to-br from-violet-400 to-fuchsia-500",
      titleGradient: "from-violet-500 to-fuchsia-500",
      descriptionColor: "text-slate-600",
      glowColor: "bg-violet-500/5",
      sparkleColor: "text-violet-400"
    },
    {
      id: "slippage" as const,
      icon: BrainCircuit,
      title: "Predict Slippage",
      description: "Know fees and slippage before you click confirm",
      // Blue/Sky Theme
      bgClass: "bg-gradient-to-br from-blue-50 via-white to-sky-50 border-blue-100/50",
      iconBg: "bg-gradient-to-br from-blue-400 to-sky-500",
      titleGradient: "from-blue-500 to-indigo-500", // Image has slight purple tint in title
      descriptionColor: "text-slate-600",
      glowColor: "bg-blue-500/5",
      sparkleColor: "text-blue-400"
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 overflow-y-auto">
      {/* Nova AI Logo */}
      <div className="mb-4 relative w-28 h-28 flex items-center justify-center">
        {/* <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full" /> */}
        <Image
          src="/blazz.webp"
          alt="Nova AI"
          width={100}
          height={100}
          className="w-full h-full object-contain drop-shadow-lg relative z-10"
          priority
        />
      </div>

      {/* Welcome Text */}
      <h1 className="text-xl font-semibold mb-1 text-slate-900">Welcome to Nova AI</h1>
      <p className="text-xs text-slate-500 mb-6 font-medium">
        Your AI companion for effortless crypto management
      </p>

      {/* Action Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl w-full">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onActionClick(action.id)}
            className={`
              relative p-3.5 rounded-2xl transition-all duration-300
              bg-white/40 hover:bg-white/80 backdrop-blur-sm
              ${action.bgClass.replace('border', '') /* Remove border from bgClass if present, but we will override */} 
              ${/* Override specific bg classes for a cleaner look */ ''}
              hover:shadow-md hover:-translate-y-0.5
              text-left group overflow-hidden
              ring-1 ring-white/50
            `}
          >
            {/* Background Gradient Mesh - Re-implemented for softness */}
            <div className={`absolute inset-0 opacity-30 ${action.bgClass} mix-blend-multiply`} />

            {/* Soft Glow Blob in top right */}
            <div className={`absolute -top-6 -right-6 w-24 h-24 blur-2xl rounded-full opacity-30 ${action.glowColor}`} />

            {/* Sparkles Decoration */}
            <div className="absolute top-3 right-3 opacity-40">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${action.sparkleColor} opacity-70`}>
                <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="currentColor" />
              </svg>
            </div>

            {/* Icon Container */}
            <div className={`w-9 h-9 ${action.iconBg} rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition-transform duration-300`}>
              <action.icon className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>

            {/* Gradient Title */}
            <h3 className={`font-bold text-sm mb-1 bg-gradient-to-r ${action.titleGradient} bg-clip-text text-transparent`}>
              {action.title}
            </h3>

            {/* Description */}
            <p className={`text-[10px] ${action.descriptionColor} leading-relaxed font-medium line-clamp-2`}>
              {action.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};
