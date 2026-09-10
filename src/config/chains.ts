export const kiteChains = {
  mainnet: {
    id: 2366,
    name: "KiteAI Mainnet",
    rpc: "https://rpc.gokite.ai/",
    explorer: "https://kitescan.ai/",
    symbol: "KITE",
  },
  testnet: {
    id: 2368,
    name: "KiteAI Testnet",
    rpc: "https://rpc-testnet.gokite.ai/",
    explorer: "https://testnet.kitescan.ai/",
    symbol: "KITE",
  },
} as const;
