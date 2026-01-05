import {
    sepolia,
    mantleSepoliaTestnet,
    liskSepolia,
    mainnet,
    mantle,
} from 'wagmi/chains';

export const configuredChains = [
    sepolia,
    mantleSepoliaTestnet,
    liskSepolia,
    mainnet,
    mantle,
] as const;

export const supportedChains = [
    { id: sepolia.id, name: 'ETH Sepolia', symbol: 'ETH' },
    { id: mantleSepoliaTestnet.id, name: 'Mantle Sepolia', symbol: 'MNT' },
    { id: liskSepolia.id, name: 'Lisk Sepolia', symbol: 'LSK' },
    { id: mainnet.id, name: 'Ethereum Mainnet', symbol: 'ETH' },
    { id: mantle.id, name: 'Mantle Mainnet', symbol: 'MNT' },
];
