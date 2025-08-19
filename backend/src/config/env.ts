import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import Joi from 'joi';

// Load environment variables
// 1) Always load .env if present
const defaultEnvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(defaultEnvPath)) {
  dotenv.config({ path: defaultEnvPath });
}
// 2) In test, overlay with .env.test if present (no need to copy files)
if (process.env.NODE_ENV === 'test') {
  const testEnvPath = path.resolve(process.cwd(), '.env.test');
  if (fs.existsSync(testEnvPath)) {
    dotenv.config({ path: testEnvPath, override: true });
  }
}

// Normalize FRONTEND_URL: strip accidental quotes and prefix with https:// if protocol is missing
if (process.env.FRONTEND_URL) {
  const raw = process.env.FRONTEND_URL;
  // Trim whitespace and remove surrounding single/double quotes
  let cleaned = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  // Remove any trailing slashes for consistent origin comparison
  cleaned = cleaned.replace(/\/+$/g, '');
  process.env.FRONTEND_URL = cleaned;
}

// Environment validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  
  // Database
  DATABASE_URL: Joi.string().required(),
  
  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  
  // Email
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().email().required(),
  SMTP_PASS: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),
  
  // Security
  BCRYPT_ROUNDS: Joi.number().min(10).max(15).default(12),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  
  // CORS
  FRONTEND_URL: Joi.string().uri().required(),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  database: {
    url: envVars.DATABASE_URL,
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  },
  
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      user: envVars.SMTP_USER,
      pass: envVars.SMTP_PASS,
    },
    from: envVars.EMAIL_FROM,
  },
  
  security: {
    bcryptRounds: envVars.BCRYPT_ROUNDS,
    rateLimit: {
      windowMs: envVars.RATE_LIMIT_WINDOW_MS,
      maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
    },
  },
  
  cors: {
    origin: envVars.FRONTEND_URL,
  },
};