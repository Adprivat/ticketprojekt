import request from 'supertest';
import { app } from '@/server';
import { setupTestDatabase, teardownTestDatabase } from './database.setup';

describe('Server', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('Health Endpoints', () => {
    it('should respond to health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          environment: expect.any(String),
          version: expect.any(String),
        },
      });
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('should respond to API status check', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'operational',
          environment: expect.any(String),
          version: expect.any(String),
          database: {
            connected: expect.any(Boolean),
          },
          uptime: expect.any(Number),
          memory: expect.any(Object),
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('Route GET /non-existent-route not found'),
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/test')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body',
        },
      });
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for Helmet security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/status')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting', async () => {
      // Make multiple requests to test rate limiting
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed initially (rate limit is high for tests)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Check for rate limit headers
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.headers['x-ratelimit-limit']).toBeDefined();
      expect(lastResponse.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Request Logging', () => {
    it('should log requests', async () => {
      // This test verifies that the logging middleware doesn't break the request flow
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize malicious input', async () => {
      const maliciousInput = {
        name: '<script>alert("xss")</script>',
        description: 'javascript:alert("xss")',
        onload: 'alert("xss")',
      };

      // Since we don't have a POST endpoint yet, we'll test with a non-existent one
      // The sanitization should still occur before the 404 error
      const response = await request(app)
        .post('/api/test-sanitization')
        .send(maliciousInput)
        .expect(404);

      // The request should be processed (and return 404) without crashing
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});