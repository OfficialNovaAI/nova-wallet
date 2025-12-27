"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { TokenSidebar } from "@/components/chat/TokenSidebar";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { TransactionCard } from "@/components/chat/TransactionCard";
import { useNovaAI } from "@/hooks/useNovaAI";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

export default function ChatPage() {
    const { isConnected, address } = useAccount();
    const { openConnectModal } = useConnectModal();
    const { messages, isLoading, sendMessage } = useNovaAI();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [inputValue, setInputValue] = useState("");
    const [isMounted, setIsMounted] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const pendingTransaction = (() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.action && lastMessage.role === "assistant") {
            return {
                type: lastMessage.action.type as "send" | "receive" | "swap",
                data: lastMessage.action.data || {},
            };
        }
        return null;
    })();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = (content: string) => {
        if (!isConnected) {
            toast.error("Please connect your wallet first");
            return;
        }
        sendMessage(content);
        setInputValue(""); // Clear input after sending
    };

    const handleActionClick = (action: "send" | "receive" | "swap" | "paylink") => {
        if (action === "send") {
            setInputValue("I want to send crypto");
        } else if (action === "receive") {
            setInputValue("Show me my receive address");
        } else if (action === "swap") {
            setInputValue("I want to swap tokens");
        } else if (action === "paylink") {
            setInputValue("I want to create a paylink");
        }
    };

    const handleTransactionCancel = () => {
        toast.info("Transaction cancelled");
    };

    const handleTransactionConfirm = () => {
        toast.success("Transaction submitted!");
    };

    if (!isMounted) return null;

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <div className="w-20 h-20 nova-gradient rounded-2xl flex items-center justify-center mx-auto mb-6 nova-glow">
                        <Wallet className="w-10 h-10 text-primary-foreground" />
                    </div>
                    <h1 className="text-3xl font-bold mb-4">Connect Your Wallet</h1>
                    <p className="text-muted-foreground mb-8">
                        Connect your wallet to start chatting with Nova AI and manage your crypto with natural language commands.
                    </p>
                    <Button
                        size="lg"
                        className="nova-gradient hover:opacity-90 nova-glow"
                        onClick={openConnectModal}
                    >
                        Connect Wallet
                    </Button>
                </div>
            </div>
        );
    }

    const hasMessages = messages.length > 0;

    return (
        <div className="h-screen flex flex-col bg-background">
            <ChatHeader
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            />

            <div className="flex-1 flex overflow-hidden">
                <TokenSidebar isOpen={sidebarOpen} />

                <main className="flex-1 flex flex-col bg-nova-chat-bg dark:bg-background">
                    {!hasMessages ? (
                        <WelcomeScreen onActionClick={handleActionClick} />
                    ) : (
                        <ScrollArea className="flex-1 p-6">
                            <div className="text-center mb-6">
                                <span className="text-sm text-muted-foreground">
                                    Right now you&apos;re in chat with Nova AI
                                </span>
                            </div>

                            <div className="max-w-3xl mx-auto">
                                {messages.map((message, index) => (
                                    <div key={message.id}>
                                        <ChatMessage role={message.role} content={message.content} />

                                        {message.role === "assistant" &&
                                            message.action &&
                                            index === messages.length - 1 &&
                                            pendingTransaction && (
                                                <div className="flex justify-start pl-14">
                                                    {pendingTransaction.type === "send" && (
                                                        <TransactionCard
                                                            type="send"
                                                            data={{
                                                                token: pendingTransaction.data.token || "ETH",
                                                                amount: pendingTransaction.data.amount || "0.1",
                                                                network: "Ethereum",
                                                                recipient: pendingTransaction.data.recipient || "0xABC...789",
                                                                gasFee: "$0.02",
                                                            }}
                                                            onCancel={handleTransactionCancel}
                                                            onConfirm={handleTransactionConfirm}
                                                        />
                                                    )}
                                                    {pendingTransaction.type === "receive" && (
                                                        <TransactionCard
                                                            type="receive"
                                                            data={{
                                                                address: address || "0x...",
                                                                token: pendingTransaction.data.token || "ETH",
                                                            }}
                                                            onClose={handleTransactionCancel}
                                                        />
                                                    )}
                                                    {pendingTransaction.type === "swap" && (
                                                        <TransactionCard
                                                            type="swap"
                                                            data={{
                                                                fromToken: pendingTransaction.data.fromToken || "ETH",
                                                                fromAmount: pendingTransaction.data.amount || "1",
                                                                toToken: pendingTransaction.data.toToken || "USDT",
                                                                toAmount: "1850.00",
                                                                rate: "1 ETH = 1850 USDT",
                                                            }}
                                                            onCancel={handleTransactionCancel}
                                                            onConfirm={handleTransactionConfirm}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                ))}
                                {isLoading && <ChatMessage role="assistant" content="" isLoading />}
                                <div ref={messagesEndRef} />
                            </div>
                        </ScrollArea>
                    )}

                    <ChatInput onSend={handleSendMessage} disabled={isLoading} initialValue={inputValue} />
                </main>
            </div>
        </div>
    );
}
