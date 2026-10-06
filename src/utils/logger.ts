/**
 * Enhanced logging utility for Apex Fusion Backend
 * Provides structured logging for debugging, monitoring, and audit trails
 */

export interface LogContext {
  userId?: number;
  userEmail?: string;
  userRole?: string;
  action?: string;
  entityType?: string;
  entityId?: number;
  duration?: number;
  [key: string]: any;
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Logs an event with structured context
 */
export function logEvent(
  level: LogLevel,
  message: string,
  context: LogContext = {}
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  // In production, this could be sent to a logging service
  // For now, we use console with structured output
  switch (level) {
    case LogLevel.ERROR:
      console.error(JSON.stringify(logEntry));
      break;
    case LogLevel.WARN:
      console.warn(JSON.stringify(logEntry));
      break;
    case LogLevel.DEBUG:
      console.debug(JSON.stringify(logEntry));
      break;
    default:
      console.log(JSON.stringify(logEntry));
  }
}

/**
 * Logs R2 bucket operations
 */
export function logR2Operation(
  operation: 'put' | 'get' | 'delete' | 'list',
  key: string,
  context: LogContext = {}
): void {
  logEvent(LogLevel.INFO, `R2 ${operation} operation`, {
    action: `r2.${operation}`,
    r2Key: key,
    ...context,
  });
}

/**
 * Logs database operations
 */
export function logDbOperation(
  operation: 'query' | 'insert' | 'update' | 'delete',
  table: string,
  context: LogContext = {}
): void {
  logEvent(LogLevel.DEBUG, `DB ${operation} on ${table}`, {
    action: `db.${operation}`,
    table,
    ...context,
  });
}

/**
 * Logs authentication events
 */
export function logAuthEvent(
  event: 'login' | 'logout' | 'token_refresh' | 'auth_failed',
  context: LogContext = {}
): void {
  logEvent(LogLevel.INFO, `Auth event: ${event}`, {
    action: `auth.${event}`,
    ...context,
  });
}

/**
 * Logs API request performance
 */
export function logRequestPerformance(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  context: LogContext = {}
): void {
  const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
  logEvent(level, `${method} ${path} - ${statusCode}`, {
    action: 'api.request',
    method,
    path,
    statusCode,
    duration,
    ...context,
  });
}
