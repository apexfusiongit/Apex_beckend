type Bindings = {
  DB: D1Database;
  PAYMENT_SECRET: string;
  PAYMENT_WEBHOOK_SECRET: string;
};

export interface PaymentOrder {
  userId: number;
  amount: number;
  planId: number;
  currency?: string;
}

export interface PaymentVerification {
  orderId: string;
  paymentId: string;
  status: string;
}

export class PaymentService {
  private db: D1Database;
  private paymentSecret: string;
  private webhookSecret: string;

  constructor(db: D1Database, paymentSecret: string, webhookSecret: string) {
    this.db = db;
    this.paymentSecret = paymentSecret;
    this.webhookSecret = webhookSecret;
  }

  async createOrder(order: PaymentOrder): Promise<{ orderId: string; paymentUrl: string }> {
    const { userId, amount, planId, currency = 'INR' } = order;
    
    const orderId = `order_${Date.now()}_${userId}_${Math.random().toString(36).substring(7)}`;
    
    const result = await this.db.prepare(
      'INSERT INTO payments (user_id, order_id, amount, currency, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, orderId, amount, currency, 'pending').run();
    
    // In production, integrate with actual payment gateway (Razorpay, Stripe, etc.)
    // For now, return a mock payment URL
    const paymentUrl = this.generateMockPaymentUrl(orderId, amount, currency);
    
    return {
      orderId,
      paymentUrl,
    };
  }

  async verifyPayment(verification: PaymentVerification): Promise<boolean> {
    const { orderId, paymentId, status } = verification;
    
    // In production, verify with payment gateway using their API
    // For now, we'll trust the verification
    
    if (status !== 'completed') {
      return false;
    }
    
    const result = await this.db.prepare(
      'UPDATE payments SET payment_id = ?, status = ? WHERE order_id = ? AND status = ?'
    ).bind(paymentId, 'completed', orderId, 'pending').run();
    
    return result.meta.changes > 0;
  }

  async activateSubscription(userId: number, planId: number): Promise<number> {
    const plan = await this.getPlanDetails(planId);
    
    if (!plan) {
      throw new Error('Invalid plan');
    }
    
    const startDate = new Date();
    const endDate = new Date(startDate);
    
    // Calculate end date based on plan duration
    if (plan.duration === 'quarter') {
      endDate.setMonth(endDate.getMonth() + 3);
    } else if (plan.duration === 'year') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    
    const result = await this.db.prepare(
      'INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, planId, 'active', startDate.toISOString(), endDate.toISOString()).run();
    
    return result.meta.last_row_id as number;
  }

  async getPlanDetails(planId: number): Promise<{ id: number; name: string; price: number; duration: string } | null> {
    const plans = [
      { id: 1, name: 'Quarterly Pass', price: 300, duration: 'quarter' },
      { id: 2, name: 'Annual Merit Pass', price: 1200, duration: 'year' },
    ];
    
    return plans.find(p => p.id === planId) || null;
  }

  async handleWebhook(payload: any, signature: string): Promise<boolean> {
    // In production, verify webhook signature
    // const expectedSignature = this.generateHmac(payload, this.webhookSecret);
    // if (signature !== expectedSignature) {
    //   return false;
    // }
    
    const { orderId, paymentId, status, idempotencyKey } = payload;
    
    // Idempotency check: prevent processing the same webhook twice
    if (idempotencyKey) {
      const existingWebhook = await this.db.prepare(
        'SELECT id FROM payments WHERE order_id = ? AND payment_id = ? AND status = ?'
      ).bind(orderId, paymentId, 'completed').first();
      
      if (existingWebhook) {
        // Already processed, return success to acknowledge
        return true;
      }
    }
    
    if (status === 'completed' || status === 'success') {
      // Use transaction-like behavior with idempotency
      const payment = await this.db.prepare(
        'SELECT user_id, status FROM payments WHERE order_id = ?'
      ).bind(orderId).first();
      
      if (!payment) {
        return false;
      }
      
      // Only process if payment is still pending (idempotency)
      if (payment.status === 'pending') {
        const verified = await this.verifyPayment({ orderId, paymentId, status: 'completed' });
        
        if (verified && payment) {
          // Get plan_id from payment or default to annual
          const planId = 2; // Default to annual plan
          await this.activateSubscription(payment.user_id as number, planId);
        }
      }
    }
    
    return true;
  }

  private generateMockPaymentUrl(orderId: string, amount: number, currency: string): string {
    // In production, this would call the actual payment gateway API
    return `https://payment-gateway.example.com/pay?orderId=${orderId}&amount=${amount}&currency=${currency}`;
  }

  private generateHmac(payload: any, secret: string): string {
    // In production, implement proper HMAC signature verification
    return 'mock-signature';
  }

  async getUserPayments(userId: number): Promise<any[]> {
    const payments = await this.db.prepare(
      'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();
    
    return payments.results;
  }

  async getPaymentByOrderId(orderId: string): Promise<any> {
    const payment = await this.db.prepare(
      'SELECT * FROM payments WHERE order_id = ?'
    ).bind(orderId).first();
    
    return payment;
  }
}
