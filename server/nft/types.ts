export interface INftRepository {
  listNfts(input: { collectionId?: number; status?: string; limit: number }): Promise<any[]>;
  getNftById(id: number): Promise<any>;
  createNft(input: any): Promise<any>;
  logActivity(input: { userId: number; action: string; entityType: string; entityId: number }): Promise<void>;
  listCollections(): Promise<any[]>;
  getCollectionBySlug(slug: string): Promise<any>;
  createCollection(input: any): Promise<any>;
  getActiveAuctions(): Promise<any[]>;
  getAuctionById(id: number): Promise<any>;
  getAuctionBids(auctionId: number): Promise<any[]>;
  createAuction(input: any): Promise<any>;
  placeBid(auctionId: number, userId: number, amount: string): Promise<void>;
}
