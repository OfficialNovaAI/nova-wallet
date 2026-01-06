"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount, useSendTransaction, useChainId, useSwitchChain } from "wagmi";
import { supportedChains } from "@/config/chains";
import { parseEther } from "viem";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { TokenSidebar } from "@/components/chat/TokenSidebar";
import { TransactionCard } from "@/components/chat/TransactionCard";
import { BalanceCard } from "@/components/chat/BalanceCard";
import { MultiChainBalanceCard } from "@/components/chat/MultiChainBalanceCard";
import { InfoCard } from "@/components/chat/InfoCard";
import { SlippageCard } from "@/components/chat/SlippageCard";
import { CustomUserMessage } from "@/components/chat/CustomUserMessage";
import { CustomChatInput } from "@/components/chat/CustomChatInput";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { Button } from "@/components/ui/button";
import { Wallet, Sparkles, Send, Activity, Fuel, Loader2 } from "lucide-react";
import { toast } from "sonner";

// CopilotKit Imports
import { CopilotKit, useCopilotAction, useCopilotChat } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql";
import "@copilotkit/react-ui/styles.css";

// New Generative UI Components
import { PortfolioCard } from "@/components/chat/PortfolioCard";
import { TokenActivityCard } from "@/components/chat/TokenActivityCard";
import { TransactionStatsCard } from "@/components/chat/TransactionStatsCard";
import { CreatePaymentForm } from "@/components/chat/CreatePaymentForm";
import { PaymentStatusCard } from "@/components/chat/PaymentStatusCard";
import { SendTransactionForm } from "@/components/chat/forms/SendTransactionForm";
import { SlippageForm } from "@/components/chat/forms/SlippageForm";
import axios from "axios";

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
    const { switchChainAsync } = useSwitchChain();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);
    const [inputValue, setInputValue] = useState("");
    const [hasStartedChat, setHasStartedChat] = useState(false);
    const [pendingMessage, setPendingMessage] = useState<string | null>(null);

    // useCopilotChat for programmatic message sending
    const { appendMessage } = useCopilotChat();

    // State to store balance data for Generative UI
    const [balanceData, setBalanceData] = useState<{
        balance: string;
        tokenSymbol: string;
        chainName: string;
    } | null>(null);

    // ============================================
    // EXISTING ACTION: Check Balance
    // ============================================
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

    // State for Portfolio Data
    const portfolioDataRef = useRef<any>(null);
    const tokenActivityDataRef = useRef<any>(null);
    const transactionStatsDataRef = useRef<any>(null);
    const paymentLinkDataRef = useRef<any>(null);

    // ============================================
    // EXISTING ACTION: Check All Balances
    // ============================================
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
                const chainIds = [1, 5000, 11155111, 5003, 84532, 11155420, 4202, 80002, 421614];
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

    // ============================================
    // EXISTING ACTION: Prepare Transaction
    // ============================================
    useCopilotAction({
        name: "prepareTransaction",
        description: "Prepare a cryptocurrency transaction. IMPORTANT: If recipient or amount is missing, DO NOT ASK in chat. Call this tool immediately with empty arguments so the interactive form appears.",
        parameters: [
            { name: "recipient", type: "string", description: "The recipient wallet address (0x...)" },
            { name: "amount", type: "string", description: "The amount of native tokens to send (e.g., 0.1)" },
            { name: "chainId", type: "number", description: "The chain ID for the transaction. MUST be one of: 1 (Mainnet), 5000 (Mantle), 11155111 (Sepolia), 5003 (Mantle Sepolia), 4202 (Lisk Sepolia), 84532 (Base Sepolia), 11155420 (Op Sepolia).", required: true },
        ],
        render: ({ status, args }) => {
            // Case 1: Execution started but arguments missing (triggered by button click)
            // Or explicitly executing but waiting for args
            if (status === "executing" && (!args.recipient || !args.amount)) {
                return (
                    <div className="mt-2">
                        <SendTransactionForm
                            defaultValues={{
                                recipient: args.recipient,
                                amount: args.amount,
                            }}
                            onSubmit={async (data) => {
                                const msg = `Send ${data.amount} ${data.token} to ${data.recipient}`;
                                await appendMessage(
                                    new TextMessage({
                                        role: MessageRole.User,
                                        content: msg,
                                    })
                                );
                            }}
                        />
                    </div>
                );
            }

            if (status === "executing") {
                return <div className="text-muted-foreground">Preparing transaction...</div>;
            }

            if (status === "complete" && args.recipient && args.amount) {
                const targetChainId = args.chainId || chainId;
                const targetChain = supportedChains.find(c => c.id === targetChainId);
                const tokenSymbol = targetChain?.symbol || "ETH"; // Default fallback
                const networkName = targetChain?.name || "Unknown Network";

                return (
                    <TransactionCard
                        type="send"
                        data={{
                            token: tokenSymbol,
                            amount: args.amount,
                            network: networkName,
                            recipient: args.recipient,
                            gasFee: "Calculated in wallet",
                        }}
                        onCancel={() => {
                            toast.info("Transaction cancelled");
                        }}
                        onConfirm={async () => {
                            try {
                                // 1. Check if we need to switch chain
                                if (chainId !== targetChainId && targetChainId) {
                                    toast.loading(`Switching to ${networkName}...`);
                                    try {
                                        await switchChainAsync({ chainId: targetChainId });
                                        toast.dismiss();
                                        toast.success(`Switched to ${networkName}`);
                                    } catch (switchError) {
                                        toast.dismiss();
                                        toast.error("Failed to switch network");
                                        return;
                                    }
                                }

                                // 2. Send Transaction
                                sendTransaction({
                                    to: args.recipient as `0x${string}`,
                                    value: parseEther(args.amount),
                                }, {
                                    onSuccess: (hash) => {
                                        toast.success("Transaction submitted!", {
                                            description: `Hash: ${hash.slice(0, 10)}...${hash.slice(-8)}`
                                        });
                                    },
                                    onError: (error) => {
                                        toast.error("Transaction failed", {
                                            description: error.message
                                        });
                                    }
                                });
                            } catch (error) {
                                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                                toast.error("Error", { description: errorMessage });
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

            // Validate Chain
            const chainInfo = supportedChains.find(c => c.id === targetChainId);
            const chainName = chainInfo?.name || `Chain ID ${targetChainId}`;

            return `Transaction prepared: Sending ${amount} ${chainInfo?.symbol || 'tokens'} to ${recipient} on ${chainName}. Please confirm in the card above.`;
        },
    });

    // ============================================
    // EXISTING ACTION: Predict Trade Cost
    // ============================================
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
                        quotes={slippageDataRef.current.quotes}
                    />
                );
            }
            if (status === "executing" && (!args.symbol || !args.amount)) {
                return (
                    <div className="mt-2">
                        <SlippageForm
                            defaultValues={{
                                symbol: args.symbol,
                                amount: args.amount ? String(args.amount) : undefined,
                                side: args.side as "buy" | "sell"
                            }}
                            onSubmit={async (data) => {
                                const msg = `Analyze slippage for ${data.side} ${data.amount} ${data.symbol}`;
                                await appendMessage(
                                    new TextMessage({
                                        role: MessageRole.User,
                                        content: msg,
                                    })
                                );
                            }}
                        />
                    </div>
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

                // Fallback Mock Data if API fails (for demo/resilience)
                const mockQuotes = [
                    { exchange: "binance", quote_price: 98000 * (amount || 1), predicted_slippage_pct: 0.001, total_cost: 98150 * (amount || 1), fees: { trading_fee: 50, slippage_cost: 100 } },
                    { exchange: "kraken", quote_price: 98050 * (amount || 1), predicted_slippage_pct: 0.0015, total_cost: 98250 * (amount || 1), fees: { trading_fee: 60, slippage_cost: 140 } },
                    { exchange: "coinbase", quote_price: 98100 * (amount || 1), predicted_slippage_pct: 0.002, total_cost: 98400 * (amount || 1), fees: { trading_fee: 80, slippage_cost: 220 } },
                ];

                slippageDataRef.current = {
                    best_venue: "binance",
                    quotes: mockQuotes,
                    symbol: symbol.toUpperCase(),
                    amount,
                    side: (side && ['buy', 'sell'].includes(side.toLowerCase())) ? (side.toLowerCase() as "buy" | "sell") : 'sell'
                };
                forceUpdate(n => n + 1);

                return `API Error (${error.message}). Showing simulated data for demonstration.`;
            }
        },
    });

    // ============================================
    // EXISTING ACTION: Show Receive Address
    // ============================================
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

    // ============================================
    // EXISTING ACTION: Display Info Card
    // ============================================
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

    // ============================================
    // NEW ACTION 1: Analyze Portfolio (All Tokens)
    // ============================================
    useCopilotAction({
        name: "analyzePortfolio",
        description: "Analisis portfolio lengkap wallet: semua token holdings (native + ERC-20), nilai USD, profit/loss. Gunakan ini ketika user bertanya 'portfolio aku', 'analyze address 0x...', 'holdings', dll.",
        parameters: [
            { name: "targetAddress", type: "string", description: "Wallet address to analyze (0x...). If not provided, uses connected wallet address.", required: false },
            { name: "chainId", type: "number", description: "Chain ID untuk analisis (default: chain yang sedang aktif)", required: false },
        ],
        handler: async ({ targetAddress, chainId: targetChainId }) => {
            console.log("🔥 analyzePortfolio action called!", { targetAddress, targetChainId });

            // Use provided address or fall back to connected wallet
            const walletAddress = targetAddress || address;

            if (!walletAddress) {
                return "No address provided and wallet is not connected. Please provide an address (0x...) or connect your wallet.";
            }

            try {
                const resolvedChainId = targetChainId || chainId;

                // Call blockchain API route (server-side)
                const response = await fetch('/api/blockchain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'portfolio',
                        address: walletAddress,
                        chainId: resolvedChainId
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch portfolio data');
                }

                const { data: result } = await response.json();

                if (result.data.type === 'portfolio') {
                    // Update state to render UI
                    portfolioDataRef.current = {
                        chainName: result.chain,
                        analysis: result.data.analysis,
                        nativeToken: result.metadata?.nativeToken || 'ETH'
                    };
                    forceUpdate(n => n + 1);

                    return `Portfolio analysis rendered above for ${walletAddress}.`;
                }

                return "Failed to analyze portfolio. Please try again.";
            } catch (error: any) {
                console.error("Portfolio analysis error:", error);
                return `Error analyzing portfolio: ${error.message}`;
            }
        },
        render: ({ status }) => {
            if (status === "executing") {
                return (
                    <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-xl border border-blue-100 max-w-sm mt-3 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        <span className="text-sm text-blue-700">Analyzing wallet portfolio...</span>
                    </div>
                );
            } else if (status === "complete" && portfolioDataRef.current) {
                const { analysis, chainName, nativeToken } = portfolioDataRef.current;
                return (
                    <PortfolioCard
                        totalValueUSD={analysis.totalPortfolioValueUSD}
                        totalPnLPercentage={analysis.totalPnLPercentage}
                        nativeBalance={analysis.nativeBalance}
                        nativeToken={nativeToken}
                        nativeValueUSD={analysis.nativeValueUSD}
                        tokens={analysis.tokenHoldings}
                        chainName={chainName}
                    />
                );
            }
            return <></>;
        },
    });

    // ============================================
    // NEW ACTION 2: Analyze Token Activity (Trading History)
    // ============================================
    useCopilotAction({
        name: "analyzeTokenActivity",
        description: "Analisis aktivitas trading wallet user: token yang dibeli/dijual, profit/loss per token, performa trading. Gunakan ini ketika user tanya 'profit aku berapa', 'token apa yang paling untung', 'rugi berapa', 'riwayat trading', dll.",
        parameters: [
            { name: "chainId", type: "number", description: "Chain ID untuk analisis", required: false },
            { name: "timeframeDays", type: "number", description: "Timeframe dalam hari (30, 90, 365, atau all-time)", required: false },
        ],
        handler: async ({ chainId: targetChainId, timeframeDays }) => {
            console.log("🔥 analyzeTokenActivity action called!", { targetChainId, timeframeDays });

            if (!isConnected || !address) {
                return "User wallet belum terkoneksi. Minta user untuk connect wallet dulu.";
            }

            try {
                const resolvedChainId = targetChainId || chainId;

                // Call blockchain API route (server-side)
                const response = await fetch('/api/blockchain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'token_activity',
                        address,
                        chainId: resolvedChainId,
                        timeframeDays
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch token activity');
                }

                const { data: result } = await response.json();

                if (result.data.type === 'token_activity') {
                    // Store for UI
                    tokenActivityDataRef.current = {
                        summary: result.data.analysis.summary,
                        chainName: result.chain
                    };
                    forceUpdate(n => n + 1);

                    return `Trading activity analysis rendered above.`;
                }

                return "Failed to analyze token activity. Please try again.";
            } catch (error: any) {
                console.error("Token activity error:", error);
                return `Error analyzing trading activity: ${error.message}`;
            }
        },
        render: ({ status }) => {
            if (status === "executing") {
                return (
                    <div className="flex items-center gap-2 p-4 bg-orange-50 rounded-xl border border-orange-100 max-w-sm mt-3 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-orange-600 animate-pulse" />
                        </div>
                        <span className="text-sm text-orange-700">Calculating trading P&L...</span>
                    </div>
                );
            } else if (status === "complete" && tokenActivityDataRef.current) {
                return (
                    <TokenActivityCard
                        summary={tokenActivityDataRef.current.summary}
                        chainName={tokenActivityDataRef.current.chainName}
                    />
                );
            }
            return <></>;
        },
    });

    // ============================================
    // NEW ACTION 3: Transaction Stats (Gas, Activity)
    // ============================================
    useCopilotAction({
        name: "getTransactionStats",
        description: "Dapatkan statistik transaksi wallet user: total transaksi, gas fees yang dipakai, aktivitas wallet. Gunakan ini ketika user tanya 'berapa gas yang aku habiskan', 'seberapa aktif wallet aku', 'total transaksi', dll.",
        parameters: [
            { name: "chainId", type: "number", description: "Chain ID untuk analisis", required: false },
        ],
        handler: async ({ chainId: targetChainId }) => {
            console.log("🔥 getTransactionStats action called!", { targetChainId });

            if (!isConnected || !address) {
                return "User wallet belum terkoneksi. Minta user untuk connect wallet dulu.";
            }

            try {
                const resolvedChainId = targetChainId || chainId;

                // Call blockchain API route (server-side)
                const response = await fetch('/api/blockchain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'transaction_stats',
                        address,
                        chainId: resolvedChainId
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch transaction stats');
                }

                const { data: result } = await response.json();

                if (result.data.type === 'transaction_stats') {
                    // Store for UI
                    transactionStatsDataRef.current = {
                        stats: result.data.stats,
                        chainName: result.chain
                    };
                    forceUpdate(n => n + 1);

                    return `Transaction statistics rendered above.`;
                }

                return "Failed to get transaction stats. Please try again.";
            } catch (error: any) {
                console.error("Transaction stats error:", error);
                return `Error getting transaction stats: ${error.message}`;
            }
        },
        render: ({ status }) => {
            if (status === "executing") {
                return (
                    <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-xl border border-gray-200 max-w-sm mt-3 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <Fuel className="w-4 h-4 text-gray-600 animate-pulse" />
                        </div>
                        <span className="text-sm text-gray-700">Calculating gas usage...</span>
                    </div>
                );
            } else if (status === "complete" && transactionStatsDataRef.current) {
                return (
                    <TransactionStatsCard
                        stats={transactionStatsDataRef.current.stats}
                        chainName={transactionStatsDataRef.current.chainName}
                    />
                );
            }
            return <></>;
        },
    });

    // ============================================
    // NEW ACTION 4: Create Payment Link (Chat-Based)
    // ============================================
    useCopilotAction({
        name: "createPaymentLink",
        description: "Buat payment link. PENTING: Jika parameter amount/token belum ada, JANGAN TANYA di chat. Langsung panggil tool ini agar form input muncul.",
        parameters: [
            { name: "amount", type: "number", description: "Jumlah crypto (e.g. 0.1)", required: false },
            { name: "token", type: "string", description: "Symbol token (ETH, USDC, MNT, dll)", required: false },
            { name: "network", type: "string", description: "Network blockchain (ethereum, mantle, dll)", required: false },
            { name: "receiverWallet", type: "string", description: "Wallet penerima (default: wallet user yg connect)", required: false },
        ],
        handler: async ({ amount, token, network, receiverWallet }) => {
            console.log("🔥 createPaymentLink action called!", { amount, token });

            if (!amount || !token) {
                return "Mohon lengkapi data pembayaran di form berikut.";
            }

            try {
                const finalReceiver = receiverWallet || address;
                if (!finalReceiver) return "Wallet not connected";

                const response = await axios.post('/api/payments/create', {
                    cryptoAmount: amount,
                    cryptoCurrency: token || 'ETH',
                    network: network || 'ethereum',
                    receiverWallet: finalReceiver
                });

                if (response.data.success) {
                    paymentLinkDataRef.current = response.data.data;
                    forceUpdate(n => n + 1);
                    return `Payment link berhasil dibuat! ID: ${response.data.data.id}`;
                }
                return "Gagal membuat payment link.";
            } catch (error: any) {
                console.error("Create payment error:", error);
                return `Error: ${error.message}`;
            }
        },
        render: ({ status, args }) => {
            // Case 1: Show Form (If incomplete args/starting)
            if (status === "executing" && (!args.amount || !args.token)) {
                return (
                    <div className="mt-2">
                        <CreatePaymentForm
                            defaultValues={{
                                amount: args.amount,
                                symbol: args.token,
                                network: args.network
                            }}
                            onSubmit={async (formData: any) => {
                                const msg = `Buatkan payment link: ${formData.amount} ${formData.token} di network ${formData.network} untuk wallet ${formData.receiverWallet}`;
                                await appendMessage(
                                    new TextMessage({
                                        role: MessageRole.User,
                                        content: msg,
                                    })
                                );
                            }}
                        />
                    </div>
                );
            }

            // Case 2: Executing with data
            if (status === "executing") {
                return (
                    <div className="flex items-center gap-2 p-4 bg-gray-900 rounded-xl border border-gray-800 max-w-sm mt-3 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                        </div>
                        <span className="text-sm text-gray-300">Generating Payment Link...</span>
                    </div>
                );
            }

            // Case 3: Complete -> Show Result Card
            if (status === "complete" && paymentLinkDataRef.current) {
                return (
                    <div className="mt-2">
                        <PaymentStatusCard
                            paymentId={paymentLinkDataRef.current.id}
                            initialData={paymentLinkDataRef.current}
                        />
                    </div>
                );
            }

            return <></>;
        },
    });

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Send pending message after CopilotChat mounts
    useEffect(() => {
        if (pendingMessage && hasStartedChat) {
            const sendPendingMessage = async () => {
                try {
                    await appendMessage(
                        new TextMessage({
                            role: MessageRole.User,
                            content: pendingMessage,
                        })
                    );
                    setPendingMessage(null);
                } catch (error) {
                    console.error("Error sending message:", error);
                }
            };
            // Small delay to ensure CopilotChat is mounted
            const timer = setTimeout(sendPendingMessage, 100);
            return () => clearTimeout(timer);
        }
    }, [pendingMessage, hasStartedChat, appendMessage]);

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
        <div className="h-screen flex bg-background">
            {/* Sidebar on the Left */}
            <TokenSidebar isOpen={sidebarOpen} />

            {/* Main Content Area (Header + Chat) on the Right */}
            <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
                <ChatHeader
                    sidebarOpen={sidebarOpen}
                    onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                />

                {/* Chat Container */}
                <main className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
                    {/* Welcome Screen with Input */}
                    {showWelcome ? (
                        <div className="flex-1 flex flex-col">

                            {/* Welcome Screen Content */}
                            <div className="flex-1 flex items-center justify-center overflow-auto">
                                <WelcomeScreen
                                    onActionClick={(action) => {
                                        const actionMessages: Record<string, string> = {
                                            send: "Prepare a transaction",
                                            receive: "Show my wallet address",
                                            swap: "I want to swap tokens",
                                            paylink: "Create a payment link",
                                            portfolio: "Analyze my portfolio",
                                            search: "Search onchain activity", // This might need a form too, but for now text
                                            slippage: "Predict trade slippage"
                                        };
                                        const msg = actionMessages[action] || "";

                                        // Immediately send the message
                                        setInputValue("");
                                        setShowWelcome(false);
                                        setHasStartedChat(true);
                                        setPendingMessage(msg);
                                    }}
                                />
                            </div>

                            {/* Custom Input at Bottom - Match CopilotChat Input Design */}
                            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        if (inputValue?.trim()) {
                                            const message = inputValue.trim();
                                            setInputValue("");
                                            setShowWelcome(false);
                                            setHasStartedChat(true);
                                            setPendingMessage(message);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-3 bg-gray-100 rounded-full px-4 py-3 shadow-sm">
                                        {/* Sparkle Icon */}
                                        <Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0" />

                                        {/* Input Field */}
                                        <input
                                            type="text"
                                            value={inputValue || ""}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            placeholder="Ask Nova AI about your wallet, markets, or transactions..."
                                            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 placeholder-gray-500"
                                        />

                                        {/* Send Button */}
                                        <button
                                            type="submit"
                                            disabled={!inputValue?.trim()}
                                            className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-r from-purple-500 to-violet-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity shadow-md"
                                        >
                                            <Send className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <>

                            {/* CopilotChat - Only shown after welcome */}
                            <div className="flex-1 min-h-0 h-full overflow-hidden">
                                {hasStartedChat && (
                                    <CopilotChat
                                        className="h-full w-full"
                                        labels={{
                                            title: "Nova AI",
                                            initial: "",
                                            placeholder: "Tanya Nova AI tentang wallet atau crypto...",
                                        }}
                                        UserMessage={CustomUserMessage}
                                        Input={CustomChatInput}
                                        makeSystemMessage={() => ""}
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
                                )}
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}