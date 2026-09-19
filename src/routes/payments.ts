import { Hono } from 'hono';
import { PaymentService } from '../services/payment.service';

type Bindings = {
  DB: D1Database;
  PAYMENT_SECRET: string;
  PAYMENT_WEBHOOK_SECRET: string;
};

const payments = new Hono<{ Bindings: Bindings }>();

// Create payment order
payments.post('/create-order', async (c) => {
  const { userId, amount, planId, currency } = await c.req.json();
  
  if (!userId || !amount || !planId) {
    return c.json({ success: false, message: 'User ID, amount, and plan ID are required' }, 400);
  }
  
  const paymentService = new PaymentService(c.env.DB, c.env.PAYMENT_SECRET, c.env.PAYMENT_WEBHOOK_SECRET);
  
  try {
    const { orderId, paymentUrl } = await paymentService.createOrder({
      userId,
      amount,
      planId,
      currency: currency || 'INR',
    });
    
    return c.json({ success: true, orderId, paymentUrl });
  } catch (error) {
    return c.json({ success: false, message: 'Failed to create payment order' }, 500);
  }
});

// Verify payment and activate subscription
payments.post('/verify', async (c) => {
  const { orderId, paymentId, status } = await c.req.json();
  
  if (!orderId || !paymentId) {
    return c.json({ success: false, message: 'Order ID and payment ID are required' }, 400);
  }
  
  const paymentService = new PaymentService(c.env.DB, c.env.PAYMENT_SECRET, c.env.PAYMENT_WEBHOOK_SECRET);
  
  try {
    const verified = await paymentService.verifyPayment({
      orderId,
      paymentId,
      status: status || 'completed',
    });
    
    if (!verified) {
      return c.json({ success: false, message: 'Payment verification failed' }, 400);
    }
    
    // Get payment details to activate subscription
    const payment = await paymentService.getPaymentByOrderId(orderId);
    
    if (payment) {
      await paymentService.activateSubscription(payment.user_id as number, payment.plan_id as number);
    }
    
    return c.json({ success: true, message: 'Payment verified and subscription activated' });
  } catch (error) {
    return c.json({ success: false, message: 'Failed to verify payment' }, 500);
  }
});

// Payment webhook handler
payments.post('/webhook', async (c) => {
  const payload = await c.req.json();
  const signature = c.req.header('x-webhook-signature') || '';
  
  const paymentService = new PaymentService(c.env.DB, c.env.PAYMENT_SECRET, c.env.PAYMENT_WEBHOOK_SECRET);
  
  try {
    const processed = await paymentService.handleWebhook(payload, signature);
    
    if (processed) {
      return c.json({ success: true, message: 'Webhook processed' });
    } else {
      return c.json({ success: false, message: 'Webhook processing failed' }, 400);
    }
  } catch (error) {
    return c.json({ success: false, message: 'Failed to process webhook' }, 500);
  }
});

// Get user payments
payments.get('/user/:userId', async (c) => {
  const userId = c.req.param('userId');
  
  const paymentService = new PaymentService(c.env.DB, c.env.PAYMENT_SECRET, c.env.PAYMENT_WEBHOOK_SECRET);
  const userPayments = await paymentService.getUserPayments(parseInt(userId));
  
  return c.json({ success: true, payments: userPayments });
});

export default payments;
