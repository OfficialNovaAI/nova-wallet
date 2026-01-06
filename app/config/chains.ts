import {
    sepolia,
    mantleSepoliaTestnet,
    liskSepolia,
    mainnet,
    mantle,
    polygon,
    polygonAmoy,
    optimism,
    optimismSepolia,
    arbitrum,
    arbitrumSepolia,
    base,
    baseSepolia
} from 'wagmi/chains';

export const configuredChains = [
    sepolia,
    mantleSepoliaTestnet,
    liskSepolia,
    mainnet,
    mantle,
    polygon,
    polygonAmoy,
    optimism,
    optimismSepolia,
    arbitrum,
    arbitrumSepolia,
    base,
    baseSepolia
] as const;

export const supportedChains = [
    { id: mainnet.id, name: 'Ethereum', symbol: 'ETH' },
    { id: sepolia.id, name: 'Sepolia', symbol: 'ETH' },
    { id: mantle.id, name: 'Mantle', symbol: 'MNT' },
    { id: mantleSepoliaTestnet.id, name: 'Mantle Sepolia', symbol: 'MNT' },
    { id: liskSepolia.id, name: 'Lisk Sepolia', symbol: 'LSK' },
    { id: polygon.id, name: 'Polygon', symbol: 'MATIC' },
    { id: polygonAmoy.id, name: 'Polygon Amoy', symbol: 'MATIC' },
    { id: optimism.id, name: 'Optimism', symbol: 'ETH' },
    { id: optimismSepolia.id, name: 'OP Sepolia', symbol: 'ETH' },
    { id: arbitrum.id, name: 'Arbitrum One', symbol: 'ETH' },
    { id: arbitrumSepolia.id, name: 'Arb Sepolia', symbol: 'ETH' },
    { id: base.id, name: 'Base', symbol: 'ETH' },
    { id: baseSepolia.id, name: 'Base Sepolia', symbol: 'ETH' },
];
