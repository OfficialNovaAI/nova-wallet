"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, useSendTransaction, useChainId } from "wagmi";
import { parseEther } from "viem";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { TokenSidebar } from "@/components/chat/TokenSidebar";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { TransactionCard } from "@/components/chat/TransactionCard";
import { BalanceCard } from "@/components/chat/BalanceCard";
import { MultiChainBalanceCard } from "@/components/chat/MultiChainBalanceCard";
import { InfoCard } from "@/components/chat/InfoCard";
import { SlippageCard } from "@/components/chat/SlippageCard"; // NEW
import { CustomUserMessage } from "@/components/chat/CustomUserMessage";
import { CustomChatInput } from "@/components/chat/CustomChatInput";
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

    // State to store balance data for Generative UI
    const [balanceData, setBalanceData] = useState<{
        balance: string;
        tokenSymbol: string;
        chainName: string;
    } | null>(null);

    useCopilotAction({
        name: "checkBalance",
        description: "Cek saldo wallet user di blockchain tertentu. Gunakan ini ketika user mau tahu saldo mereka, cek balance, atau lihat berapa crypto yang dimiliki.",
        parameters: [
            { name: "chainId", type: "number", description: "The chain ID to check balance on (e.g., 5000 for Mantle Mainnet, 5003 for Mantle Sepolia)", required: false },
        ],
        handler: async ({ chainId: targetChainId }) => {
            console.log("🔥 checkBalance action called!", { targetChainId }); // DEBUG
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
                    setBalanceData(null);
                    return `Error checking balance: ${error.error || "Unknown error"}`;
                }

                const data = await response.json();
                setBalanceData({
                    balance: data.balanceEth,
                    tokenSymbol: data.tokenSymbol,
                    chainName: data.formattedChainName,
                });
                return `Saldo user: ${data.balanceEth} ${data.tokenSymbol} di ${data.formattedChainName}. Card balance sudah ditampilkan.`;
            } catch (error: any) {
                setBalanceData(null);
                return `Error: ${error.message}`;
            }
        },
        render: ({ status }) => {
            if (status === "executing") {
                return (
                    <div className="flex items-center gap-2 p-4 bg-purple-50 rounded-xl border border-purple-100 max-w-sm mt-3">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-purple-700">Checking balance...</span>
                    </div>
                );
            }
            if (status === "complete" && balanceData && address) {
                return (
                    <BalanceCard
                        balance={balanceData.balance}
                        tokenSymbol={balanceData.tokenSymbol}
                        chainName={balanceData.chainName}
                        address={address}
                    />
                );
            }
            return <></>;
        },
    });

    // Ref for multi-chain balances (synchronous access in render)
    const multiChainBalancesRef = useRef<{
        chainName: string;
        balance: string;
        symbol: string;
    }[] | null>(null);

    // State to trigger re-render after data is set
    const [, forceUpdate] = useState(0);

    // State for slippage prediction
    const slippageDataRef = useRef<{
        best_venue: string;
        quotes: any[];
        symbol: string;
        amount: number;
        side: "buy" | "sell";
    } | null>(null);

    useCopilotAction({
        name: "checkAllBalances",
        description: "Cek saldo wallet user di SEMUA chain yang tersedia sekaligus. Gunakan ini ketika user mau lihat semua saldo, cek portfolio, atau lihat balance di setiap chain.",
        handler: async () => {
            console.log("🔥 checkAllBalances action called!"); // DEBUG
            if (!isConnected || !address) {
                return "User wallet is not connected. Please ask the user to connect their wallet first.";
            }

            try {
                // Fetch balances from all supported chains
                const chainIds = [11155111, 5003, 84532, 11155420, 4202, 80002, 421614];
                const balancePromises = chainIds.map(async (cid) => {
                    try {
                        const response = await fetch("/api/wallet/balance", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ address, chainId: cid }),
                        });
                        if (response.ok) {
                            const data = await response.json();
                            return {
                                chainName: data.formattedChainName,
                                balance: data.balanceEth,
                                symbol: data.tokenSymbol,
                            };
                        }
                        return null;
                    } catch {
                        return null;
                    }
                });

                const results = await Promise.all(balancePromises);
                const validBalances = results.filter((b): b is NonNullable<typeof b> => b !== null);

                console.log("🔥 checkAllBalances results:", validBalances); // DEBUG
                multiChainBalancesRef.current = validBalances;
                forceUpdate(n => n + 1); // Trigger re-render
                console.log("🔥 multiChainBalances ref set to:", validBalances.length, "chains"); // DEBUG

                const nonZero = validBalances.filter(b => parseFloat(b.balance) > 0);
                return `Berhasil mengambil saldo dari ${validBalances.length} chains. ${nonZero.length} chains memiliki saldo > 0. Lihat card portfolio di atas.`;
            } catch (error: any) {
                console.log("🔥 checkAllBalances error:", error); // DEBUG
                multiChainBalancesRef.current = null;
                return `Error: ${error.message}`;
            }
        },
        render: ({ status }) => {
            if (status === "executing") {
                return (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-md mt-3 shadow-lg">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 
                                          flex items-center justify-center animate-pulse">
                                <Wallet className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">Checking all chains...</p>
                                <p className="text-sm text-gray-500">Fetching balances from 7 networks</p>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-7 gap-1">
                            {[...Array(7)].map((_, i) => (
                                <div
                                    key={i}
                                    className="h-1.5 rounded-full bg-purple-200 animate-pulse"
                                    style={{ animationDelay: `${i * 100}ms` }}
                                />
                            ))}
                        </div>
                    </div>
                );
            }
            if (status === "complete" && multiChainBalancesRef.current && address) {
                console.log("🔥 Rendering MultiChainBalanceCard with:", multiChainBalancesRef.current); // DEBUG
                return (
                    <MultiChainBalanceCard
                        balances={multiChainBalancesRef.current}
                        address={address}
                    />
                );
            }
            return <></>;
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
        name: "predictTradeCost",
        description: "Predicts execution cost and slippage for a trade. Use this when user wants to analyze trade cost, check slippage, or compare exchanges for CEX (Binance, Kraken, etc).",
        parameters: [
            { name: "symbol", type: "string", description: "Trading pair symbol (e.g., BTC/USDT, ETH/USDT)" },
            { name: "amount", type: "number", description: "Amount of crypto to trade" },
            { name: "side", type: "string", description: "Trade side: 'buy' or 'sell'" },
        ],
        render: ({ status, args }) => {
            if (status === "complete" && slippageDataRef.current) {
                return (
                    <SlippageCard
                        symbol={slippageDataRef.current.symbol}
                        amount={slippageDataRef.current.amount}
                        side={slippageDataRef.current.side}
                        bestVenue={slippageDataRef.current.best_venue}
                        quotes={slippageDataRef.current.quotes}
                    />
                );
            }
            if (status === "executing") {
                return <div className="text-sm text-gray-500 italic animate-pulse">🤖 Analyzing market depth & predicted slippage...</div>;
            }
            return <></>;
        },
        handler: async ({ symbol, amount, side }) => {
            console.log("🔥 predictTradeCost action called!", { symbol, amount, side }); // DEBUG
            try {
                // Determine side if not provided or valid
                const tradeSide = (side && ['buy', 'sell'].includes(side.toLowerCase())) ? side.toLowerCase() : 'sell';

                const response = await fetch("/api/ai/predict-cost", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ symbol: symbol.toUpperCase(), amount, side: tradeSide }),
                });

                if (!response.ok) throw new Error("Failed to fetch prediction");

                const data = await response.json();

                slippageDataRef.current = {
                    ...data,
                    symbol: symbol.toUpperCase(),
                    amount,
                    side: tradeSide as "buy" | "sell"
                };
                forceUpdate(n => n + 1); // Trigger render

                return `Prediction complete. View the card above.`;
            } catch (error: any) {
                console.error("🔥 predictTradeCost error:", error);
                return `Error analyzing trade: ${error.message}`;
            }
        },
    });

    useCopilotAction({
        name: "showReceiveAddress",
        description: "Tampilkan alamat wallet user dengan QR code untuk menerima crypto. Gunakan ini ketika user ingin menerima token, melihat alamat wallet mereka, meminta QR code, atau share address.",
        handler: async () => {
            if (!isConnected || !address) {
                return "User wallet is not connected. Please ask the user to connect their wallet first.";
            }

            return `Alamat wallet user: ${address}. QR code dan tombol copy sudah ditampilkan di atas.`;
        },
        render: ({ status }) => {
            // Always show the receive card when action is complete
            if (status === "complete" && address) {
                return (
                    <TransactionCard
                        type="receive"
                        data={{
                            address: address,
                            token: "MNT",
                        }}
                        onClose={() => { }}
                    />
                );
            }
            if (status === "executing") {
                return <div className="text-muted-foreground text-sm">Generating QR code...</div>;
            }
            return <></>;
        },
    });

    // Generative UI: Display information in card format (NOT for balance!)
    useCopilotAction({
        name: "displayInfoCard",
        description: "Tampilkan informasi umum dalam format card. JANGAN gunakan untuk menampilkan saldo/balance - gunakan checkBalance atau checkAllBalances untuk itu. Gunakan displayInfoCard hanya untuk: tips crypto, penjelasan blockchain, status transaksi, atau informasi edukasi.",
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
            // BLOCK: Don't render anything balance/saldo related
            const blockedKeywords = ['saldo', 'balance', 'portfolio', 'chain 1', 'chain 2', 'eth', 'btc', 'bnb'];
            const titleLower = (args.title || '').toLowerCase();
            if (blockedKeywords.some(kw => titleLower.includes(kw))) {
                return <></>;  // Don't render fake balance cards
            }

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
            console.log("🔥 displayInfoCard action called!", { title }); // DEBUG

            // BLOCK: Reject balance-related requests
            const blockedKeywords = ['saldo', 'balance', 'portfolio'];
            const titleLower = (title || '').toLowerCase();
            if (blockedKeywords.some(kw => titleLower.includes(kw))) {
                return "ERROR: Jangan gunakan displayInfoCard untuk balance/saldo. Gunakan checkBalance atau checkAllBalances.";
            }

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
                <main className="flex-1 flex flex-col min-h-0 h-full">
                    {/* Chat Status Header */}
                    <div className="flex-shrink-0 text-center py-3 text-gray-400 text-sm border-b border-gray-100">
                        Right now you&apos;re in chat with Nova AI
                    </div>

                    <div className="flex-1 min-h-0 h-full overflow-hidden">
                        <CopilotChat
                            className="h-full w-full"
                            labels={{
                                title: "Nova AI",
                                initial: "Halo! Saya Nova AI, asisten crypto wallet kamu. Saya bisa bantu cek saldo, kirim crypto, dan menjawab pertanyaan tentang blockchain. Mau aku bantu apa hari ini?",
                                placeholder: "Tanya Nova AI tentang wallet atau crypto...",
                            }}
                            UserMessage={CustomUserMessage}
                            Input={CustomChatInput}
                            instructions={`Kamu adalah Nova AI, asisten crypto wallet yang ramah dan helpful. Selalu gunakan Bahasa Indonesia.

TOOLS YANG TERSEDIA:
1. checkBalance - Cek saldo di SATU chain tertentu
2. checkAllBalances - Cek saldo di SEMUA chain sekaligus (7 chains). WAJIB gunakan ini jika user minta lihat semua saldo atau portfolio
3. prepareTransaction - Menyiapkan transaksi kirim crypto
4. showReceiveAddress - Menampilkan alamat wallet dengan QR code
5. displayInfoCard - HANYA untuk tips, penjelasan, dan edukasi. JANGAN untuk balance!

ATURAN PENTING - WAJIB DIIKUTI:
1. JANGAN PERNAH memfabrikasi atau mengarang data saldo. Selalu panggil checkBalance atau checkAllBalances untuk mendapat data real
2. Jika user tanya "cek saldo", "berapa balance ku", "lihat portfolio", dll - WAJIB panggil checkBalance atau checkAllBalances
3. JANGAN gunakan displayInfoCard untuk menampilkan saldo - data akan salah!
4. Chain yang tersedia: Ethereum Sepolia, Mantle Sepolia, Base Sepolia, Optimism Sepolia, Lisk Sepolia, Polygon Amoy, Arbitrum Sepolia
5. TIDAK ada Bitcoin (BTC) - kita hanya support EVM chains

CONTOH:
- "cek saldom" → panggil checkBalance
- "lihat semua saldo di setiap chain" → panggil checkAllBalances
- "apa itu blockchain?" → gunakan displayInfoCard untuk penjelasan

Wallet user: ${address} | Chain ID: ${chainId}`}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
}
