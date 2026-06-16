import * as db from "../db";
import { INftRepository } from "./types";

export class DbNftRepository implements INftRepository {
  async listNfts(input: { collectionId?: number; status?: string; limit: number }): Promise<any[]> {
    return await db.listNfts(input);
  }
  async getNftById(id: number): Promise<any> {
    return await db.getNftById(id);
  }
  async createNft(input: any): Promise<any> {
    return await db.createNft(input);
  }
  async logActivity(input: { userId: number; action: string; entityType: string; entityId: number }): Promise<void> {
    await db.logActivity(input);
  }
  async listCollections(): Promise<any[]> {
    return await db.listCollections();
  }
  async getCollectionBySlug(slug: string): Promise<any> {
    return await db.getCollectionBySlug(slug);
  }
  async createCollection(input: any): Promise<any> {
    return await db.createCollection(input);
  }
  async getActiveAuctions(): Promise<any[]> {
    return await db.getActiveAuctions();
  }
  async getAuctionById(id: number): Promise<any> {
    return await db.getAuctionById(id);
  }
  async getAuctionBids(auctionId: number): Promise<any[]> {
    return await db.getAuctionBids(auctionId);
  }
  async createAuction(input: any): Promise<any> {
    return await db.createAuction(input);
  }
  async placeBid(auctionId: number, userId: number, amount: string): Promise<void> {
    await db.placeBid(auctionId, userId, amount);
  }
}
