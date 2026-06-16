export interface INotificationsRepository {
  getUserNotifications(userId: number, limit: number): Promise<any[]>;
  getUnreadNotificationCount(userId: number): Promise<number>;
  markNotificationRead(id: number, userId: number): Promise<void>;
  markAllNotificationsRead(userId: number): Promise<void>;
  deleteNotification(id: number, userId: number): Promise<void>;
  createNotification(data: any): Promise<any>;
}
