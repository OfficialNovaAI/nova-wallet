import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { configuredChains } from './chains';

export const config = getDefaultConfig({
  appName: 'Nova Wallet',
  projectId: 'nova-wallet-demo', // Replace with real WalletConnect project ID for production
  chains: configuredChains,
  ssr: false,
});

