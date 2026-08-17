/**
 * Thirdweb Blockchain Service
 * Server-side integration for NFT minting, contract interactions,
 * and on-chain authentication verification.
 */
import { createThirdwebClient, getContract, defineChain } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { mintTo, balanceOf, totalSupply, getOwnedNFTs } from "thirdweb/extensions/erc721";
import { upload } from "thirdweb/storage";
import { sendTransaction } from "thirdweb";
import { ENV } from "./_core/env";
// ─── Client Initialization ──────────────────────────────────────────────────
let _client = null;
export function getThirdwebClient() {
    if (!_client) {
        const secretKey = ENV.thirdwebSecretKey;
        if (!secretKey) {
            throw new Error("Thirdweb secret key not configured. Set thirdweb_api_key env var.");
        }
        _client = createThirdwebClient({ secretKey });
    }
    return _client;
}
export async function getConnectionStatus() {
    try {
        const client = getThirdwebClient();
        return { connected: !!client, clientId: ENV.thirdwebClientId };
    }
    catch {
        return { connected: false, clientId: "" };
    }
}
// ─── Chain Configuration ────────────────────────────────────────────────────
// Using Polygon for low-cost NFT minting (production)
// Amoy testnet for development
export const CHAINS = {
    polygon: defineChain(137),
    polygonAmoy: defineChain(80002),
    ethereum: defineChain(1),
    sepolia: defineChain(11155111),
    base: defineChain(8453),
    baseSepolia: defineChain(84532),
};
// Default to Polygon Amoy testnet for development, Polygon mainnet for production
export function getDefaultChain() {
    return ENV.isProduction ? CHAINS.polygon : CHAINS.polygonAmoy;
}
export function getAuthiChainContract(config) {
    const client = getThirdwebClient();
    const chain = config.chainId ? defineChain(config.chainId) : getDefaultChain();
    return getContract({
        client,
        chain,
        address: config.address,
    });
}
async function uploadFileToIPFS(file) {
    const client = getThirdwebClient();
    const uri = await upload({ client, files: [file] });
    return typeof uri === "string" ? uri : uri[0];
}
export async function uploadToIPFS(data) {
    const file = typeof data === "string"
        ? new File([data], "data.json", { type: "application/json" })
        : data;
    return uploadFileToIPFS(file);
}
export async function uploadImageToIPFS(imageBuffer, filename) {
    return uploadFileToIPFS(new File([new Uint8Array(imageBuffer)], filename, { type: "image/png" }));
}
export async function uploadMetadataToIPFS(metadata) {
    return uploadFileToIPFS(new File([JSON.stringify(metadata)], "metadata.json", { type: "application/json" }));
}
export async function mintAuthenticationNFT(params) {
    const client = getThirdwebClient();
    const chain = params.chainId ? defineChain(params.chainId) : getDefaultChain();
    const contract = getContract({ client, chain, address: params.contractAddress });
    const account = privateKeyToAccount({ client, privateKey: params.privateKey });
    // Upload metadata to IPFS first
    const metadataUri = await uploadMetadataToIPFS(params.metadata);
    // Mint the NFT
    const transaction = mintTo({
        contract,
        to: params.recipientAddress,
        nft: {
            name: params.metadata.name,
            description: params.metadata.description,
            image: params.metadata.image,
            external_url: params.metadata.external_url,
            attributes: params.metadata.attributes,
            properties: params.metadata.properties,
        },
    });
    const result = await sendTransaction({ transaction, account });
    return {
        transactionHash: result.transactionHash,
        metadataUri,
        chain: chain.id,
    };
}
// ─── Read Operations ────────────────────────────────────────────────────────
export async function getNFTBalance(contractAddress, walletAddress, chainId) {
    const client = getThirdwebClient();
    const chain = chainId ? defineChain(chainId) : getDefaultChain();
    const contract = getContract({ client, chain, address: contractAddress });
    const balance = await balanceOf({ contract, owner: walletAddress });
    return balance.toString();
}
export async function getContractTotalSupply(contractAddress, chainId) {
    const client = getThirdwebClient();
    const chain = chainId ? defineChain(chainId) : getDefaultChain();
    const contract = getContract({ client, chain, address: contractAddress });
    const supply = await totalSupply({ contract });
    return supply.toString();
}
export async function getWalletNFTs(contractAddress, walletAddress, chainId) {
    const client = getThirdwebClient();
    const chain = chainId ? defineChain(chainId) : getDefaultChain();
    const contract = getContract({ client, chain, address: contractAddress });
    const nfts = await getOwnedNFTs({ contract, owner: walletAddress });
    return nfts;
}
export function buildAuthCertificateMetadata(data) {
    return {
        name: `AuthiChain Certificate: ${data.productName}`,
        description: `Blockchain-verified authentication certificate for ${data.productBrand ? data.productBrand + " " : ""}${data.productName}. Verified with ${data.confidenceScore}% confidence by AuthiChain AI on ${data.verificationDate}.`,
        image: data.imageUrl,
        external_url: `https://authichain.com/certificate/${data.certificateNumber}`,
        attributes: [
            { trait_type: "Product", value: data.productName },
            ...(data.productBrand ? [{ trait_type: "Brand", value: data.productBrand }] : []),
            ...(data.productSerial ? [{ trait_type: "Serial Number", value: data.productSerial }] : []),
            { trait_type: "Confidence Score", value: data.confidenceScore },
            { trait_type: "Verification Date", value: data.verificationDate },
            { trait_type: "Certificate Number", value: data.certificateNumber },
            { trait_type: "Verification Method", value: "AI Image Analysis + Blockchain" },
            { trait_type: "Platform", value: "AuthiChain" },
        ],
        properties: {
            authichain_version: "2.0",
            verification_engine: "AuthiChain AI v2",
        },
        authichain_certificate: data.certificateNumber,
        authichain_product_id: data.authenticatorId,
        authichain_confidence_score: data.confidenceScore,
        authichain_verification_date: data.verificationDate,
    };
}
export function buildSupplyChainMetadata(data) {
    return {
        name: `Supply Chain Event: ${data.eventType} - ${data.productName}`,
        description: `Supply chain verification event for ${data.productName}. Event: ${data.eventType} at ${data.location} by ${data.handler}.`,
        attributes: [
            { trait_type: "Event Type", value: data.eventType },
            { trait_type: "Location", value: data.location },
            { trait_type: "Handler", value: data.handler },
            { trait_type: "Timestamp", value: data.timestamp },
            ...(data.previousHash ? [{ trait_type: "Previous Hash", value: data.previousHash }] : []),
            { trait_type: "Platform", value: "AuthiChain" },
        ],
    };
}
// ─── Thirdweb Status Check ──────────────────────────────────────────────────
export async function checkThirdwebConnection() {
    try {
        const client = getThirdwebClient();
        const chain = getDefaultChain();
        return {
            connected: true,
            clientId: ENV.thirdwebClientId || "configured",
            chain: ENV.isProduction ? "Polygon Mainnet (137)" : "Polygon Amoy Testnet (80002)",
        };
    }
    catch (error) {
        return {
            connected: false,
            clientId: "",
            chain: "",
            error: error.message,
        };
    }
}
