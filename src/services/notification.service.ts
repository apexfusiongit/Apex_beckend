export interface Notification {
  userId: number;
  title: string;
  message: string;
  type: 'enrollment' | 'test' | 'live_class' | 'payment' | 'general';
  link?: string;
}

export class NotificationService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async createNotification(notification: Notification): Promise<number> {
    const { userId, title, message, type, link } = notification;
    
    const result = await this.db.prepare(
      'INSERT INTO notifications (user_id, title, message, type, link, is_read) VALUES (?, ?, ?, ?, ?, 0)'
    ).bind(userId, title, message, type, link || null).run();
    
    return result.meta.last_row_id as number;
  }

  async createBulkNotifications(userIds: number[], notification: Omit<Notification, 'userId'>): Promise<void> {
    for (const userId of userIds) {
      await this.createNotification({ ...notification, userId });
    }
  }

  async getUserNotifications(userId: number, limit: number = 50): Promise<any[]> {
    const notifications = await this.db.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    ).bind(userId, limit).all();
    
    return notifications.results;
  }

  async getUnreadNotifications(userId: number): Promise<any[]> {
    const notifications = await this.db.prepare(
      'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC'
    ).bind(userId).all();
    
    return notifications.results;
  }

  async markAsRead(notificationId: number): Promise<boolean> {
    const result = await this.db.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ?'
    ).bind(notificationId).run();
    
    return result.meta.changes > 0;
  }

  async markAllAsRead(userId: number): Promise<boolean> {
    const result = await this.db.prepare(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ?'
    ).bind(userId).run();
    
    return result.meta.changes > 0;
  }

  async deleteNotification(notificationId: number): Promise<boolean> {
    const result = await this.db.prepare(
      'DELETE FROM notifications WHERE id = ?'
    ).bind(notificationId).run();
    
    return result.meta.changes > 0;
  }

  // Helper methods for common notification types
  async sendEnrollmentNotification(userId: number, courseTitle: string): Promise<number> {
    return this.createNotification({
      userId,
      title: 'Course Enrolled',
      message: `You have successfully enrolled in ${courseTitle}`,
      type: 'enrollment',
      link: '/courses',
    });
  }

  async sendTestCompletionNotification(userId: number, testTitle: string, score: number, totalMarks: number): Promise<number> {
    return this.createNotification({
      userId,
      title: 'Test Completed',
      message: `You scored ${score}/${totalMarks} in ${testTitle}`,
      type: 'test',
      link: '/tests',
    });
  }

  async sendLiveClassReminderNotification(userId: number, className: string, startTime: string): Promise<number> {
    return this.createNotification({
      userId,
      title: 'Live Class Reminder',
      message: `Live class "${className}" starts at ${startTime}`,
      type: 'live_class',
      link: '/live-classes',
    });
  }

  async sendPaymentSuccessNotification(userId: number, amount: number): Promise<number> {
    return this.createNotification({
      userId,
      title: 'Payment Successful',
      message: `Payment of ${amount} was successful. Your subscription is now active.`,
      type: 'payment',
      link: '/subscription',
    });
  }
}
