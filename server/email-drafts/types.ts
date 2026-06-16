export interface IEmailDraftsRepository {
  getPendingDrafts(): Promise<any[]>;
  createEmailDraft(data: any): Promise<any>;
  updateDraftStatus(id: number, status: string, userId: number): Promise<void>;
}
