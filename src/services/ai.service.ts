type Bindings = {
  DB: D1Database;
  AI_API_KEY: string;
};

interface StudentContext {
  userId: number;
  class?: string;
  subjects?: string[];
  recentActivity?: any[];
  weakTopics?: string[];
}

interface AIRequest {
  studentContext: StudentContext;
  question: string;
  conversationHistory?: Array<{ role: string; message: string }>;
}

interface AIResponse {
  answer: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export class AIService {
  private apiKey: string;
  private db: D1Database;

  constructor(db: D1Database, apiKey: string) {
    this.db = db;
    this.apiKey = apiKey;
  }

  async getStudentContext(userId: number): Promise<StudentContext> {
    const user = await this.db.prepare(
      'SELECT id, name, email, role, class FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      throw new Error('User not found');
    }

    // Get recent enrollments to determine subjects
    const enrollments = await this.db.prepare(
      `SELECT c.subject_id, s.name as subject_name 
       FROM enrollments e 
       LEFT JOIN courses c ON e.course_id = c.id 
       LEFT JOIN subjects s ON c.subject_id = s.id 
       WHERE e.user_id = ?`
    ).bind(userId).all();

    const subjects = enrollments.results.map((e: any) => e.subject_name);

    // Get recent test attempts to identify weak topics
    const attempts = await this.db.prepare(
      `SELECT a.*, t.title as test_title 
       FROM attempts a 
       LEFT JOIN tests t ON a.test_id = t.id 
       WHERE a.user_id = ? 
       ORDER BY a.completed_at DESC 
       LIMIT 5`
    ).bind(userId).all();

    const weakTopics = attempts.results
      .filter((a: any) => a.score < 60)
      .map((a: any) => a.test_title);

    return {
      userId,
      class: user.class as string,
      subjects,
      recentActivity: attempts.results,
      weakTopics,
    };
  }

  async generateResponse(request: AIRequest): Promise<AIResponse> {
    // In production, this would call an actual AI provider (OpenAI, Anthropic, etc.)
    // For now, we'll return a mock response
    
    const { studentContext, question, conversationHistory } = request;

    // Build context-aware prompt
    let contextPrompt = `You are an AI tutor for a student in class ${studentContext.class || 'unknown'}.`;
    
    if (studentContext.subjects && studentContext.subjects.length > 0) {
      contextPrompt += ` The student is studying: ${studentContext.subjects.join(', ')}.`;
    }
    
    if (studentContext.weakTopics && studentContext.weakTopics.length > 0) {
      contextPrompt += ` The student needs help with: ${studentContext.weakTopics.join(', ')}.`;
    }

    // Mock response - in production, call actual AI API
    const mockAnswer = this.generateMockResponse(question, studentContext);

    return {
      answer: mockAnswer,
      usage: {
        promptTokens: 100,
        completionTokens: 150,
        totalTokens: 250,
      },
    };
  }

  private generateMockResponse(question: string, context: StudentContext): string {
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('math') || lowerQuestion.includes('calculate')) {
      return `I'd be happy to help you with that math problem! Let me break it down step by step. First, let's identify what we're solving for, then we can work through the solution together. Can you show me what you've tried so far?`;
    }
    
    if (lowerQuestion.includes('science') || lowerQuestion.includes('physics') || lowerQuestion.includes('chemistry')) {
      return `Great question about science! Let me explain this concept in a way that relates to real-world examples. The key principle here is understanding how these concepts apply to everyday situations. Would you like me to give you a specific example?`;
    }
    
    if (lowerQuestion.includes('help') || lowerQuestion.includes('stuck')) {
      return `I understand you're feeling stuck. That's completely normal! Let's work through this together. First, can you tell me which part of the problem is confusing you? We can tackle it one step at a time.`;
    }
    
    return `That's an excellent question! Based on your studies in ${context.subjects?.join(', ') || 'various subjects'}, I can help you understand this better. Let me explain the concept clearly and then we can practice with some examples. What specific aspect would you like to focus on?`;
  }

  async saveConversation(sessionId: number, role: string, message: string): Promise<void> {
    await this.db.prepare(
      'INSERT INTO ai_messages (session_id, role, message) VALUES (?, ?, ?)'
    ).bind(sessionId, role, message).run();
  }

  async getConversationHistory(sessionId: number): Promise<Array<{ role: string; message: string }>> {
    const messages = await this.db.prepare(
      'SELECT role, message FROM ai_messages WHERE session_id = ? ORDER BY created_at'
    ).bind(sessionId).all();

    return messages.results.map((m: any) => ({
      role: m.role,
      message: m.message,
    }));
  }

  async createSession(userId: number, title?: string): Promise<number> {
    const result = await this.db.prepare(
      'INSERT INTO ai_sessions (user_id, title) VALUES (?, ?)'
    ).bind(userId, title || 'New Conversation').run();

    return result.meta.last_row_id as number;
  }

  async getUserSessions(userId: number): Promise<any[]> {
    const sessions = await this.db.prepare(
      'SELECT * FROM ai_sessions WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(userId).all();

    return sessions.results;
  }
}
