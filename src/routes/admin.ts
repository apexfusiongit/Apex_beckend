import { Hono } from 'hono';
import { authMiddleware, requireAdmin, AuthContext } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  JWT_SECRET?: string;
};

type Variables = {
  auth?: { sub: string; email: string; role: string; exp: number };
};

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();
admin.use('*', authMiddleware, requireAdmin);

admin.get('/dashboard', async (c: AuthContext) => {
  const [users, signups, activeUsers, activity] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT COUNT(*) AS count FROM users'),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM signup_activity WHERE action_type = 'Signup'"),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE status = 'Active'"),
    c.env.DB.prepare(
      `SELECT sa.id, sa.user_id, sa.action_type, sa.timestamp, sa.device_type, sa.referral_source,
              u.first_name, u.last_name, u.email, u.role
       FROM signup_activity sa
       JOIN users u ON u.id = sa.user_id
       ORDER BY sa.timestamp DESC
       LIMIT 100`
    )
  ]);

  const totalUsers = (users.results[0] as { count?: number } | undefined)?.count ?? 0;
  const totalSignups = (signups.results[0] as { count?: number } | undefined)?.count ?? 0;
  const activeUserCount = (activeUsers.results[0] as { count?: number } | undefined)?.count ?? 0;

  return c.json({
    success: true,
    analytics: {
      totalUsers,
      totalSignups,
      activeUsers: activeUserCount
    },
    activity: activity.results
  });
});

export default admin;
