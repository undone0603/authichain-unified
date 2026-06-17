import * as db from "../db";
import { ICertificatesRepository } from "./types";

export class DbCertificatesRepository implements ICertificatesRepository {
  async getUserCertificates(userId: number): Promise<any[]> {
    return await db.getUserCertificates(userId);
  }
  async getCertificateByNumber(certificateNumber: string): Promise<any> {
    return await db.getCertificateByNumber(certificateNumber);
  }
  async getProductById(productId: number): Promise<any> {
    return await db.getProductById(productId);
  }
  async updateAuthenticationSharing(id: number, userId: number, isPublic: boolean, shareToken: string): Promise<void> {
    return await db.updateAuthenticationSharing(id, userId, isPublic, shareToken);
  }
  async getAuthenticationByShareToken(shareToken: string): Promise<any> {
    return await db.getAuthenticationByShareToken(shareToken);
  }
  async incrementShareCount(id: number): Promise<void> {
    return await db.incrementShareCount(id);
  }
}
