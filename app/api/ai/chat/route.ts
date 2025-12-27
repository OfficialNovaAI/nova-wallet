import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { parseIntent } from "@/lib/intentParser";
import { isAddress as viemIsAddress } from "viem";

import { supportedChains } from "../../../config/chains";

// GoogleGenerativeAI initialization moved to POST handler

// Function untuk check balance
async function checkBalance(address: string, chainId: number) {
    try {
        const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/wallet/balance`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ address, chainId }),
            },
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Gagal mengambil saldo");
        }

        return await response.json();
    } catch (error) {
        console.error("[checkBalance] error", error);
        throw error;
    }
}

type ChatRequestBody = {
    messages: Array<{
        role: "user" | "assistant";
        content: string;
    }>;
    walletContext?: {
        address: string;
        chainId: number;
        balance?: string; // Balance dari UI (WalletContext)
        isConnected: boolean;
    };
};

const SUPPORTED_CHAINS_LIST = supportedChains.map(c => `- ${c.name} (Chain ID: ${c.id})`).join("\n");

const SYSTEM_PROMPT = `Kamu adalah Nova AI, asisten crypto wallet yang ramah dan membantu. Kamu berbicara dalam Bahasa Indonesia yang natural dan mudah dipahami.

Jaringan yang didukung saat ini:
${SUPPORTED_CHAINS_LIST}

PENTING:
- Jika user bertanya tentang saldo di chain yang ada di list di atas, kamu BISA mengeceknya.
- Jika user bertanya tentang chain yang TIDAK ada di list, jelaskan bahwa saat ini belum didukung.

Tugas kamu:
1. Bantu user cek saldo wallet mereka dengan memanggil function checkBalance ketika user bertanya tentang saldo
2. Jelaskan informasi crypto dengan bahasa sederhana, terutama tentang ekosistem Mantle
3. Validasi transaksi sebelum execute (jangan pernah execute tanpa konfirmasi user)

PENTING - Format Jawaban Saldo:
- SELALU sebutkan chain name (misalnya "di Mantle Mainnet", "di Mantle Sepolia", "di Ethereum Mainnet")
- SELALU gunakan tokenSymbol dari response checkBalance (bisa ETH atau MNT)
- Format: "Saldo kamu adalah X [tokenSymbol] di [chainName]"
- Jangan pernah hanya bilang "saldo kamu X ETH" tanpa mention chain-nya

Contoh jawaban yang BENAR:
- "Saldo kamu adalah 450 MNT di Mantle Mainnet" (kalau tokenSymbol = MNT)
- "Saldo kamu adalah 0.007 ETH di Ethereum Mainnet" (kalau tokenSymbol = ETH)
- "Saldo kamu adalah 0 MNT di Mantle Sepolia"

Contoh jawaban yang SALAH:
- "Saldo kamu adalah 0.38 ETH" (tidak mention chain)
- "Saldo kamu 0.38" (tidak mention token dan chain)

Catatan tentang Token:
- Function checkBalance mengembalikan saldo NATIVE TOKEN dari chain tersebut
- Response akan include "tokenSymbol" (ETH untuk Ethereum, MNT untuk Mantle) dan "tokenName"
- SELALU gunakan tokenSymbol dari response, jangan hardcode "ETH"
- Untuk Mantle Network & Mantle Sepolia: native token = MNT
- Untuk Ethereum Mainnet: native token = ETH
- Belum termasuk ERC-20 tokens (USDT, USDC, dll) - itu fitur lanjutan
- Jika user tanya tentang token lain (USDT, USDC), jelaskan bahwa untuk sekarang kita hanya cek native token

Ingat:
- Selalu gunakan Bahasa Indonesia
- Jelaskan dengan bahasa yang mudah dipahami
- Ketika user bertanya tentang saldo, gunakan function checkBalance
- Function checkBalance akan mengembalikan data saldo dari blockchain + comparison dengan UI
- Jika ada field "comparison" di response checkBalance:
  * Kalau "matches: false" dan ada "reason", jelaskan ke user kenapa berbeda (misalnya chain berbeda, atau perbedaan kecil karena timing refresh)
  * Kalau "matches: true", cukup kasih tahu saldo tanpa perlu mention comparison
- Jangan pernah execute transaksi tanpa konfirmasi eksplisit dari user
- Kalau user belum connect wallet, ingatkan mereka untuk connect dulu`;

// Function schema untuk Gemini
const tools = [
    {
        name: "checkBalance",
        description: "Cek saldo wallet di blockchain tertentu",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                address: {
                    type: SchemaType.STRING as const,
                    description: "Alamat wallet yang ingin dicek saldonya",
                },
                chainId: {
                    type: SchemaType.NUMBER as const,
                    description: "Chain ID blockchain (contoh: 5000 untuk Mantle Mainnet, 5003 untuk Mantle Sepolia)",
                },
            },
            required: ["address", "chainId"],
        },
    },
    {
        name: "prepareTransaction",
        description: "Siapkan data transaksi untuk mengirim koin/token dari user ke orang lain. Panggil ini jika user ingin kirim/transfer.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                toAddress: {
                    type: SchemaType.STRING as const,
                    description: "Alamat wallet tujuan (harus 0x...)",
                },
                amount: {
                    type: SchemaType.NUMBER as const,
                    description: "Jumlah yang ingin dikirim (contoh: 0.1)",
                },
                chainId: {
                    type: SchemaType.NUMBER as const,
                    description: "Chain ID network tujuan",
                },
            },
            required: ["toAddress", "amount", "chainId"],
        },
    }
];

interface PrepareSendParams {
    fromAddress: string;
    toAddress: string;
    amount: number;
    chainId: number;
}

const GAS_LIMIT = 21000;
const DEFAULT_GAS_PRICE_GWEI = 0.001; // Mantle gas fees are very low

const isValidAddress = (address: string) =>
    viemIsAddress(address as `0x${string}`);

const formatNumber = (value: number) =>
    Number.isFinite(value) ? value.toFixed(6) : "0";

const estimateGasCost = (gasPriceGwei = DEFAULT_GAS_PRICE_GWEI) => {
    const gasPriceEth = gasPriceGwei / 1e9;
    return gasPriceEth * GAS_LIMIT;
};

const prepareSendTransaction = async ({
    fromAddress,
    toAddress,
    amount,
    chainId,
}: PrepareSendParams) => {
    const issues: string[] = [];

    if (!isValidAddress(toAddress)) {
        issues.push("Alamat tujuan tidak valid. Pastikan formatnya 0x...");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        issues.push("Jumlah yang ingin dikirim harus lebih besar dari 0.");
    }

    const balanceData = await checkBalance(fromAddress, chainId);
    const tokenSymbol = balanceData.tokenSymbol || "MNT";
    const chainName = balanceData.formattedChainName;
    const chainIdResolved = balanceData.chainId || chainId;
    const balanceValue = parseFloat(balanceData.balanceEth);
    const hasBalance = Number.isFinite(balanceValue)
        ? balanceValue >= amount
        : false;

    if (!hasBalance) {
        issues.push(
            `Saldo kamu di ${chainName} hanya ${balanceData.balanceEth} ${tokenSymbol}.`,
        );
    }

    const gasEstimateEth = estimateGasCost();
    const totalEstimate = amount + gasEstimateEth;

    return {
        success: issues.length === 0,
        preview: {
            fromAddress,
            toAddress,
            amount,
            amountFormatted: `${formatNumber(amount)} ${tokenSymbol}`,
            tokenSymbol,
            chainId: chainIdResolved,
            chainName,
            gasEstimate: `${formatNumber(gasEstimateEth)} ${tokenSymbol}`,
            totalEstimate: `${formatNumber(totalEstimate)} ${tokenSymbol}`,
        },
        validations: {
            hasBalance,
            issues,
        },
    };
};

// Helper to call Gemini API via fetch
async function callGemini(
    messages: ChatRequestBody["messages"],
    tools: any[],
    apiKey: string,
    modelName: string = "gemma-3-27b-it"
) {
    const cleanKey = apiKey.trim();
    const encodedKey = encodeURIComponent(cleanKey);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodedKey}`;

    // Transform messages to Gemini format
    const contents = messages.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
    }));

    // Gemma models do not support native tools yet via API
    const isGemma = modelName.toLowerCase().includes("gemma");
    const toolsConfig = (!isGemma && tools.length > 0) ? {
        function_declarations: tools
    } : undefined;

    const payload = {
        contents,
        tools: toolsConfig ? [toolsConfig] : undefined
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        const maskedUrl = url.replace(encodedKey, "HIDDEN");
        const keyDebug = `Len:${cleanKey.length} Prx:${cleanKey.substring(0, 4)}`;
        throw new Error(`Gemini API Error: ${response.status} - ${errorText}. URL: ${maskedUrl} KeyDeb: ${keyDebug}`);
    }

    return await response.json();
}

