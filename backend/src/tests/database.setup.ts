import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

// Test database instance
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

/**
 * Setup test database before running tests
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    // Generate Prisma client for tests
    execSync("npx prisma generate", { stdio: "inherit" });

    // Push schema to test database (faster than migrations for tests)
    execSync("npx prisma db push --force-reset", { stdio: "inherit" });

    console.log("✅ Test database setup completed");
  } catch (error) {
    console.error("❌ Test database setup failed:", error);
    throw error;
  }
}

/**
 * Clean up test database after tests
 */
export async function teardownTestDatabase(): Promise<void> {
  try {
    await testPrisma.$disconnect();
    console.log("✅ Test database disconnected");
  } catch (error) {
    console.error("❌ Test database teardown failed:", error);
    throw error;
  }
}

/**
 * Clear all data from test database
 */
export async function clearTestDatabase(): Promise<void> {
  try {
    // Delete in order to respect foreign key constraints
    await testPrisma.comment.deleteMany();
    await testPrisma.ticket.deleteMany();
    await testPrisma.user.deleteMany();

    console.log("✅ Test database cleared");
  } catch (error) {
    console.error("❌ Failed to clear test database:", error);
    throw error;
  }
}

/**
 * Create test user
 */
export async function createTestUser(overrides: any = {}) {
  return await testPrisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      firstName: "Test",
      lastName: "User",
      password: "hashedpassword",
      role: "USER",
      ...overrides,
    },
  });
}

/**
 * Create test ticket
 */
export async function createTestTicket(creatorId: string, overrides: any = {}) {
  return await testPrisma.ticket.create({
    data: {
      title: "Test Ticket",
      description: "This is a test ticket",
      status: "OPEN",
      priority: "MEDIUM",
      createdBy: creatorId,
      ...overrides,
    },
  });
}

/**
 * Create test comment
 */
export async function createTestComment(
  ticketId: string,
  authorId: string,
  overrides: any = {}
) {
  return await testPrisma.comment.create({
    data: {
      content: "This is a test comment",
      ticketId,
      authorId,
      ...overrides,
    },
  });
}

/**
 * Database test helpers
 */
export const testHelpers = {
  async createUserWithTickets(ticketCount: number = 2) {
    const user = await createTestUser();
    const tickets = [];

    for (let i = 0; i < ticketCount; i++) {
      const ticket = await createTestTicket(user.id, {
        title: `Test Ticket ${i + 1}`,
      });
      tickets.push(ticket);
    }

    return { user, tickets };
  },

  async createTicketWithComments(commentCount: number = 3) {
    const creator = await createTestUser();
    const commenter = await createTestUser({ email: "commenter@test.com" });
    const ticket = await createTestTicket(creator.id);
    const comments = [];

    for (let i = 0; i < commentCount; i++) {
      const comment = await createTestComment(ticket.id, commenter.id, {
        content: `Test comment ${i + 1}`,
      });
      comments.push(comment);
    }

    return { creator, commenter, ticket, comments };
  },

  async createCompleteTicketScenario() {
    const creator = await createTestUser({ role: "USER" });
    const agent = await createTestUser({
      email: "agent@test.com",
      role: "AGENT",
    });

    const ticket = await createTestTicket(creator.id, {
      assignedTo: agent.id,
      status: "IN_PROGRESS",
    });

    const comments = [
      await createTestComment(ticket.id, creator.id, {
        content: "Initial problem description",
      }),
      await createTestComment(ticket.id, agent.id, {
        content: "Working on this issue",
      }),
    ];

    return { creator, agent, ticket, comments };
  },
};
