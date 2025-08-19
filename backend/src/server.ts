import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { config } from './config/env';
import { initializeDatabase } from './database';
import { initializeWebSocket, setWebSocketServer } from './websocket';
import { 
  requestLogger, 
  errorLogger, 
  logger,
  logBusinessEvent 
} from './middleware/logging';
import { 
  corsOptions, 
  apiSecurity
} from './middleware/security';
import { 
  globalErrorHandler, 
  notFoundHandler 
} from './middleware/errorHandler';

// Create Express application
const app = express();

/**
 * Trust proxy settings for accurate IP addresses
 */
app.set('trust proxy', 1);

/**
 * Global middleware setup
 */

// Request logging (should be first)
app.use(requestLogger);

// CORS configuration
app.use(cors(corsOptions));
// Explicitly handle preflight quickly
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use(apiSecurity);

/**
 * Health check endpoint (before authentication)
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.env,
      version: process.env.npm_package_version || '1.0.0',
    },
  });
});

/**
 * API status endpoint with database check
 */
app.get('/api/status', async (req, res, next) => {
  try {
    const { checkDatabaseConnection, DatabaseUtils } = await import('./database');
    
    const [dbConnected, dbStats] = await Promise.all([
      checkDatabaseConnection(),
      DatabaseUtils.getStats().catch(() => null),
    ]);

    res.json({
      success: true,
      data: {
        status: 'operational',
        timestamp: new Date().toISOString(),
        environment: config.env,
        version: process.env.npm_package_version || '1.0.0',
        database: {
          connected: dbConnected,
          stats: dbStats,
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * API Routes
 */
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
import authRoutes from './routes/auth.routes';
// New: domain routes
import { ticketRoutes } from './routes/ticket.routes';
import { commentRoutes } from './routes/comment.routes';
import { assignmentRoutes } from './routes/assignment.routes';
import { statusRoutes } from './routes/status.routes';
import { notificationRoutes } from './routes/notification.routes';
import { userRoutes } from './routes/user.routes';

app.use('/api/auth', authRoutes);
// Mount domain routes
app.use('/api/tickets', ticketRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

// TODO: Add additional route handlers in subsequent tasks:
// - /api/tickets (ticket management)
// - /api/users (user management)
// - /api/comments (comment management)
// - /api/notifications (notifications)

/**
 * Static frontend (production)
 * If a built frontend exists in backend/public, serve it and SPA‑fallback to index.html
 */
const staticDir = path.resolve(__dirname, '../public');
app.use(express.static(staticDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(staticDir, 'index.html'));
});

/**
 * Error handling middleware (should be last)
 */
app.use(errorLogger);
app.use(notFoundHandler);
app.use(globalErrorHandler);

/**
 * Server startup function
 */
async function startServer(): Promise<void> {
  try {
    // Initialize database connection
    logger.info('Initializing database connection...');
    await initializeDatabase();
    
    // Create HTTP server
    const httpServer = createServer(app);
    
    // Initialize WebSocket server
    logger.info('Initializing WebSocket server...');
    const io = initializeWebSocket(httpServer);
    setWebSocketServer(io);
    
    // Start HTTP server with WebSocket support
    const server = httpServer.listen(config.port, () => {
      logger.info(`🚀 Server started successfully`, {
        port: config.port,
        environment: config.env,
        timestamp: new Date().toISOString(),
        websocket: true,
      });
      
      logBusinessEvent('SERVER_STARTED', {
        port: config.port,
        environment: config.env,
        websocket: true,
      });
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          // Close database connections
          const { prisma } = await import('./database');
          await prisma.$disconnect();
          logger.info('Database connections closed');
          
          logBusinessEvent('SERVER_SHUTDOWN', {
            signal,
            timestamp: new Date().toISOString(),
          });
          
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

export { app, startServer };