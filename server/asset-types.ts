export interface IAssetRepository {
  getProductById(productId: number): Promise<any>;
  updateProductAssets(productId: number, data: any): Promise<void>;
  enqueueFailedTask(task: any): Promise<void>;
  getPendingTasks(): Promise<any[]>;
  updateTaskStatus(id: number, status: string): Promise<void>;
  incrementTaskRetry(id: number): Promise<void>;
}
