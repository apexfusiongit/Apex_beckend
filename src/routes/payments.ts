import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  JWT_SECRET?: string;
  PAYMENT_KEY_ID?: string;
  PAYMENT_SECRET?: string;
  PAYMENT_WEBHOOK_SECRET?: string;
  PAYMENT_MODE?: string;
};
type Variables = { userId: number; userEmail: string; userRole: string };
type Plan = { id: number; name: string; amount_paise: number; currency: string; active: number };
type StoredPayment = {
  user_id: number; order_id: string; amount: number; currency: string; status: string;
  subscription_id: number | null; payment_id: string | null;
};
type RazorpayPayment = {
  id: string; order_id: string; amount: number; currency: string; status: string;
};

const payments = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const verifyInput = z.object({
  razorpay_order_id: z.string().min(8).max(100),
  razorpay_payment_id: z.string().min(8).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
});
const PLAN_NAME = 'Apex Fusion Student Plan';

function checkoutAvailable(env: Bindings): boolean {
  const mode = env.PAYMENT_MODE?.toLowerCase() === 'live' ? 'live' : 'test';
  return Boolean(env.PAYMENT_KEY_ID && env.PAYMENT_SECRET && new RegExp(`^rzp_${mode}_[A-Za-z0-9]+$`).test(env.PAYMENT_KEY_ID));
}

function toHex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function razorpayRequest<T>(c: { env: Bindings }, path: string, init?: RequestInit): Promise<T> {
  const { PAYMENT_KEY_ID: keyId, PAYMENT_SECRET: keySecret } = c.env;
  if (!keyId || !keySecret || !checkoutAvailable(c.env)) throw new Error('Payment checkout is not configured for the selected mode.');
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Basic ${btoa(`${keyId}:${keySecret}`)}`);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text();
    console.error('Razorpay API request failed', response.status, detail.slice(0, 500));
    throw new Error('The payment provider could not complete the request.');
  }
  return response.json() as Promise<T>;
}

async function getStudentPlan(db: D1Database): Promise<Plan | null> {
  return db.prepare('SELECT id, name, amount_paise, currency, active FROM subscription_plans WHERE name = ? AND active = 1 LIMIT 1')
    .bind(PLAN_NAME).first<Plan>();
}

payments.get('/config', async (c) => {
  const plan = await getStudentPlan(c.env.DB);
  return c.json({ success: true, data: {
    checkoutEnabled: checkoutAvailable(c.env) && plan?.amount_paise === 30000 && plan.currency === 'INR',
    mode: c.env.PAYMENT_MODE?.toLowerCase() === 'live' ? 'live' : 'test',
  } });
});

async function activatePayment(db: D1Database, payment: StoredPayment, providerPayment: RazorpayPayment): Promise<void> {
  const update = db.prepare(
    `UPDATE payments SET status = 'completed', payment_id = ?, provider = 'razorpay'
     WHERE order_id = ? AND user_id = ? AND amount = ? AND currency = ? AND status IN ('pending', 'completed')
       AND (payment_id IS NULL OR payment_id = ?)`
  ).bind(providerPayment.id, payment.order_id, payment.user_id, payment.amount, payment.currency, providerPayment.id);
  const plan = await getStudentPlan(db);
  if (!plan) throw new Error('The student plan is unavailable.');

  // D1 batches are transactional. The subscription_id gate prevents a repeated
  // browser verification or a duplicate/different webhook event from adding time twice.
  const insertSubscription = db.prepare(
    `INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date)
     SELECT ?, ?, 'active',
       COALESCE((SELECT MAX(end_date) FROM subscriptions WHERE user_id = ? AND status = 'active' AND end_date > datetime('now')), datetime('now')),
       datetime(COALESCE((SELECT MAX(end_date) FROM subscriptions WHERE user_id = ? AND status = 'active' AND end_date > datetime('now')), datetime('now')), '+1 month')
     WHERE EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND user_id = ? AND status = 'completed' AND payment_id = ? AND subscription_id IS NULL)`
  ).bind(payment.user_id, plan.id, payment.user_id, payment.user_id, payment.order_id, payment.user_id, providerPayment.id);
  const enrollInActiveCourses = db.prepare(
    `INSERT OR IGNORE INTO enrollments (user_id, course_id, status)
     SELECT ?, id, 'active' FROM courses WHERE lower(status) = 'active'`
  ).bind(payment.user_id);
  const reactivateEnrollments = db.prepare(
    `UPDATE enrollments SET status = 'active', enrolled_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND course_id IN (SELECT id FROM courses WHERE lower(status) = 'active')`
  ).bind(payment.user_id);
  const linkSubscription = db.prepare(
    `UPDATE payments SET subscription_id = (
       SELECT id FROM subscriptions WHERE user_id = ? AND plan_id = ? ORDER BY id DESC LIMIT 1
     ) WHERE order_id = ? AND user_id = ? AND payment_id = ? AND status = 'completed' AND subscription_id IS NULL`
  ).bind(payment.user_id, plan.id, payment.order_id, payment.user_id, providerPayment.id);
  const audit = db.prepare(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     SELECT ?, 'payment.completed', 'payment', id, ? FROM payments
     WHERE order_id = ? AND user_id = ? AND status = 'completed' AND subscription_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM audit_logs WHERE action = 'payment.completed' AND entity_type = 'payment' AND entity_id = payments.id)`
  ).bind(payment.user_id, JSON.stringify({ provider: 'razorpay', paymentId: providerPayment.id }), payment.order_id, payment.user_id);
  await db.batch([update, insertSubscription, enrollInActiveCourses, reactivateEnrollments, linkSubscription, audit]);
  const activated = await db.prepare(
    `SELECT 1 FROM payments p JOIN subscriptions s ON s.id = p.subscription_id
     WHERE p.order_id = ? AND p.user_id = ? AND p.status = 'completed' AND p.payment_id = ? AND s.status = 'active' LIMIT 1`
  ).bind(payment.order_id, payment.user_id, providerPayment.id).first();
  if (!activated) throw new Error('Payment could not be linked to an active subscription.');
}

