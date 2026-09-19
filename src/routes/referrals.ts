import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const referrals = new Hono<{ Bindings: Bindings }>();

// Get user referrals
referrals.get('/user/:userId', async (c) => {
  const userId = c.req.param('userId');
  
  const referrals = await c.env.DB.prepare(
    `SELECT r.*, u.name as referred_user_name 
     FROM referrals r 
     LEFT JOIN users u ON r.referred_user_id = u.id 
     WHERE r.referrer_id = ? 
     ORDER BY r.created_at DESC`
  ).bind(userId).all();
  
  return c.json({ success: true, referrals: referrals.results });
});

// Get referral stats
referrals.get('/stats/:userId', async (c) => {
  const userId = c.req.param('userId');
  
  const totalReferrals = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ? AND status = ?'
  ).bind(userId, 'completed').first();
  
  const pendingReferrals = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ? AND status = ?'
  ).bind(userId, 'pending').first();
  
  let tier = 'Bronze';
  const count = totalReferrals?.count || 0;
  if (count >= 25) tier = 'Legend';
  else if (count >= 10) tier = 'Silver';
  
  return c.json({ 
    success: true, 
    stats: {
      totalReferrals: count,
      pendingReferrals: pendingReferrals?.count || 0,
      tier
    }
  });
});

// Generate referral code
referrals.post('/generate', async (c) => {
  const { userId } = await c.req.json();
  
  const code = `APEX${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO referrals (referrer_id, code, status) VALUES (?, ?, ?)'
    ).bind(userId, code, 'pending').run();
    
    return c.json({ success: true, referralId: result.meta.last_row_id, code }, 201);
  } catch (error) {
    return c.json({ success: false, error: 'Failed to generate referral code' }, 400);
  }
});

// Validate referral code
referrals.get('/validate/:code', async (c) => {
  const code = c.req.param('code');
  
  const referral = await c.env.DB.prepare(
    'SELECT * FROM referrals WHERE code = ?'
  ).bind(code).first();
  
  if (!referral) {
    return c.json({ success: false, error: 'Invalid referral code' }, 404);
  }
  
  return c.json({ success: true, referral });
});

export default referrals;
