import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const leads = new Hono<{ Bindings: Bindings }>();

// Create lead
leads.post('/', async (c) => {
  const { name, email, phone, role, class: studentClass, schoolName } = await c.req.json();
  
  const result = await c.env.DB.prepare(
    'INSERT INTO leads (name, email, phone, role, class, school_name, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(name, email, phone, role, studentClass, schoolName, 'pending').run();
  
  return c.json({ success: true, leadId: result.meta.last_row_id }, 201);
});

// Get all leads (admin)
leads.get('/', async (c) => {
  const leads = await c.env.DB.prepare(
    'SELECT * FROM leads ORDER BY created_at DESC'
  ).all();
  
  return c.json({ success: true, leads: leads.results });
});

export default leads;
