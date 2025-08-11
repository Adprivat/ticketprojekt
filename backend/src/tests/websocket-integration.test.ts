import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import Client from "socket.io-client";
import { Socket as ClientSocket } from "socket.io-client";
import { createServer } from "http";
import express from "express";
import { initializeWebSocket, setWebSocketServer } from "../websocket";
import { NotificationService } from "../services/notification.service";
import { JwtService } from "../utils/jwt";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { beforeEach } from "node:test";
import { describe } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { beforeEach } from "node:test";
import { describe } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { beforeEach } from "node:test";
import { describe } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { it } from "node:test";
import { describe } from "node:test";
import { afterEach } from "node:test";
import { beforeEach } from "node:test";
import { describe } from "node:test";

describe("WebSocket Integration Tests", () => {
  let httpServer: HTTPServer;
  let socketServer: SocketIOServer;
  let clientSocket: ClientSocket;
  let serverAddress: string;
  let testUserId: string;
  let testToken: string;

  beforeAll(async () => {
    // Create test user and token
    testUserId = "test-user-id-123";
    testToken = JwtService.generateAccessToken({
      userId: testUserId,
      email: "test@example.com",
      role: "AGENT",
    });

    // Create HTTP server
    const app = express();
    httpServer = createServer(app);

    // Initialize WebSocket server
    socketServer = initializeWebSocket(httpServer);
    setWebSocketServer(socketServer);

    // Start server on random port
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        const address = httpServer.address();
        if (address && typeof address === "object") {
          serverAddress = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Close connections
    if (clientSocket && clientSocket.connected) {
      clientSocket.close();
    }
    if (socketServer) {
      socketServer.close();
    }
    if (httpServer) {
      httpServer.close();
    }
  });

  beforeEach(() => {
    // Clear notification service state
    NotificationService.clearAllNotifications(testUserId);
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.close();
    }
  });

  describe("WebSocket Authentication", () => {
    it("should reject connection without token", (done) => {
      clientSocket = Client(serverAddress, {
        timeout: 1000,
      });

      clientSocket.on("connect_error", (error: any) => {
        expect(error.message).toContain("Authentication");
        done();
      });

      clientSocket.on("connect", () => {
        done(new Error("Should not connect without token"));
      });
    });

    it("should reject connection with invalid token", (done) => {
      clientSocket = Client(serverAddress, {
        auth: {
          token: "invalid-token",
        },
        timeout: 1000,
      });

      clientSocket.on("connect_error", (error: any) => {
        expect(error.message).toContain("Authentication failed");
        done();
      });

      clientSocket.on("connect", () => {
        done(new Error("Should not connect with invalid token"));
      });
    });

    it("should accept connection with valid token", (done) => {
      clientSocket = Client(serverAddress, {
        auth: {
          token: testToken,
        },
        timeout: 2000,
      });

      clientSocket.on("connect", () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on("connect_error", (error: any) => {
        done(error);
      });
    });
  });

  describe("Real-time Notifications", () => {
    beforeEach((done) => {
      clientSocket = Client(serverAddress, {
        auth: {
          token: testToken,
        },
        timeout: 2000,
      });

      clientSocket.on("connect", () => {
        done();
      });

      clientSocket.on("connect_error", done);
    });

    it("should receive notification count on connection", (done) => {
      clientSocket.on("notification_count", (data: any) => {
        expect(data).toHaveProperty("unreadCount");
        expect(typeof data.unreadCount).toBe("number");
        expect(data).toHaveProperty("timestamp");
        done();
      });
    });

    it("should receive real-time notifications", (done) => {
      const testNotification = {
        type: "ticket_created" as const,
        title: "Test Notification",
        message: "This is a test notification",
        ticketId: "test-ticket-id",
      };

      clientSocket.on("notification", (payload: any) => {
        expect(payload.type).toBe("notification");
        expect(payload.data).toMatchObject({
          type: testNotification.type,
          title: testNotification.title,
          message: testNotification.message,
          userId: testUserId,
        });
        expect(payload.data).toHaveProperty("id");
        expect(payload.data).toHaveProperty("createdAt");
        expect(payload.data.read).toBe(false);
        done();
      });

      // Create notification after socket is ready
      setTimeout(async () => {
        await NotificationService.createNotification(
          testUserId,
          testNotification.type,
          testNotification.title,
          testNotification.message,
          { ticketId: testNotification.ticketId }
        );
      }, 100);
    });

    it("should handle notification acknowledgment", (done) => {
      let notificationId: string;

      clientSocket.on("notification", (payload: any) => {
        notificationId = payload.data.id;

        // Acknowledge the notification
        clientSocket.emit("notification_ack", { notificationId });
      });

      clientSocket.on("notification_count", (data: any) => {
        if (notificationId) {
          // Should receive updated count after acknowledgment
          expect(data.unreadCount).toBe(0);
          done();
        }
      });

      // Create a test notification
      setTimeout(async () => {
        await NotificationService.createNotification(
          testUserId,
          "ticket_created",
          "Test Notification",
          "Test message"
        );
      }, 100);
    });

    it("should handle get notifications request", (done) => {
      // First create some notifications
      Promise.all([
        NotificationService.createNotification(
          testUserId,
          "ticket_created",
          "Test 1",
          "Message 1"
        ),
        NotificationService.createNotification(
          testUserId,
          "ticket_assigned",
          "Test 2",
          "Message 2"
        ),
      ]).then(() => {
        clientSocket.emit("get_notifications", { limit: 10, offset: 0 });
      });

      clientSocket.on("notifications_list", (data: any) => {
        expect(data).toHaveProperty("notifications");
        expect(Array.isArray(data.notifications)).toBe(true);
        expect(data.notifications.length).toBe(2);
        expect(data).toHaveProperty("hasMore");
        expect(data).toHaveProperty("timestamp");
        done();
      });
    });

    it("should handle mark all as read", (done) => {
      // First create some notifications
      Promise.all([
        NotificationService.createNotification(
          testUserId,
          "ticket_created",
          "Test 1",
          "Message 1"
        ),
        NotificationService.createNotification(
          testUserId,
          "ticket_assigned",
          "Test 2",
          "Message 2"
        ),
      ]).then(() => {
        clientSocket.emit("mark_all_read");
      });

      clientSocket.on("all_notifications_read", (data: any) => {
        expect(data).toHaveProperty("markedCount");
        expect(data.markedCount).toBe(2);
        expect(data).toHaveProperty("timestamp");
        done();
      });
    });

    it("should handle ping/pong for connection health", (done) => {
      clientSocket.on("pong", (data: any) => {
        expect(data).toHaveProperty("timestamp");
        done();
      });

      clientSocket.emit("ping");
    });
  });

  describe("Ticket Room Management", () => {
    beforeEach((done) => {
      clientSocket = Client(serverAddress, {
        auth: {
          token: testToken,
        },
        timeout: 2000,
      });

      clientSocket.on("connect", () => {
        done();
      });

      clientSocket.on("connect_error", done);
    });

    it("should join and leave ticket rooms", (done) => {
      const ticketId = "test-ticket-123";

      // Join ticket room
      clientSocket.emit("join_ticket", { ticketId });

      // Leave ticket room after a short delay
      setTimeout(() => {
        clientSocket.emit("leave_ticket", { ticketId });
        done();
      }, 100);
    });

    it("should handle typing indicators", (done) => {
      const ticketId = "test-ticket-123";

      // Create second client to receive typing events
      const secondClient = Client(serverAddress, {
        auth: {
          token: JwtService.generateAccessToken({
            userId: "other-user-id",
            email: "other@example.com",
            role: "USER",
          }),
        },
        timeout: 2000,
      });

      secondClient.on("connect", () => {
        // Both clients join the same ticket room
        clientSocket.emit("join_ticket", { ticketId });
        secondClient.emit("join_ticket", { ticketId });

        // First client starts typing
        setTimeout(() => {
          clientSocket.emit("typing_start", { ticketId });
        }, 100);
      });

      secondClient.on("user_typing", (data: any) => {
        expect(data).toHaveProperty("userId");
        expect(data).toHaveProperty("ticketId");
        expect(data.ticketId).toBe(ticketId);
        expect(data).toHaveProperty("timestamp");

        secondClient.close();
        done();
      });

      secondClient.on("connect_error", done);
    });
  });

  describe("Error Handling", () => {
    beforeEach((done) => {
      clientSocket = Client(serverAddress, {
        auth: {
          token: testToken,
        },
        timeout: 2000,
      });

      clientSocket.on("connect", () => {
        done();
      });

      clientSocket.on("connect_error", done);
    });

    it("should handle invalid notification acknowledgment gracefully", (done) => {
      // Send invalid notification ack
      clientSocket.emit("notification_ack", { notificationId: "invalid-id" });

      // Should not crash - verify connection is still alive
      setTimeout(() => {
        clientSocket.emit("ping");
        clientSocket.on("pong", () => {
          done();
        });
      }, 100);
    });

    it("should handle malformed requests gracefully", (done) => {
      // Send malformed data
      clientSocket.emit("get_notifications", { invalid: "data" });

      // Should not crash - verify connection is still alive
      setTimeout(() => {
        clientSocket.emit("ping");
        clientSocket.on("pong", () => {
          done();
        });
      }, 100);
    });

    it("should handle errors in notification requests", (done) => {
      clientSocket.on("error", (error: any) => {
        expect(error).toHaveProperty("type");
        expect(error).toHaveProperty("message");
        done();
      });

      // This should trigger an error response
      clientSocket.emit("get_notifications", { limit: -1 });
    });
  });
});

// Helper function to wait for a condition
function waitFor(
  condition: () => boolean,
  timeout: number = 1000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error("Timeout waiting for condition"));
      } else {
        setTimeout(check, 10);
      }
    };

    check();
  });
}
