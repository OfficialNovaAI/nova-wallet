export type Intent =
    | "GET_BALANCE"
    | "SEND"
    | "SWAP"
    | "UNKNOWN";

export type ParsedIntent = {
    intent: Intent;
    confidence: number;
    entities: {
        amount?: number;
        token?: string;
        toAddress?: string;
        chainId?: number;
        chainName?: string;
    };
};

const DEFAULT_CHAIN_ID = 5000; // Mantle Mainnet default

// Update keywords for Mantle
const chainKeywords: Record<number, string[]> = {
    5000: ["mantle", "mantle mainnet"],
    5003: ["mantle sepolia", "mantle testnet"],
    84532: ["base sepolia", "base testnet", "base"],
    11155420: ["optimism sepolia", "op sepolia", "optimism"],
    4202: ["lisk sepolia", "lisk testnet", "lisk"],
    421614: ["arbitrum sepolia", "arbitrum"],
    80002: ["polygon amoy", "amoy", "polygon"],
    11155111: ["eth sepolia", "sepolia", "ethereum testnet", "sepolia testnet"],
    1: ["ethereum", "mainnet", "eth"],
};

// Update tokens for Mantle ecosystem
const tokenKeywords: Record<string, string[]> = {
    MNT: ["mnt", "mantle"],
    ETH: ["eth", "ethereum"], // WETH on Mantle is common, but keep ETH for simplicity
    USDT: ["usdt", "tether"],
    USDC: ["usdc", "circle"],
};

const ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/;
const AMOUNT_REGEX = /(\d+(\.\d+)?)/;

const containsKeywords = (text: string, keywords: string[]) =>
    keywords.some((keyword) => text.includes(keyword));

const detectChain = (text: string): { chainId: number; chainName: string } => {
    const lowerText = text.toLowerCase();
    for (const [chainId, keywords] of Object.entries(chainKeywords)) {
        if (containsKeywords(lowerText, keywords)) {
            return { chainId: Number(chainId), chainName: keywords[0] };
        }
    }
    return { chainId: DEFAULT_CHAIN_ID, chainName: "Mantle Mainnet" };
};

const detectToken = (text: string): string | undefined => {
    const lowerText = text.toLowerCase();
    for (const [token, keywords] of Object.entries(tokenKeywords)) {
        if (containsKeywords(lowerText, keywords)) {
            return token;
        }
    }
    return undefined;
};

export const parseIntent = (message: string): ParsedIntent => {
    const lowerMessage = message.toLowerCase();

    const toAddress = message.match(ADDRESS_REGEX)?.[0];
    const amountMatch = message.match(AMOUNT_REGEX)?.[0];
    const amount = amountMatch ? Number(amountMatch) : undefined;
    const token = detectToken(message);
    const { chainId, chainName } = detectChain(message);

    let intent: Intent = "UNKNOWN";
    let confidence = 0.3;

    if (/saldo|balance|cek saldo|berapa/i.test(lowerMessage)) {
        intent = "GET_BALANCE";
        confidence = 0.95;
    } else if (/kirim|send|transfer/i.test(lowerMessage)) {
        intent = "SEND";
        confidence = 0.9;
    } else if (toAddress && amount) {
        // Implicit SEND intent: if message contains amount and address
        intent = "SEND";
        confidence = 0.8;
    } else if (/swap|tukar|convert/i.test(lowerMessage)) {
        intent = "SWAP";
        confidence = 0.7;
    }

    return {
        intent,
        confidence,
        entities: {
            amount,
            token,
            toAddress,
            chainId,
            chainName,
        },
    };
};