export async function POST(request: Request) {
    let body: ChatRequestBody | undefined;
    let parsedIntent: any;

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY belum diset");
        }

        body = (await request.json()) as ChatRequestBody;

        if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
            return NextResponse.json(
                { error: "Messages wajib berupa array yang tidak kosong." },
                { status: 400 },
            );
        }

        const lastMessage = body.messages[body.messages.length - 1];
        parsedIntent = parseIntent(lastMessage.content);

        const resolvedChainId = body.walletContext?.chainId ?? parsedIntent.entities.chainId ?? 5003;

        console.log("[AI API] Processing message:", lastMessage.content);

        if (parsedIntent.intent === "GET_BALANCE" && !body.walletContext?.isConnected) {
            return NextResponse.json({ message: "Hubungkan wallet kamu dulu supaya aku bisa cek saldo di Mantle.", intent: parsedIntent });
        }

        // Build System Prompt Context
        let systemInstructionText = SYSTEM_PROMPT;

        // Add ReAct Instructions for Gemma
        // We always add this for robustness if native tools fail or are disabled
        systemInstructionText += `
        
ATURAN KHUSUS UNTUK MEMANGGIL FUNCTION (TOOL CALLING):
Kamu memiliki akses ke tools berikut:
1. checkBalance(address: string, chainId: number) - Cek saldo wallet.
2. prepareTransaction(toAddress: string, amount: number, chainId: number) - Siapkan transaksi kirim uang.

JIKA user meminta sesuatu yang membutuhkan tool tersebut (misal: "cek saldo", "kirim token"), JANGAN LANGSUNG MENJAWAB.
Sebaliknya, keluarkan output JSON valid di dalam blok kode \`\`\`json\`\`\` seperti ini:

\`\`\`json
{
  "tool": "checkBalance",
  "args": {
    "address": "0x...",
    "chainId": 5003
  }
}
\`\`\`

Atau untuk transaksi:
\`\`\`json
{
  "tool": "prepareTransaction",
  "args": {
    "toAddress": "0x...",
    "amount": 0.1,
    "chainId": 5003
  }
}
\`\`\`

Tunggu user (system) memberikan hasil eksekusi tool tersebut sebelum menjawab final.
`;

        if (body.walletContext?.isConnected) {
            systemInstructionText += `\n\nContext Wallet: Address=${body.walletContext.address}, Chain=${body.walletContext.chainId}`;
        }

        const augmentedMessages = [...body.messages];
        augmentedMessages[augmentedMessages.length - 1].content = `${systemInstructionText}\n\nUser Question: ${lastMessage.content}`;

        // Initial Call
        let geminiResponse = await callGemini(
            augmentedMessages,
            tools,
            apiKey,
            "gemma-3-27b-it" // Explicitly using user's choice
        );

        let candidate = geminiResponse.candidates?.[0];
        let parts = candidate?.content?.parts || [];
        let transactionPreviewData: any = null;

        // Function Calling Logic (Hybrid: Native + Text Parse)
        let functionCallData = null;
        let functionCallPart = parts.find((p: any) => p.functionCall);

        // 1. Try Native Function Call
        if (functionCallPart) {
            functionCallData = {
                name: functionCallPart.functionCall.name,
                args: functionCallPart.functionCall.args
            };
        }
        // 2. Try Text-based JSON parsing (for Gemma)
        else {
            const fullText = parts.map((p: any) => p.text).join("");
            const jsonMatch = fullText.match(/```json\s*({[\s\S]*?})\s*```/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[1]);
                    if (parsed.tool && parsed.args) {
                        console.log("[AI API] Detected Text-based Tool Call:", parsed.tool);
                        functionCallData = {
                            name: parsed.tool,
                            args: parsed.args
                        };
                    }
                } catch (e) {
                    console.log("[AI API] JSON Parse Error in ReAct:", e);
                }
            }
        }

        if (functionCallData) {
            const { name, args } = functionCallData;
            console.log("[AI API] Executing Function:", name);

            if (name === "checkBalance") {
                const targetAddress = args.address ?? body.walletContext?.address;
                const targetChainId = args.chainId ?? resolvedChainId;

                let functionResult;
                if (!targetAddress) {
                    functionResult = { error: "Address not available" };
                } else {
                    try {
                        functionResult = await checkBalance(targetAddress, targetChainId);
                    } catch (e: any) {
                        functionResult = { error: e.message };
                    }
                }

                const followUpContent = `System: Result of tool ${name}: ${JSON.stringify(functionResult)}. usage_metadata: { matches: ${functionResult.comparison?.matches} }. Explain this to user.`;
                augmentedMessages.push({ role: "assistant", content: "" }); // Dummy assistant msg to maintain turn order if needed, or better:
                // Actually, for ReAct, we treat the previous response (with the JSON) as the assistant's turn.
                // We should append the assistant's request message.
                // But `augmentedMessages` is just the input array.
                // We need to simulate: User -> Assistant (JSON request) -> User (System Result) -> Assistant (Final Answer)

                // For native tools, Gemini handles 'function_response'. For text, we allow normal turns.
                augmentedMessages.push({ role: "assistant", content: parts.map((p: any) => p.text).join("") });
                augmentedMessages.push({ role: "user", content: followUpContent });

                geminiResponse = await callGemini(
                    augmentedMessages,
                    [], // No tools needed for follow up usually, or keep them if multi-step
                    apiKey,
                    "gemma-3-27b-it"
                );

            } else if (name === "prepareTransaction") {
                if (!body.walletContext?.isConnected) {
                    const followUpContent = `System: User is not connected. Tell them to connect wallet first.`;
                    augmentedMessages.push({ role: "assistant", content: parts.map((p: any) => p.text).join("") });
                    augmentedMessages.push({ role: "user", content: followUpContent });
                    geminiResponse = await callGemini(augmentedMessages, [], apiKey, "gemma-3-27b-it");
                } else {
                    const fromAddress = body.walletContext.address;
                    const result = await prepareSendTransaction({
                        fromAddress,
                        toAddress: args.toAddress,
                        amount: args.amount,
                        chainId: args.chainId
                    });

                    if (result.success) {
                        transactionPreviewData = result;
                        const followUpContent = `System: Transaction prepared. Preview: ${JSON.stringify(result.preview)}. Ask user to confirm.`;
                        augmentedMessages.push({ role: "assistant", content: parts.map((p: any) => p.text).join("") });
                        augmentedMessages.push({ role: "user", content: followUpContent });
                        geminiResponse = await callGemini(augmentedMessages, [], apiKey, "gemma-3-27b-it");
                    } else {
                        const followUpContent = `System: Failed. Issues: ${result.validations.issues.join(", ")}. Explain to user.`;
                        augmentedMessages.push({ role: "assistant", content: parts.map((p: any) => p.text).join("") });
                        augmentedMessages.push({ role: "user", content: followUpContent });
                        geminiResponse = await callGemini(augmentedMessages, [], apiKey, "gemma-3-27b-it");
                    }
                }
            }

            // Re-fetch parts
            candidate = geminiResponse.candidates?.[0];
            parts = candidate?.content?.parts || [];
        }

        const finalText = parts.map((p: any) => p.text).join("");
        // Clean up JSON block from final text if it was the tool call itself? 
        // Actually, the FINAL text comes from the SECOND call (after system result), which should be natural language.
        // The FIRST call (with JSON) was pushed to history.

        return NextResponse.json({
            message: finalText,
            intent: parsedIntent,
            transactionPreview: transactionPreviewData,
        });

    } catch (error: any) {
        console.error("[AI API] Manual Fetch Error:", error);
        const safeIntent = parsedIntent || { intent: "UNKNOWN", confidence: 0, entities: {} };
        const isConnected = !!body?.walletContext?.isConnected;

        const fallbackMessage = isConnected
            ? `Halo! Saya Nova AI (Gemma). Maaf, ada kendala sistem. Error: ${error.message}.`
            : `Halo! Saya Nova AI (Gemma). Silakan hubungkan wallet. (Error: ${error.message})`;

        return NextResponse.json({
            message: fallbackMessage,
            intent: safeIntent,
            debug: { error: error.message }
        });
    }
}
