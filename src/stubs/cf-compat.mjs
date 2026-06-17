// CF Workers build stub — covers all import styles for incompatible packages.
// Routes using these packages return 500 at runtime; core app routes unaffected.
function noop() {}
// NoopComponent must be a plain function (not a class) so React can call it without `new`
function NoopComponent() { return null; }

export default NoopComponent;

// ethers: import { ethers } from 'ethers'
export const ethers = {};

// ai: import { streamText } from 'ai'
export const streamText = noop;
export const generateText = noop;
export const createStreamableValue = noop;

// @ai-sdk/openai: import { openai } from '@ai-sdk/openai'
export const openai = noop;
export const createOpenAI = noop;

// resend: import { Resend } from 'resend'
export const Resend = noop;

// drizzle-orm/postgres-js: import { drizzle } from 'drizzle-orm/postgres-js'
export const drizzle = () => ({});

// stripe, nodemailer, qrcode, jsqr: default imports — covered by export default NoopComponent

// thirdweb: import { createThirdwebClient, defineChain } from 'thirdweb'
export const createThirdwebClient = noop;
export const defineChain = noop;

// thirdweb/chains: import { baseSepolia, base, polygon, ethereum } from 'thirdweb/chains'
export const baseSepolia = {};
export const base = {};
export const polygon = {};
export const ethereum = {};
export const mainnet = {};
export const sepolia = {};

// viem named exports pulled by thirdweb internals (server-stubbed; routes 500 at runtime)
export const toEventHash = noop;
export const encodeEventTopics = noop;
export const decodeAbiParameters = noop;
export const encodeAbiParameters = noop;
export const decodeEventLog = noop;
export const parseAbi = noop;
export const getAddress = noop;
export const isAddress = noop;
export const keccak256 = noop;
export const toHex = noop;
export const toBytes = noop;

// thirdweb/wallets + extensions pulled server-side (routes 500 at runtime; core routes unaffected)
export const privateKeyToAccount = noop;
export const smartWallet = noop;
export const transfer = noop;
export const balanceOf = noop;
export const totalSupply = noop;
export const getOwnedNFTs = noop;
export const prepareContractCall = noop;
export const readContract = noop;
export const getNFT = noop;
export const claimTo = noop;

// thirdweb/react: React components must be plain functions, not classes
// ThirdwebProvider must pass through children — it wraps the entire page in layout.tsx
export const ConnectButton = NoopComponent;
export const useActiveAccount = noop;
export function ThirdwebProvider({ children }) { return children || null; }

// thirdweb/wallets: import { createWallet, inAppWallet, privateKeyAccount } from 'thirdweb/wallets'
export const createWallet = noop;
export const inAppWallet = noop;
export const privateKeyAccount = noop;

// thirdweb core (dynamic): getContract, sendTransaction
export const getContract = noop;
export const sendTransaction = noop;

// thirdweb/extensions/erc721 (dynamic): mintTo
export const mintTo = noop;

// viem: import { createPublicClient } from 'viem'
export const createPublicClient = noop;
export const createWalletClient = noop;
export const http = noop;
export const parseEther = noop;
export const formatEther = noop;
