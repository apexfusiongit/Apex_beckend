import { Context, Next } from 'hono';
import { ZodError, ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const validatedData = schema.parse(body);
      
      // Store validated data in context for use in route handlers
      c.set('validatedData', validatedData);
      
      await next();
    } catch (error) {
      if (error instanceof ZodError && error.issues) {
        const errors = error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return c.json({
          success: false,
          message: 'Validation failed',
          errors
        }, 400);
      }
      
      console.error('Validation error:', error);
      return c.json({
        success: false,
        message: 'Invalid request data'
      }, 400);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return async (c: Context, next: Next) => {
    try {
      const queryParams = c.req.query();
      const validatedData = schema.parse(queryParams);
      
      c.set('validatedQuery', validatedData);
      
      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return c.json({
          success: false,
          message: 'Query validation failed',
          errors
        }, 400);
      }
      
      return c.json({
        success: false,
        message: 'Invalid query parameters'
      }, 400);
    }
  };
}