async function validateCapturedPayment(c: { env: Bindings }, orderId: string, paymentId: string, expectedAmount: number, expectedCurrency: string): Promise<RazorpayPayment> {
  const providerPayment = await razorpayRequest<RazorpayPayment>(c, `/payments/${encodeURIComponent(paymentId)}`);
  if (providerPayment.id !== paymentId || providerPayment.order_id !== orderId ||
      providerPayment.amount !== expectedAmount || providerPayment.currency !== expectedCurrency ||
      providerPayment.status !== 'captured') {
    throw new Error('The payment has not been captured for this order and amount.');
  }
  return providerPayment;
}

payments.get('/subscription/status', authMiddleware, requireRole('student'), async (c) => {
  const subscription = await c.env.DB.prepare(
    `SELECT s.id, s.status, s.start_date, s.end_date, p.name AS plan_name, p.amount_paise, p.currency
     FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
     WHERE s.user_id = ? AND s.status = 'active' AND s.end_date > datetime('now')
     ORDER BY s.end_date DESC LIMIT 1`
  ).bind(c.get('userId')).first();
  return c.json({ success: true, data: { active: Boolean(subscription), subscription: subscription ?? null } });
});

payments.get('/history', authMiddleware, requireRole('student'), async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT id, order_id, payment_id, amount, currency, status, created_at
     FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
  ).bind(c.get('userId')).all();
  return c.json({ success: true, data: result.results });
});

payments.post('/create-order', authMiddleware, requireRole('student'), async (c) => {
  if (!checkoutAvailable(c.env)) {
    return c.json({ success: false, message: 'Online checkout is temporarily unavailable.' }, 503);
  }
  const plan = await getStudentPlan(c.env.DB);
  if (!plan || plan.amount_paise !== 30000 || plan.currency !== 'INR') {
    return c.json({ success: false, message: 'The student plan is not configured for checkout.' }, 503);
  }
  const userId = c.get('userId');
  const pending = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM payments WHERE user_id = ? AND status = 'pending' AND created_at > datetime('now', '-1 day')`
  ).bind(userId).first<{ count: number }>();
  if ((pending?.count ?? 0) >= 5) return c.json({ success: false, message: 'Too many pending checkout attempts. Try again later.' }, 429);

  const receipt = `af-${userId}-${crypto.randomUUID().split('-').join('').slice(0, 20)}`;
  try {
    const order = await razorpayRequest<{ id: string; amount: number; currency: string; status: string }>(c, '/orders', {
      method: 'POST', body: JSON.stringify({ amount: plan.amount_paise, currency: plan.currency, receipt, notes: { plan_id: String(plan.id), user_id: String(userId) } }),
    });
    if (!order.id || order.amount !== plan.amount_paise || order.currency !== plan.currency) {
      throw new Error('The payment provider returned an invalid order.');
    }
    await c.env.DB.prepare(
      `INSERT INTO payments (user_id, order_id, amount, status, provider, currency)
       VALUES (?, ?, ?, 'pending', 'razorpay', ?)`
    ).bind(userId, order.id, plan.amount_paise / 100, plan.currency).run();
    await c.env.DB.prepare(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       SELECT ?, 'payment.order_created', 'payment', id, ? FROM payments WHERE order_id = ? AND user_id = ?`
    ).bind(userId, JSON.stringify({ provider: 'razorpay', amountPaise: plan.amount_paise }), order.id, userId).run();
    return c.json({ success: true, data: { orderId: order.id, amount: order.amount, currency: order.currency, keyId: c.env.PAYMENT_KEY_ID, planName: plan.name } }, 201);
  } catch (error) {
    console.error('Payment order creation failed', error instanceof Error ? error.message : 'unknown error');
    return c.json({ success: false, message: 'Could not start checkout. Please try again.' }, 502);
  }
});

