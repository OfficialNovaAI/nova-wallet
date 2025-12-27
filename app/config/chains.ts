import {
    sepolia,
    mantleSepoliaTestnet,
    baseSepolia,
    optimismSepolia,
    liskSepolia,
    polygonAmoy,
    arbitrumSepolia
} from 'wagmi/chains';

export const configuredChains = [
    sepolia,
    mantleSepoliaTestnet,
    baseSepolia,
    optimismSepolia,
    liskSepolia,
    polygonAmoy,
    arbitrumSepolia
] as const;

export const supportedChains = [
    { id: sepolia.id, name: 'Ethereum Sepolia', symbol: 'ETH' },
    { id: mantleSepoliaTestnet.id, name: 'Mantle Sepolia', symbol: 'MNT' },
    { id: baseSepolia.id, name: 'Base Sepolia', symbol: 'ETH' },
    { id: optimismSepolia.id, name: 'Optimism Sepolia', symbol: 'ETH' },
    { id: liskSepolia.id, name: 'Lisk Sepolia', symbol: 'ETH' },
    { id: polygonAmoy.id, name: 'Polygon Amoy', symbol: 'MATIC' },
    { id: arbitrumSepolia.id, name: 'Arbitrum Sepolia', symbol: 'ETH' },
];
