# Nova AI Wallet

> An **AI Agent for crypto wallet workflows**: chat, analyze, transact, and accept fiat payments without forcing users through complex wallet menus.

Nova AI Wallet is **not a new wallet** and not just a chatbot. It is an **agentic wallet orchestration layer** that sits on top of existing wallets such as MetaMask and WalletConnect-compatible EVM wallets. The agent understands user intent, chooses the right tool, fetches real wallet/on-chain/payment data, prepares safe next actions, and leaves final transaction signing to the connected wallet.

The product is Lisk-first, while the codebase already explores a broader multi-chain experience across Ethereum, Mantle, Polygon, Optimism, Arbitrum, Base, and testnets.

## Awards

Nova AI Wallet was recognized in the SEA Lisk Builders Challenge 3 and won two categories:

- **1st Notable Mention** - SEA Lisk Builders Challenge 3
- **1st Social Media Challenge**

![Nova AI Wallet Winner](./docs/assets/readme/winner.jpg)

![Nova AI Solution Overview](./docs/assets/readme/solution-overview.png)

## AI Agent Evidence

Nova was developed as an AI agent because it can reason over user intent, call tools, use external data, and prepare actions with guardrails. It is designed around an agent loop:

```mermaid
flowchart TD
    A["Natural-language user prompt"] --> B["Intent understanding"]
    B --> C["Tool / action selection"]
    C --> D["Live wallet, on-chain, payment, or cost data"]
    D --> E["Smart response, card, or form"]
    E --> F["User confirmation"]
    F --> G["Wallet signing / payment flow"]
```

Agent capabilities implemented in this repository:

- **Intent understanding:** maps natural-language prompts into wallet actions such as balance checks, transfers, swaps, and analysis.
- **Tool use:** calls balance, portfolio, token activity, whale activity, counterparty, payment, and cost prediction tools.
- **Live data grounding:** fetches blockchain, wallet, payment, and price/cost data before answering.
- **Generative UI:** returns smart cards, forms, and transaction previews instead of only plain text.
- **Human-in-the-loop safety:** prepares transactions but never signs or executes without explicit wallet confirmation.

Implementation evidence:

| Agent capability | Evidence in code |
|---|---|
| Intent parser | [`app/lib/intentParser.ts`](./app/lib/intentParser.ts) |
| CopilotKit tool/actions layer | [`app/chat/actions/useNovaActions.tsx`](./app/chat/actions/useNovaActions.tsx) |
| Manual LLM tool-calling route | [`app/api/ai/chat/route.ts`](./app/api/ai/chat/route.ts) |
| Copilot runtime endpoint | [`app/api/copilotkit/route.ts`](./app/api/copilotkit/route.ts) |
| On-chain analysis tools | [`app/lib/blockchainAgentWrapper.ts`](./app/lib/blockchainAgentWrapper.ts), [`app/lib/blockchain/aggregators`](./app/lib/blockchain/aggregators) |
| Wallet and transaction UX | [`app/chat/page.tsx`](./app/chat/page.tsx), [`app/components/chat`](./app/components/chat) |
| Fiat-to-crypto payment tools | [`app/lib/services/payment.service.ts`](./app/lib/services/payment.service.ts), [`app/lib/services/midtrans.service.ts`](./app/lib/services/midtrans.service.ts), [`app/lib/services/transak.service.ts`](./app/lib/services/transak.service.ts) |

## Why Nova

Most crypto wallets still assume users already understand networks, gas, addresses, bridges, explorers, token approvals, and transaction previews. Nova turns those workflows into natural-language conversations.

The core problem:

- **Wallet interfaces are too manual.** Even simple tasks like checking a balance or sending funds require several screens.
- **Addresses are hard to trust.** A raw `0x...` address tells users almost nothing before they send money.
- **On-chain data is powerful but unreadable.** Users jump between explorers, dashboards, and price tools just to answer one question.
- **Transaction costs are unclear.** Gas, route quality, fees, and slippage often appear too late.
- **Crypto payments are still hard for non-crypto clients.** Freelancers can receive crypto, but clients may only want to pay with fiat rails.

Nova's answer is simple: **an AI agent first, smart cards second, wallet signing only after explicit confirmation.**

## Core Features

### 1. AI Agent Wallet Interface

Users can ask Nova to check balances, explain concepts, prepare transactions, or analyze wallet activity in plain language. Nova behaves like a crypto workflow agent: it chooses the right action, fetches the required data, and returns a safe next step.

Example prompts:

