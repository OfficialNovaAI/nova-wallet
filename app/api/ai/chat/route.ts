import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { parseIntent } from "@/lib/intentParser";
import { isAddress as viemIsAddress } from "viem";

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
            throw new Error("Gagal mengambil saldo");
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

const SYSTEM_PROMPT = `Kamu adalah Nova AI, asisten crypto wallet yang ramah dan membantu (Specialized for Mantle Network). Kamu berbicara dalam Bahasa Indonesia yang natural dan mudah dipahami.

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
const checkBalanceFunction = {
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
};

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
    modelName: string = "gemini-2.5-flash"
) {
    const cleanKey = apiKey.trim();
    const encodedKey = encodeURIComponent(cleanKey);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodedKey}`;

    // console.log("[callGemini] URL Masked:", url.replace(encodedKey, "HIDDEN"));

    // Transform messages to Gemini format
    const contents = messages.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
    }));

    // Add tools config
    const toolsConfig = tools.length > 0 ? {
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

        // System Prompt Logic (simplified for brevity, ensuring context is passed)
        // Note: For multi-turn with history, usually we prepend system instruction or add to history.
        // Gemimi API supports `system_instruction` field in v1beta.

        // Let's reimplement constraints
        const resolvedChainId = body.walletContext?.chainId ?? parsedIntent.entities.chainId ?? 5003;

        // ... (Intent validation checks similar to before can be kept or simplified)

        console.log("[AI API] Processing message:", lastMessage.content);

        // Prepare initial validation response if needed (like GET_BALANCE without wallet)
        if (parsedIntent.intent === "GET_BALANCE" && !body.walletContext?.isConnected) {
            return NextResponse.json({ message: "Hubungkan wallet kamu dulu supaya aku bisa cek saldo di Mantle.", intent: parsedIntent });
        }

        // Build System Prompt Context
        let systemInstructionText = SYSTEM_PROMPT;
        if (body.walletContext?.isConnected) {
            systemInstructionText += `\n\nContext Wallet: Address=${body.walletContext.address}, Chain=${body.walletContext.chainId}`;
        }

        // We will prepend system prompt as the first message or use system_instruction if valid. 
        // Safer to just prepend to the first user message or keep it as context. 
        // Let's modify the `callGemini` to handle this? Or just prepend here.

        // Actually, just creating a new message array with the system prompt context as the first user part is robust.
        const augmentedMessages = [...body.messages];
        // Inject system prompt into the last message or first? 
        // Best practice: Prepend a "user" message with system instructions if "system" role isn't supported in standard messages.
        // Or better: Append context to the *last* message content.
        augmentedMessages[augmentedMessages.length - 1].content = `${systemInstructionText}\n\nUser Question: ${lastMessage.content}`;

        // Initial Call
        let geminiResponse = await callGemini(
            augmentedMessages,
            [checkBalanceFunction],
            apiKey
        );

        let candidate = geminiResponse.candidates?.[0];
        let parts = candidate?.content?.parts || [];

        // Function Calling Loop
        // Note: Manual loop implementation. 
        // 1. Check for functionCall in parts.
        // 2. If present, execute, append result to history, call API again.

        // For simplicity in this fix, let's look for the *first* function call.
        // Real implementation should handle multiple.

        const functionCallPart = parts.find((p: any) => p.functionCall);

        if (functionCallPart) {
            const fnCall = functionCallPart.functionCall;
            console.log("[AI API] Function Call:", fnCall.name);

            if (fnCall.name === "checkBalance") {
                const args = fnCall.args;
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

                // We need to send this result back to Gemini.
                // Construct the "function_response" message.
                // Note: The history must now include the ASSISTANT's tool_use message, then the USER's tool_response.

                // History update:
                // 1. Assistant message with functionCall
                const assistantToolMsg = {
                    role: "model",
                    parts: [{ functionCall: fnCall }] // Raw structure required?
                };

                // 2. User (or function) message with response
                // v1beta format: role: "function", parts: [{ functionResponse: ... }]
                // Wait, role "user" or "function"? Valid roles are "user" and "model".
                // Actually v1beta uses "function" role or "user" role with specific part?
                // Let's stick to the simplest: Add to user message? No.

                // Correct v1beta flow:
                // Model: parts: [{ functionCall: ... }]
                // User: parts: [{ functionResponse: { name: ..., response: ... } }]

                // We need to reconstruct the messages array for the 2nd call.
                // Since we handled existing messages, we just append to `augmentedMessages`.
                // Actually, `callGemini` transforms them. We need to pass raw objects that callGemini understands.
                // Let's hack: callGemini expects {role, content}. 
                // We need to update callGemini to accept complex parts or just handle the raw parts.

                // REFACTOR: Let's simply return the result text manually for now to break the loop safely,
                // OR do one properly structured recursive call.

                // Simplified Strategy:
                // Just return the balance data as text to the user? No, we want the AI to interpret it.
                // Let's do a second simple prompt with the data.

                const followUpContent = `System: Here is the result of checkBalance: ${JSON.stringify(functionResult)}. Please explain this to the user in Bahasa Indonesia contextually.`;

                augmentedMessages.push({ role: "assistant", content: "" }); // Placeholder for the tool call (skip internal detail)
                augmentedMessages.push({ role: "user", content: followUpContent });

                // Final answer generation
                geminiResponse = await callGemini(
                    augmentedMessages,
                    [], // No tools needed for summary
                    apiKey
                );

                candidate = geminiResponse.candidates?.[0];
                parts = candidate?.content?.parts || [];
            }
        }

        const finalText = parts.map((p: any) => p.text).join("");

        return NextResponse.json({
            message: finalText,
            intent: parsedIntent,
        });

    } catch (error: any) {
        console.error("[AI API] Manual Fetch Error:", error);

        // Use default intent if parsedIntent is not available (e.g. crash before parsing)
        const safeIntent = parsedIntent || { intent: "UNKNOWN", confidence: 0, entities: {} };
        const isConnected = !!body?.walletContext?.isConnected;

        const fallbackMessage = isConnected
            ? `Halo! Saya Nova AI. Maaf, ada kendala sistem. Error: ${error.message}. Cek saldo manual tersedia.`
            : `Halo! Saya Nova AI. Silakan hubungkan wallet. (Error: ${error.message})`;

        return NextResponse.json({
            message: fallbackMessage,
            intent: safeIntent,
            debug: { error: error.message }
        });
    }
}
