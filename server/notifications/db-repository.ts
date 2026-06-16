import * as db from "../db";
import { INotificationsRepository } from "./types";

export class DbNotificationsRepository implements INotificationsRepository {
  async getUserNotifications(userId: number, limit: number): Promise<any[]> {
    return await db.getUserNotifications(userId, limit);
  }
  async getUnreadNotificationCount(userId: number): Promise<number> {
    return await db.getUnreadNotificationCount(userId);
  }
  async markNotificationRead(id: number, userId: number): Promise<void> {
    await db.markNotificationRead(id, userId);
  }
  async markAllNotificationsRead(userId: number): Promise<void> {
    await db.markAllNotificationsRead(userId);
  }
  async deleteNotification(id: number, userId: number): Promise<void> {
    await db.deleteNotification(id, userId);
  }
  async createNotification(data: any): Promise<any> {
    return await db.createNotification(data);
  }
}
