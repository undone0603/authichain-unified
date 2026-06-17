export interface ICertificatesRepository {
  getUserCertificates(userId: number): Promise<any[]>;
  getCertificateByNumber(certificateNumber: string): Promise<any>;
  getProductById(productId: number): Promise<any>;
  updateAuthenticationSharing(id: number, userId: number, isPublic: boolean, shareToken: string): Promise<void>;
  getAuthenticationByShareToken(shareToken: string): Promise<any>;
  incrementShareCount(id: number): Promise<void>;
}
