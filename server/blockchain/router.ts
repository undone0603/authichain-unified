import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as thirdweb from "../thirdweb";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const blockchainRouter = router({
  status: publicProcedure.query(async () => {
    return await thirdweb.checkThirdwebConnection();
  }),
  uploadToIPFS: protectedProcedure.input(z.object({
    name: z.string(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    attributes: z.array(z.object({ trait_type: z.string(), value: z.union([z.string(), z.number()]) })).optional(),
  })).mutation(async ({ input }) => {
    const uri = await thirdweb.uploadMetadataToIPFS({
      name: input.name,
      description: input.description,
      image: input.imageUrl,
      attributes: input.attributes,
    });
    return { ipfsUri: uri };
  }),
  mintCertificateNFT: protectedProcedure.input(z.object({
    productId: z.number(),
    certificateNumber: z.string(),
    walletAddress: z.string(),
    contractAddress: z.string(),
    privateKey: z.string(),
    chainId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const product = await db.getProductById(input.productId);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    const cert = await db.getCertificateByNumber(input.certificateNumber);
    if (!cert) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
    const metadata = thirdweb.buildAuthCertificateMetadata({
      productName: product.name,
      productBrand: product.brand || undefined,
      productSerial: product.serialNumber || undefined,
      confidenceScore: 95,
      verificationDate: new Date().toISOString(),
      certificateNumber: input.certificateNumber,
      imageUrl: product.imageUrl || undefined,
      authenticatorId: ctx.user.id,
    });
    const result = await thirdweb.mintAuthenticationNFT({
      contractAddress: input.contractAddress,
      recipientAddress: input.walletAddress,
      metadata,
      privateKey: input.privateKey,
      chainId: input.chainId,
    });
    await db.logActivity({ userId: ctx.user.id, action: "nft_minted", entityType: "certificate", entityId: cert.id });
    return { transactionHash: result.transactionHash, metadataUri: result.metadataUri, chain: result.chain };
  }),
  mintNFT: protectedProcedure.input(z.object({
    name: z.string(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    walletAddress: z.string(),
    contractAddress: z.string(),
    privateKey: z.string(),
    chainId: z.number().optional(),
    attributes: z.array(z.object({ trait_type: z.string(), value: z.union([z.string(), z.number()]) })).optional(),
  })).mutation(async ({ ctx, input }) => {
    const result = await thirdweb.mintAuthenticationNFT({
      contractAddress: input.contractAddress,
      recipientAddress: input.walletAddress,
      metadata: {
        name: input.name,
        description: input.description,
        image: input.imageUrl,
        attributes: input.attributes,
      },
      privateKey: input.privateKey,
      chainId: input.chainId,
    });
    await db.logActivity({ userId: ctx.user.id, action: "nft_minted", entityType: "nft", entityId: 0 });
    return { transactionHash: result.transactionHash, metadataUri: result.metadataUri, chain: result.chain };
  }),
  getNFTBalance: publicProcedure.input(z.object({
    contractAddress: z.string(),
    walletAddress: z.string(),
    chainId: z.number().optional(),
  })).query(async ({ input }) => {
    const balance = await thirdweb.getNFTBalance(input.contractAddress, input.walletAddress, input.chainId);
    return { balance };
  }),
  getContractSupply: publicProcedure.input(z.object({
    contractAddress: z.string(),
    chainId: z.number().optional(),
  })).query(async ({ input }) => {
    const supply = await thirdweb.getContractTotalSupply(input.contractAddress, input.chainId);
    return { totalSupply: supply };
  }),
  getWalletNFTs: publicProcedure.input(z.object({
    contractAddress: z.string(),
    walletAddress: z.string(),
    chainId: z.number().optional(),
  })).query(async ({ input }) => {
    const nfts = await thirdweb.getWalletNFTs(input.contractAddress, input.walletAddress, input.chainId);
    return { nfts };
  }),
  deployedContract: publicProcedure.query(() => {
    const address = process.env.VITE_AUTHICHAIN_CONTRACT_ADDRESS || "";
    return {
      address,
      chainId: 80002,
      chain: "Polygon Amoy",
      explorer: address ? `https://amoy.polygonscan.com/address/${address}` : "",
      deployed: !!address,
    };
  }),
});
