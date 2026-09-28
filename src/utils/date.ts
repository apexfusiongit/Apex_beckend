// Date utilities for dashboard and API date handling

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

export function parseDateRange(startDate?: string, endDate?: string): DateRange {
  const result: DateRange = {};
  
  if (startDate) {
    // Ensure start date is at beginning of day
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    result.startDate = start.toISOString();
  }
  
  if (endDate) {
    // Ensure end date is at end of day
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    result.endDate = end.toISOString();
  }
  
  return result;
}

export function getDateRangeForPeriod(period: 'today' | 'week' | 'month' | 'year' | 'all'): DateRange {
  const now = new Date();
  const start = new Date();
  
  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      return {
        startDate: start.toISOString(),
        endDate: now.toISOString()
      };
    
    case 'week':
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return {
        startDate: start.toISOString(),
        endDate: now.toISOString()
      };
    
    case 'month':
      start.setMonth(now.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      return {
        startDate: start.toISOString(),
        endDate: now.toISOString()
      };
    
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      return {
        startDate: start.toISOString(),
        endDate: now.toISOString()
      };
    
    case 'all':
    default:
      return {}; // No date restrictions
  }
}

export function isDateInRange(date: Date | string, startDate?: string, endDate?: string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dTime = d.getTime();
  
  if (startDate) {
    const start = new Date(startDate).getTime();
    if (dTime < start) return false;
  }
  
  if (endDate) {
    const end = new Date(endDate).getTime();
    if (dTime > end) return false;
  }
  
  return true;
}

export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date | string, months: number): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const result = new Date(d);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function addYears(date: Date | string, years: number): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const result = new Date(d);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

export function getDaysBetween(start: Date | string, end: Date | string): number {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function isFutureDate(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() > Date.now();
}

export function isPastDate(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() < Date.now();
}

export function isValidDateTime(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

// For SQLite datetime queries
export function toSQLiteDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}
