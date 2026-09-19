import { Hono } from 'hono';
import { AIService } from '../services/ai.service';

type Bindings = {
  DB: D1Database;
  AI_API_KEY: string;
};

const ai = new Hono<{ Bindings: Bindings }>();

// Create new AI session
ai.post('/sessions', async (c) => {
  const { userId, title } = await c.req.json();
  
  if (!userId) {
    return c.json({ success: false, message: 'User ID is required' }, 400);
  }
  
  const aiService = new AIService(c.env.DB, c.env.AI_API_KEY);
  const sessionId = await aiService.createSession(userId, title);
  
  return c.json({ success: true, sessionId }, 201);
});

// Chat with AI
ai.post('/chat', async (c) => {
  const { userId, sessionId, question } = await c.req.json();
  
  if (!userId || !question) {
    return c.json({ success: false, message: 'User ID and question are required' }, 400);
  }
  
  const aiService = new AIService(c.env.DB, c.env.AI_API_KEY);
  
  // Save user message
  if (sessionId) {
    await aiService.saveConversation(sessionId, 'user', question);
  }
  
  // Get student context
  const studentContext = await aiService.getStudentContext(userId);
  
  // Get conversation history if session exists
  let conversationHistory;
  if (sessionId) {
    conversationHistory = await aiService.getConversationHistory(sessionId);
  }
  
  // Generate AI response
  const response = await aiService.generateResponse({
    studentContext,
    question,
    conversationHistory,
  });
  
  // Save AI response
  if (sessionId) {
    await aiService.saveConversation(sessionId, 'assistant', response.answer);
  }
  
  return c.json({ success: true, answer: response.answer, usage: response.usage });
});

// Get session history
ai.get('/sessions/:id', async (c) => {
  const id = c.req.param('id');
  
  const aiService = new AIService(c.env.DB, c.env.AI_API_KEY);
  const messages = await aiService.getConversationHistory(parseInt(id));
  
  return c.json({ success: true, messages });
});

// Get user sessions
ai.get('/user/:userId/sessions', async (c) => {
  const userId = c.req.param('userId');
  
  const aiService = new AIService(c.env.DB, c.env.AI_API_KEY);
  const sessions = await aiService.getUserSessions(parseInt(userId));
  
  return c.json({ success: true, sessions });
});

export default ai;