- `Cek saldo aku di Mantle Sepolia`
- `Analyze address 0xd8dA...`
- `Kirim 0.01 ETH ke 0x...`
- `Berapa gas yang sudah aku habiskan?`

Nova parses intent, calls the right data source or action, then renders a readable response or an embedded transaction card.

### 2. Portfolio and On-Chain Intelligence

Nova helps users understand wallet behavior, not just raw balances.

Supported analysis areas in the current codebase:

- Native token balance checks
- Portfolio overview
- Token activity and P&L style summaries
- Transaction statistics
- Whale activity detection
- Counterparty and interaction analysis

### 3. Smart Cost Prediction

Nova includes an execution-cost prediction flow for trade cost, slippage, and exchange comparison. The companion API documentation lives in [`api.md`](./api.md).

Use cases:

- Estimate real execution cost before a trade
- Compare venues such as Binance, Kraken, Coinbase, and OKX
- Explain slippage and fees in user-friendly language

### 4. Nova Paylink

Nova Paylink lets freelancers and creators generate a payment link where clients pay in fiat and the receiver gets crypto.

Payment rails:

- **Indonesia:** QRIS via Midtrans
- **Global:** Card/on-ramp flow via Transak

Example prompt:

```text
Buat paylink 0.1 ETH
```

Nova opens a payment form, creates the payment request, and shows a payment status card.

## AI Agent Architecture

Nova uses a chat-first agent architecture where the AI layer chooses the right action, fetches real blockchain or payment data, and returns a human-readable answer or UI card.

![System Architecture Diagram](./docs/assets/readme/system-architecture.jpeg)

How the flow works:

1. **User prompt:** The user asks a natural-language question or command.
2. **Agent reasoning:** Nova classifies intent and decides which capability is needed.
3. **Tool/API call:** The agent fetches wallet, chain, payment, or prediction data.
4. **Smart response:** Nova renders the result as chat text, cards, forms, or transaction previews.
5. **Human approval:** Transactions are never executed without explicit user confirmation through the connected wallet.

![How Nova Works](./docs/assets/readme/how-it-works.png)

## Tech Stack

- **Frontend:** Next.js App Router, React, Tailwind CSS, Radix UI, shadcn-style components
- **Wallet:** Wagmi, Viem, RainbowKit, WalletConnect
- **AI Agent:** CopilotKit actions, Gemini-based tool-calling route, custom intent parsing, generative UI cards
- **Blockchain:** RPC reads, Etherscan/Blockscout-style clients, custom on-chain aggregators
- **Payments:** Prisma, PostgreSQL, Midtrans QRIS, Transak
- **Utilities:** Zod, Axios, Upstash rate limiting, Recharts

## Key Screens and Flows

### Chat-to-Transact

```text
User: Kirim 0.01 ETH ke 0x...
Nova: Cek saldo dan network dulu.
Nova: Menampilkan transaction preview.
User: Confirm.
Wallet: User signs the transaction.
```

### On-Chain Research

```text
User: Analyze address 0x...
Nova: Mengambil portfolio, transaksi besar, counterparty, dan statistik.
Nova: Menampilkan ringkasan yang bisa dibaca manusia.
```

### Create Paylink

```text
User: Buat paylink 500 ribu
Nova: Menanyakan token dan wallet penerima.
Nova: Membuat payment link.
Client: Membayar via QRIS atau Transak.
Nova: Menampilkan status pembayaran sampai selesai.
```

## Roadmap

Nova is being shaped into an AI agent wallet experience: first as a chat-to-action interface, then as an intelligence layer, and eventually as an automation layer for crypto workflows.

![Nova AI Roadmap](./docs/assets/readme/roadmap.png)

## Validation

The project includes early usability framing and beta testing references in the product documentation.

![Nova AI Beta SUS Score](./docs/assets/readme/beta-sus-score.png)

## Documentation

- [`Nova_Wallet_UI_UX_PRD_v2.md`](./Nova_Wallet_UI_UX_PRD_v2.md) - full product and UX requirement document
- [`api.md`](./api.md) - trade execution cost predictor API guide
- [`prisma/schema.prisma`](./prisma/schema.prisma) - payment and webhook database schema

## Local Development

```bash
npm install
npm run dev
```

For production-style flows, configure the required environment variables for database, AI, wallet/RPC providers, Midtrans, Transak, and rate limiting.

## Current Focus

Nova's strongest product direction is:

> **An AI Agent for users who want to understand and act on crypto without opening five different tools first.**

The most important next polish areas are payment reliability, clearer production/demo separation, faster on-chain analysis, and tighter README/demo assets.