payments.post('/verify', authMiddleware, requireRole('student'), async (c) => {
  const parsed = verifyInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, message: 'Invalid payment verification details.' }, 400);
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;
  const payment = await c.env.DB.prepare(
    'SELECT user_id, order_id, amount, currency, status, subscription_id, payment_id FROM payments WHERE order_id = ? AND user_id = ?'
  ).bind(orderId, c.get('userId')).first<StoredPayment>();
  if (!payment) return c.json({ success: false, message: 'Checkout order was not found for this account.' }, 404);
  if (!checkoutAvailable(c.env)) return c.json({ success: false, message: 'Payment verification is not configured.' }, 503);

  const expected = await hmacHex(c.env.PAYMENT_SECRET, `${orderId}|${paymentId}`);
  if (!safeEqual(expected, signature.toLowerCase())) return c.json({ success: false, message: 'Payment signature is invalid.' }, 400);
  if (payment.status === 'completed' && payment.payment_id === paymentId && payment.subscription_id) {
    return c.json({ success: true, data: { verified: true, alreadyProcessed: true } });
  }
  try {
    const providerPayment = await validateCapturedPayment(c, orderId, paymentId, Math.round(payment.amount * 100), payment.currency);
    await activatePayment(c.env.DB, payment, providerPayment);
    const subscription = await c.env.DB.prepare('SELECT status, start_date, end_date FROM subscriptions WHERE id = (SELECT subscription_id FROM payments WHERE order_id = ?)')
      .bind(orderId).first();
    if (!subscription) return c.json({ success: false, message: 'Payment was captured, but subscription activation needs support.' }, 500);
    return c.json({ success: true, data: { verified: true, subscription } });
  } catch (error) {
    console.error('Payment verification failed', error instanceof Error ? error.message : 'unknown error');
    return c.json({ success: false, message: 'Payment is not captured yet. If you were charged, wait briefly and refresh your subscription status.' }, 409);
  }
});

// Razorpay webhooks are signed with the separate webhook secret. This route
// deliberately does not use session auth; the raw request body is signature checked.
payments.post('/webhook', async (c) => {
  const secret = c.env.PAYMENT_WEBHOOK_SECRET;
  const signature = c.req.header('X-Razorpay-Signature');
  const eventId = c.req.header('X-Razorpay-Event-Id');
  if (!secret || !signature || !eventId || eventId.length > 100) {
    return c.json({ success: false, message: 'Webhook verification is not configured.' }, 503);
  }
  const rawBody = await c.req.text();
  const expected = await hmacHex(secret, rawBody);
  if (!safeEqual(expected, signature.toLowerCase())) return c.json({ success: false, message: 'Invalid webhook signature.' }, 400);
  let event: {
    event?: string;
    payload?: { payment?: { entity?: RazorpayPayment }; order?: { entity?: { id?: string; amount_paid?: number; currency?: string } } };
  };
  try { event = JSON.parse(rawBody); } catch { return c.json({ success: false, message: 'Invalid webhook payload.' }, 400); }

  const prior = await c.env.DB.prepare('SELECT event_id FROM payment_webhook_events WHERE event_id = ?').bind(eventId).first();
  if (prior) return c.json({ success: true, data: { received: true, duplicate: true } });

  const providerPayment = event.payload?.payment?.entity;
  const orderId = providerPayment?.order_id ?? event.payload?.order?.entity?.id ?? null;
  const paymentId = providerPayment?.id ?? null;
  try {
    if ((event.event === 'payment.captured' || event.event === 'order.paid') && providerPayment) {
      const payment = await c.env.DB.prepare(
        'SELECT user_id, order_id, amount, currency, status, subscription_id, payment_id FROM payments WHERE order_id = ?'
      ).bind(providerPayment.order_id).first<StoredPayment>();
      if (payment) {
        if (providerPayment.amount !== Math.round(payment.amount * 100) || providerPayment.currency !== payment.currency || providerPayment.status !== 'captured') {
          return c.json({ success: false, message: 'Captured payment does not match the stored order.' }, 400);
        }
        // Re-fetch from Razorpay before granting access; the webhook signature
        // authenticates delivery while the API response confirms captured state.
        const confirmed = await validateCapturedPayment(c, payment.order_id, providerPayment.id, Math.round(payment.amount * 100), payment.currency);
        await activatePayment(c.env.DB, payment, confirmed);
      }
    }
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO payment_webhook_events (event_id, event_type, order_id, payment_id) VALUES (?, ?, ?, ?)'
    ).bind(eventId, event.event ?? 'unknown', orderId, paymentId).run();
    return c.json({ success: true, data: { received: true } });
  } catch (error) {
    console.error('Payment webhook processing failed', error instanceof Error ? error.message : 'unknown error');
    return c.json({ success: false, message: 'Webhook could not be processed; provider should retry.' }, 500);
  }
});

export default payments;
