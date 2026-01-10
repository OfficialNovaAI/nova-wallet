# ⚡ Nova AI: The Intelligent Orchestrator for Your Crypto Wallets

> **"The AI Brain for Your Crypto Wallets. Chat, Transact, and Onboard Users Instantly on Lisk."**

---

## 🎯 Why Nova AI?

Nova AI addresses the urgent friction points preventing mass adoption on Lisk and the broader Web3 ecosystem:

* **Complex UX Barrier:** Traditional wallets require technical knowledge (chains, gas, RPCs). Users want to express *intents* ("Send money to 0x..."), not execute *commands*.
* **On-Ramp Friction in Emerging Markets:** Freelancers and businesses in regions like Indonesia struggle to receive crypto payments from non-crypto clients due to complex exchange processes.
* **Fragmented Data:** Users suffer from "Tab Fatigue"—switching between Wallet, Etherscan, and Gas Trackers just to make one informed decision.

---

## 💡 Our Solution: The AI Orchestration Layer

Nova AI is **not a new wallet**. It is an intelligent interface layer that sits on top of your existing wallets (MetaMask, Phantom, etc.), allowing you to interact with the Lisk blockchain using natural language.

![Nova AI Solution Overview](https://cdn.jsdelivr.net/gh/OfficialNovaAI/asset@main/solution.png)

---

## 💎 Key Features

We have built a suite of AI-powered modules designed for Real-World Utility, grouping 6 core capabilities into a unified experience.

### 1. Conversational Asset Management (Send & Receive)

The core of Nova AI is a chat-first interface. Instead of navigating menus, simply express your intent.
* **Send Instantly:** Type *"Send 10 LSK to 0x...."* and Nova constructs the transaction.
* **Easy Receive:** Ask *"Show my address"* or *"Receive assets"* to instantly generate your QR code and wallet details.
* **Wallet Agnostic:** Acts as an orchestrator for your existing MetaMask or EVM wallets.

### 2. Nova Paylink (Fiat-to-Crypto Bridge)

A "Real World Utility" feature designed for the gig economy.
* **Create Invoices:** Generate a payment link via chat command: *"Create paylink for 0.002 eth"*.
* **Global Settlement:** Integrated with **Transak** & **Midtrans**, allowing clients to pay in Fiat (IDR/USD) while you receive Crypto (USDT/LSK) directly.

### 3. Onchain Intelligence & Forecast

Nova AI doesn't just execute; it analyzes data to protect you.
* **Multi-Chain Portfolio:** Aggregates balances across Lisk and other EVM chains in a single view.
* **Onchain Search:** Ask questions like *"Check activity for address 0x..."* to understand wallet behaviors instantly.
* **Predict Slippage & Fees:** Before you confirm, AI analyzes market depth and network congestion to predict slippage and gas fees, preventing failed txs or overpayment.

---

## 🏗️ System Architecture

Nova AI operates on a **"Hexa-Core Agent System"** powered by CopilotKit and Lisk RPC. The architecture ensures that user intents are routed to specific specialized agents for maximum accuracy.

![System Architecture Diagram](https://cdn.jsdelivr.net/gh/OfficialNovaAI/asset@main/architecture.jpeg)

**How it works on Lisk:**
1. **User Input:** Natural language prompt enters the Router.
2. **Agent Selection:** Router activates the specific agent (e.g., Paylink Agent for invoices).
3. **Lisk Interaction:** Agents communicate with Lisk L2 RPC nodes (using viem/wagmi) to fetch data or prepare transaction objects.
4. **Response:** The UI renders a "Smart Card" (not just text) for the user to confirm the on-chain action.

![How it works](https://cdn.jsdelivr.net/gh/OfficialNovaAI/asset@main/how-it-works.png)

---

## 🗺️ Roadmap

We are building Nova AI with a clear path toward becoming the "Super App" for Lisk interaction.

![Nova AI Roadmap](https://github.com/OfficialNovaAI/asset/blob/main/roadmap.png?raw=true)

---

## 📊 Beta Tester SUS Score Result

![Nova AI Beta SUS Score](https://cdn.jsdelivr.net/gh/OfficialNovaAI/asset@main/tracktion.png)