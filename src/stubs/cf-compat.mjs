// CF Workers build stub — covers all import styles for incompatible packages.
// Routes using these packages return 500 at runtime; core app routes unaffected.
function noop() {}
class NoopClass {}

export default NoopClass;

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
export const Resend = NoopClass;

// drizzle-orm/postgres-js: import { drizzle } from 'drizzle-orm/postgres-js'
export const drizzle = () => ({});

// stripe, nodemailer, qrcode, jsqr: default imports — covered by export default NoopClass

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

// viem: import { createPublicClient } from 'viem'
export const createPublicClient = noop;
export const createWalletClient = noop;
export const http = noop;
export const parseEther = noop;
export const formatEther = noop;
