"use client";

import { PanelLeftClose, PanelLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount, useDisconnect } from "wagmi";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const ChatHeader = ({ sidebarOpen, onToggleSidebar }: ChatHeaderProps) => {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="h-[72px] flex items-center justify-between px-6 bg-background/50 backdrop-blur-sm border-b border-border/40 sticky top-0 z-10 w-full">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="rounded-xl hover:bg-muted text-muted-foreground"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <PanelLeft className="w-5 h-5" />
          )}
        </Button>

        <div className="flex items-center gap-3">
          <Image
            src="/nova-logo.webp"
            alt="Nova AI"
            width={180}
            height={60}
            className="h-18 w-auto object-contain"
            priority
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Wallet Address */}
        {address ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-10 px-5 rounded-xl bg-[#6366f1] hover:bg-[#5558dd] text-white font-medium shadow-lg shadow-indigo-500/30 border-0 transition-all ease-out hover:scale-105 active:scale-95">
                <span className="mr-2 text-white font-normal">{truncateAddress(address)}</span>
                <ChevronDown className="w-4 h-4 text-white/80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mt-2 rounded-2xl border border-gray-100 bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] p-2">
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(address)}
                className="cursor-pointer rounded-xl px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors bg-white focus:bg-gray-50 focus:text-gray-900"
              >
                Copy Address
              </DropdownMenuItem>
              <div className="h-px bg-gray-50 my-1 mx-2" />
              <DropdownMenuItem
                onClick={() => disconnect()}
                className="text-red-500 focus:text-red-600 cursor-pointer rounded-xl px-4 py-2.5 hover:bg-red-50 transition-colors bg-white focus:bg-red-50"
              >
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="outline" className="rounded-full">Connect Wallet</Button>
        )}
      </div>
    </header>
  );
};
