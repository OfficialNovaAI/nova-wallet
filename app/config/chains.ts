import {
    sepolia,
    mantleSepoliaTestnet,
    liskSepolia,
} from 'wagmi/chains';

export const configuredChains = [
    sepolia,
    mantleSepoliaTestnet,
    liskSepolia,
] as const;

export const supportedChains = [
    { id: sepolia.id, name: 'ETH Sepolia', symbol: 'ETH' },
    { id: mantleSepoliaTestnet.id, name: 'Mantle Sepolia', symbol: 'MNT' },
    { id: liskSepolia.id, name: 'Lisk Sepolia', symbol: 'LSK' },
];
