"use client";
import { useState, useCallback } from "react";
import { useAccount, useBalance } from "wagmi";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: {
    type: "send" | "receive" | "swap";
    data?: Record<string, string>;
  };
}

export const useNovaAI = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { address, isConnected, chainId } = useAccount();
  const { data: balanceData } = useBalance({
    address: address,
  });

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Prepare context for the AI
      const walletContext = {
        address: address,
        chainId: chainId,
        isConnected: isConnected,
        balance: balanceData?.formatted,
      };

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          walletContext
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch response");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        // Map transaction preview to action if available
        action: data.transactionPreview ? {
          type: "send",
          data: {
            amount: data.transactionPreview.preview.amount.toString(),
            token: data.transactionPreview.preview.tokenSymbol,
            recipient: data.transactionPreview.preview.toAddress,
          }
        } : undefined
      };

      setMessages((prev) => [...prev, assistantMessage]);
      return assistantMessage;

    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Maaf, terjadi kesalahan saat memproses pesan kamu. Silakan coba lagi.",
      };
      setMessages((prev) => [...prev, errorMessage]);
      return errorMessage;
    } finally {
      setIsLoading(false);
    }
  }, [messages, address, isConnected, chainId, balanceData]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  };
};
