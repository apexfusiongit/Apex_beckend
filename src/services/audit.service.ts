export interface AuditLog {
  userId: number;
  action: string;
  entityType: string;
  entityId: number;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async logAction(auditLog: AuditLog): Promise<number> {
    const { userId, action, entityType, entityId, details, ipAddress, userAgent } = auditLog;
    
    const result = await this.db.prepare(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, action, entityType, entityId, details || null, ipAddress || null, userAgent || null).run();
    
    return result.meta.last_row_id as number;
  }

  async getAuditLogs(filters?: {
    userId?: number;
    entityType?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let query = 'SELECT al.*, u.name as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1';
    const params: any[] = [];
    
    if (filters?.userId) {
      query += ' AND al.user_id = ?';
      params.push(filters.userId);
    }
    
    if (filters?.entityType) {
      query += ' AND al.entity_type = ?';
      params.push(filters.entityType);
    }
    
    if (filters?.action) {
      query += ' AND al.action = ?';
      params.push(filters.action);
    }
    
    query += ' ORDER BY al.created_at DESC';
    
    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    if (filters?.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }
    
    const logs = await this.db.prepare(query).bind(...params).all();
    
    return logs.results;
  }

  async getUserAuditLogs(userId: number, limit: number = 100): Promise<any[]> {
    return this.getAuditLogs({ userId, limit });
  }

  async getEntityAuditLogs(entityType: string, entityId: number, limit: number = 50): Promise<any[]> {
    let query = 'SELECT al.*, u.name as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE al.entity_type = ? AND al.entity_id = ? ORDER BY al.created_at DESC LIMIT ?';
    
    const logs = await this.db.prepare(query).bind(entityType, entityId, limit).all();
    
    return logs.results;
  }
}
