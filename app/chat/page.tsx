"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, useSendTransaction, useChainId } from "wagmi";
import { parseEther } from "viem";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { TokenSidebar } from "@/components/chat/TokenSidebar";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { TransactionCard } from "@/components/chat/TransactionCard";
import { InfoCard } from "@/components/chat/InfoCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

// CopilotKit Imports
import { CopilotKit, useCopilotAction } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export default function ChatPage() {
    return (
        <CopilotKit runtimeUrl="/api/copilotkit">
            <ChatPageContent />
        </CopilotKit>
    );
}

function ChatPageContent() {
    const { isConnected, address } = useAccount();
    const chainId = useChainId();
    const { openConnectModal } = useConnectModal();
    const { sendTransaction } = useSendTransaction();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    // Transaction state for Generative UI
    const [pendingTransaction, setPendingTransaction] = useState<{
        type: "send" | "receive";
        data: any;
    } | null>(null);

    // Register CopilotKit Actions for Function Calling
    useCopilotAction({
        name: "checkBalance",
        description: "Check the user's wallet balance on a specific blockchain network",
        parameters: [
            { name: "chainId", type: "number", description: "The chain ID to check balance on (e.g., 5000 for Mantle Mainnet, 5003 for Mantle Sepolia)", required: false },
        ],
        handler: async ({ chainId: targetChainId }) => {
            if (!isConnected || !address) {
                return "User wallet is not connected. Please ask the user to connect their wallet first.";
            }

            try {
                const resolvedChainId = targetChainId || chainId;
                const response = await fetch("/api/wallet/balance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ address, chainId: resolvedChainId }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    return `Error checking balance: ${error.error || "Unknown error"}`;
                }

                const data = await response.json();
                return `Balance: ${data.balanceEth} ${data.tokenSymbol} on ${data.formattedChainName}`;
            } catch (error: any) {
                return `Error: ${error.message}`;
            }
        },
    });

    useCopilotAction({
        name: "prepareTransaction",
        description: "Prepare a cryptocurrency transaction for the user to sign. Use this when the user wants to send money.",
        parameters: [
            { name: "recipient", type: "string", description: "The recipient wallet address (0x...)" },
            { name: "amount", type: "string", description: "The amount of native tokens to send (e.g., 0.1)" },
            { name: "chainId", type: "number", description: "The chain ID for the transaction", required: false },
        ],
        render: ({ status, args }) => {
            if (status === "executing") {
                return <div className="text-muted-foreground">Preparing transaction...</div>;
            }

            if (status === "complete" && args.recipient && args.amount) {
                return (
                    <TransactionCard
                        type="send"
                        data={{
                            token: "MNT",
                            amount: args.amount,
                            network: "Mantle",
                            recipient: args.recipient,
                            gasFee: "< 0.01 MNT",
                        }}
                        onCancel={() => {
                            setPendingTransaction(null);
                            toast.info("Transaction cancelled");
                        }}
                        onConfirm={() => {
                            try {
                                sendTransaction({
                                    to: args.recipient as `0x${string}`,
                                    value: parseEther(args.amount),
                                }, {
                                    onSuccess: (hash) => {
                                        toast.success("Transaction submitted!", {
                                            description: `Hash: ${hash.slice(0, 10)}...${hash.slice(-8)}`
                                        });
                                        setPendingTransaction(null);
                                    },
                                    onError: (error) => {
                                        toast.error("Transaction failed", {
                                            description: error.message
                                        });
                                    }
                                });
                            } catch (error: any) {
                                toast.error("Error", { description: error.message });
                            }
                        }}
                    />
                );
            }

            return <></>;
        },
        handler: async ({ recipient, amount, chainId: targetChainId }) => {
            if (!isConnected || !address) {
                return "User wallet is not connected. Please ask the user to connect their wallet first.";
            }

            // Validate address
            if (!recipient || !recipient.startsWith("0x") || recipient.length !== 42) {
                return "Invalid recipient address. Please provide a valid Ethereum address (0x...).";
            }

            // Validate amount
            const amountNum = parseFloat(amount);
            if (isNaN(amountNum) || amountNum <= 0) {
                return "Invalid amount. Please provide a valid positive number.";
            }

            return `Transaction prepared: Sending ${amount} tokens to ${recipient}. Please confirm the transaction in the UI above.`;
        },
    });

    useCopilotAction({
        name: "showReceiveAddress",
        description: "Show the user's wallet address for receiving crypto",
        handler: async () => {
            if (!isConnected || !address) {
                return "User wallet is not connected. Please ask the user to connect their wallet first.";
            }

            setPendingTransaction({
                type: "receive",
                data: { token: "MNT", address }
            });

            return `User's wallet address: ${address}. A QR code has been displayed for easy sharing.`;
        },
        render: ({ status }) => {
            if (status === "complete" && pendingTransaction?.type === "receive") {
                return (
                    <TransactionCard
                        type="receive"
                        data={{
                            address: address || "0x...",
                            token: "MNT",
                        }}
                        onClose={() => setPendingTransaction(null)}
                    />
                );
            }
            return <></>;
        },
    });

    // Generative UI: Display information in card format
    useCopilotAction({
        name: "displayInfoCard",
        description: "Tampilkan informasi dalam format card yang menarik. Gunakan ini untuk menampilkan informasi balance, status transaksi, atau penjelasan crypto.",
        parameters: [
            { name: "title", type: "string", description: "Judul card" },
            { name: "content", type: "string", description: "Konten utama card (opsional)", required: false },
            {
                name: "items",
                type: "object[]",
                description: "Array of items dengan label dan value untuk ditampilkan. Format: [{label: string, value: string}]",
                required: false
            },
            {
                name: "type",
                type: "string",
                description: "Tipe card: 'info' (biru), 'success' (hijau), 'warning' (kuning), 'error' (merah)",
                required: false
            },
        ],
        render: ({ status, args }) => {
            if (status === "complete" && args.title) {
                return (
                    <InfoCard
                        title={args.title}
                        content={args.content}
                        items={args.items as { label: string; value: string }[]}
                        type={args.type as "info" | "success" | "warning" | "error"}
                    />
                );
            }
            return <></>;
        },
        handler: async ({ title }) => {
            return `Informasi "${title}" berhasil ditampilkan dalam format card.`;
        },
    });

    useEffect(() => {
        setIsMounted(true);
    }, []);

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

    return (
        <div className="h-screen flex flex-col bg-background">
            <ChatHeader
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            />

            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Your Custom Sidebar - TETAP */}
                <TokenSidebar isOpen={sidebarOpen} />

                {/* CopilotKit Chat UI */}
                <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <CopilotChat
                        className="flex-1 min-h-0 overflow-hidden"
                        labels={{
                            title: "Nova AI",
                            initial: "Halo! Saya Nova AI, asisten crypto wallet kamu. Saya bisa bantu cek saldo, kirim crypto, dan menjawab pertanyaan tentang blockchain. Mau aku bantu apa hari ini?",
                            placeholder: "Tanya Nova AI tentang wallet atau crypto...",
                        }}
                        instructions={`Kamu adalah Nova AI, asisten crypto wallet yang ramah dan helpful. Selalu gunakan Bahasa Indonesia.

TOOLS YANG TERSEDIA:
1. checkBalance - Untuk cek saldo wallet user
2. prepareTransaction - Untuk menyiapkan transaksi kirim crypto
3. showReceiveAddress - Untuk menampilkan alamat wallet user
4. displayInfoCard - Untuk menampilkan informasi dalam format card yang menarik

ATURAN PENGGUNAAN displayInfoCard:
- Gunakan untuk menampilkan informasi penting dalam format visual yang menarik
- title: Judul card (wajib)
- content: Deskripsi atau penjelasan (opsional)
- items: Array objek {label, value} untuk data terstruktur (opsional)
- type: "info" (biru), "success" (hijau), "warning" (kuning), "error" (merah)

CONTOH PENGGUNAAN:
- Setelah cek saldo, tampilkan hasilnya dengan displayInfoCard type "success"
- Untuk peringatan, gunakan type "warning"
- Untuk error, gunakan type "error"

PENTING:
- Selalu gunakan Bahasa Indonesia dalam respons
- Jangan execute transaksi tanpa konfirmasi user
- Berikan penjelasan yang mudah dipahami

Wallet user terhubung: ${address} pada chain ID: ${chainId}`}
                    />
                </main>
            </div>
        </div>
    );
}
