"use client";
import { useState, useCallback } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: {
    type: "send" | "receive" | "swap";
    data?: Record<string, string>;
  };
}

export interface TransactionFlow {
  type: "send" | "receive" | "swap";
  currentStep: "ready" | "pending" | "completed" | "failed";
  steps: Array<{
    step: string;
    label: string;
    status: "pending" | "active" | "completed" | "error";
    message?: string;
  }>;
  data: {
    amount?: string;
    token?: string;
    recipient?: string;
    fromToken?: string;
    toToken?: string;
  };
}

// Mock AI responses for wallet commands
const getAIResponse = (userMessage: string): { content: string; action?: Message["action"] } => {
  const lower = userMessage.toLowerCase();

  // Send command
  if (lower.includes("send") && (lower.includes("eth") || lower.includes("usdt") || lower.includes("usdc"))) {
    const amountMatch = lower.match(/(\d+\.?\d*)\s*(eth|usdt|usdc)/i);
    const addressMatch = lower.match(/0x[a-fA-F0-9]+/);

    return {
      content: `I'll help you send tokens. Here's the transaction preview:\n\nI'm preparing to send ${amountMatch?.[1] || "the amount"} ${amountMatch?.[2]?.toUpperCase() || "tokens"} to ${addressMatch?.[0] || "the recipient"}.\n\nPlease review and confirm the transaction details.`,
      action: {
        type: "send",
        data: {
          amount: amountMatch?.[1] || "",
          token: amountMatch?.[2]?.toUpperCase() || "ETH",
          recipient: addressMatch?.[0] || "",
        },
      },
    };
  }

  // Receive command
  if (lower.includes("receive") || lower.includes("address") || lower.includes("qr")) {
    const tokenMatch = lower.match(/(eth|usdt|usdc)/i);
    return {
      content: `Here's your address to receive ${tokenMatch?.[1]?.toUpperCase() || "tokens"} on Ethereum.\n\nYou can share the QR code or copy the address directly.`,
      action: {
        type: "receive",
        data: {
          token: tokenMatch?.[1]?.toUpperCase() || "ETH",
        },
      },
    };
  }

  // Swap command
  if (lower.includes("swap") || lower.includes("exchange") || lower.includes("convert")) {
    const pattern = /(\d+\.?\d*)\s*(eth|usdt|usdc)\s*(?:to|for)\s*(eth|usdt|usdc)/i;
    const match = lower.match(pattern);

    return {
      content: `Analyzing market conditions...\n\nLiquidity is good, slippage is low. Good time to execute!\n\nI'm preparing to swap ${match?.[1] || "your"} ${match?.[2]?.toUpperCase() || "tokens"} to ${match?.[3]?.toUpperCase() || "the target token"}.`,
      action: {
        type: "swap",
        data: {
          amount: match?.[1] || "",
          fromToken: match?.[2]?.toUpperCase() || "ETH",
          toToken: match?.[3]?.toUpperCase() || "USDT",
        },
      },
    };
  }

  // Balance command
  if (lower.includes("balance") || lower.includes("portfolio") || lower.includes("holdings")) {
    return {
      content: "Here's your current portfolio:\n\n• 0.5 ETH ($1,245.00)\n• 500 USDT ($500.00)\n• 250 USDC ($250.00)\n\n📊 Total Value: $1,995.00\n📈 24h Change: +$45.32 (+2.3%)",
    };
  }

  // Gas command
  if (lower.includes("gas") || lower.includes("fee")) {
    return {
      content: "Current gas prices on Ethereum:\n\n⚡ Fast: 25 gwei (~$2.50)\n🚗 Standard: 20 gwei (~$2.00)\n🐢 Slow: 15 gwei (~$1.50)\n\nGas prices are relatively low right now. Good time for transactions!",
    };
  }

  // Paylink command
  if (lower.includes("paylink") || lower.includes("payment link")) {
    return {
      content: "Great! I'll help you create a payment link.\n\nPayment links allow you to:\n• Request specific amounts\n• Share via QR code or URL\n• Track payment status\n• Set expiration dates\n\nLet me know the details: amount, token, and optional message!",
    };
  }

  // Default response
  return {
    content: "I'm Nova, your AI wallet assistant! I can help you with:\n\n• **Send tokens**: \"Send 0.1 ETH to 0x...\"\n• **Receive tokens**: \"Give me an address to receive ETH\"\n• **Swap tokens**: \"Swap 10 ETH to USDT\"\n• **Create paylink**: \"I want to create a paylink\"\n• **Check balance**: \"Show my portfolio\"\n• **Gas prices**: \"What's the gas fee?\"\n\nHow can I help you today?",
  };
};

export const useNovaAI = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate AI thinking time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = getAIResponse(content);
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: response.content,
      action: response.action,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsLoading(false);

    return assistantMessage;
  }, []);

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
