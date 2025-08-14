import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { logger, logSecurityEvent } from '../middleware/logging';
import { NotificationBroadcaster } from './notification-broadcaster';
import { NotificationService } from '../services/notification.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  userEmail?: string;
}

interface SocketUser {
  id: string;
  email: string;
  role: string;
  socketId: string;
}

// Store connected users
const connectedUsers = new Map<string, SocketUser>();
let notificationBroadcaster: NotificationBroadcaster | null = null;

/**
 * Initialize WebSocket server
 */
export const initializeWebSocket = (httpServer: HttpServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    path: '/socket.io',
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        logSecurityEvent('WEBSOCKET_AUTH_MISSING_TOKEN', { socketId: socket.id });
        // Trigger connection error path on client
        return next(Object.assign(new Error('Authentication token required'), { data: { code: 'AUTH_REQUIRED' } }));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      // Attach user info to socket
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      socket.userEmail = decoded.email;

      logger.info('WebSocket Authentication Success', {
        socketId: socket.id,
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      });

      next();
    } catch (error) {
      logSecurityEvent('WEBSOCKET_AUTH_FAILED', { 
        socketId: socket.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      next(Object.assign(new Error('Authentication failed'), { data: { code: 'AUTH_FAILED' } }));
    }
  });

  // Connection handling
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('WebSocket Connection Established', {
      socketId: socket.id,
      userId: socket.userId,
      email: socket.userEmail,
      role: socket.userRole,
    });

    // Store connected user
    if (socket.userId) {
      connectedUsers.set(socket.userId, {
        id: socket.userId,
        email: socket.userEmail!,
        role: socket.userRole!,
        socketId: socket.id,
      });

      // Register connection with NotificationService for tests/consumers expecting this
      try {
        NotificationService.registerSocketConnection(socket.userId, socket);
      } catch (e) {
        // non-fatal
      }

      // Join user-specific room
      socket.join(`user:${socket.userId}`);
      
      // Join role-specific rooms
      if (socket.userRole === 'ADMIN') {
        socket.join('admins');
      } else if (socket.userRole === 'AGENT') {
        socket.join('agents');
      }

  // Initial unread count is emitted by NotificationBroadcaster to keep behavior centralized
    }

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle notification acknowledgment
    socket.on('notification:ack', (data: { notificationId: string }) => {
      logger.debug('Notification Acknowledged', {
        socketId: socket.id,
        userId: socket.userId,
        notificationId: data.notificationId,
      });
    });

    // Handle typing indicators for comments
    socket.on('typing:start', (data: { ticketId: string }) => {
      socket.to(`ticket:${data.ticketId}`).emit('user:typing', {
        userId: socket.userId,
        email: socket.userEmail,
        ticketId: data.ticketId,
      });
    });

    socket.on('typing:stop', (data: { ticketId: string }) => {
      socket.to(`ticket:${data.ticketId}`).emit('user:stopped_typing', {
        userId: socket.userId,
        ticketId: data.ticketId,
      });
    });

    // Handle ticket room joining
    socket.on('ticket:join', (data: { ticketId: string }) => {
      socket.join(`ticket:${data.ticketId}`);
      logger.debug('User Joined Ticket Room', {
        socketId: socket.id,
        userId: socket.userId,
        ticketId: data.ticketId,
      });
    });

    socket.on('ticket:leave', (data: { ticketId: string }) => {
      socket.leave(`ticket:${data.ticketId}`);
      logger.debug('User Left Ticket Room', {
        socketId: socket.id,
        userId: socket.userId,
        ticketId: data.ticketId,
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info('WebSocket Connection Closed', {
        socketId: socket.id,
        userId: socket.userId,
        email: socket.userEmail,
        reason,
      });

      // Remove from connected users
      if (socket.userId) {
        connectedUsers.delete(socket.userId);

        // Unregister from NotificationService map
        try {
          NotificationService.unregisterSocketConnection(socket.userId);
        } catch (e) {
          // ignore
        }
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('WebSocket Error', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message,
        stack: error.stack,
      });
    });
  });

  // Initialize notification broadcaster
  notificationBroadcaster = new NotificationBroadcaster(io);
  
  // Register the broadcaster with the notification service
  NotificationService.registerBroadcaster(notificationBroadcaster);

  return io;
};

/**
 * Get WebSocket server instance (for use in other modules)
 */
let ioInstance: SocketIOServer | null = null;

export const getWebSocketServer = (): SocketIOServer | null => {
  return ioInstance;
};

export const setWebSocketServer = (io: SocketIOServer): void => {
  ioInstance = io;
};

/**
 * Notification broadcasting functions
 */
export const broadcastNotification = (
  userId: string,
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    timestamp: string;
  }
) => {
  if (!ioInstance) return;

  ioInstance.to(`user:${userId}`).emit('notification', notification);
  
  logger.debug('Notification Broadcasted', {
    userId,
    notificationId: notification.id,
    type: notification.type,
  });
};

export const broadcastTicketUpdate = (
  ticketId: string,
  update: {
    type: 'status_change' | 'assignment_change' | 'comment_added' | 'ticket_updated';
    ticketId: string;
    data: any;
    timestamp: string;
  }
) => {
  if (!ioInstance) return;

  ioInstance.to(`ticket:${ticketId}`).emit('ticket:update', update);
  
  logger.debug('Ticket Update Broadcasted', {
    ticketId,
    updateType: update.type,
  });
};

export const broadcastToRole = (
  role: 'ADMIN' | 'AGENT',
  event: string,
  data: any
) => {
  if (!ioInstance) return;

  const room = role === 'ADMIN' ? 'admins' : 'agents';
  ioInstance.to(room).emit(event, data);
  
  logger.debug('Role Broadcast Sent', {
    role,
    event,
    room,
  });
};

/**
 * Get connected users
 */
export const getConnectedUsers = (): SocketUser[] => {
  return Array.from(connectedUsers.values());
};

export const isUserConnected = (userId: string): boolean => {
  return connectedUsers.has(userId);
};

export const getConnectedUsersByRole = (role: string): SocketUser[] => {
  return Array.from(connectedUsers.values()).filter(user => user.role === role);
};

/**
 * Health check for WebSocket server
 */
export const getWebSocketHealth = () => {
  return {
    connected: ioInstance !== null,
    connectedUsers: connectedUsers.size,
    usersByRole: {
      admin: getConnectedUsersByRole('ADMIN').length,
      agent: getConnectedUsersByRole('AGENT').length,
      user: getConnectedUsersByRole('USER').length,
    },
  };
};