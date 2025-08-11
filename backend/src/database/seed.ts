import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { config } from '../config/env';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, config.security.bcryptRounds);
}

async function seedUsers() {
  console.log('🌱 Seeding users...');

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ticketsystem.com' },
    update: {},
    create: {
      email: 'admin@ticketsystem.com',
      firstName: 'System',
      lastName: 'Administrator',
      password: adminPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });

  // Create agent users
  const agentPassword = await hashPassword('agent123');
  const agent1 = await prisma.user.upsert({
    where: { email: 'john.doe@company.com' },
    update: {},
    create: {
      email: 'john.doe@company.com',
      firstName: 'John',
      lastName: 'Doe',
      password: agentPassword,
      role: 'AGENT',
      isActive: true,
    },
  });

  const agent2 = await prisma.user.upsert({
    where: { email: 'jane.smith@company.com' },
    update: {},
    create: {
      email: 'jane.smith@company.com',
      firstName: 'Jane',
      lastName: 'Smith',
      password: agentPassword,
      role: 'AGENT',
      isActive: true,
    },
  });

  // Create regular users
  const userPassword = await hashPassword('user123');
  const user1 = await prisma.user.upsert({
    where: { email: 'alice.johnson@company.com' },
    update: {},
    create: {
      email: 'alice.johnson@company.com',
      firstName: 'Alice',
      lastName: 'Johnson',
      password: userPassword,
      role: 'USER',
      isActive: true,
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'bob.wilson@company.com' },
    update: {},
    create: {
      email: 'bob.wilson@company.com',
      firstName: 'Bob',
      lastName: 'Wilson',
      password: userPassword,
      role: 'USER',
      isActive: true,
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'carol.brown@company.com' },
    update: {},
    create: {
      email: 'carol.brown@company.com',
      firstName: 'Carol',
      lastName: 'Brown',
      password: userPassword,
      role: 'USER',
      isActive: true,
    },
  });

  console.log('✅ Users seeded successfully');
  return { admin, agent1, agent2, user1, user2, user3 };
}

async function seedTickets(users: any) {
  console.log('🌱 Seeding tickets...');

  const tickets = [
    {
      title: 'Computer läuft sehr langsam',
      description: 'Mein Computer ist seit gestern sehr langsam geworden. Programme brauchen ewig zum Starten und das System hängt sich manchmal auf. Können Sie bitte helfen?',
      status: 'OPEN',
      priority: 'HIGH',
      createdBy: users.user1.id,
      assignedTo: users.agent1.id,
    },
    {
      title: 'E-Mail-Probleme mit Outlook',
      description: 'Ich kann keine E-Mails mehr empfangen. Outlook zeigt eine Fehlermeldung an, wenn ich versuche, neue Nachrichten abzurufen.',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      createdBy: users.user2.id,
      assignedTo: users.agent2.id,
    },
    {
      title: 'Drucker druckt nicht',
      description: 'Der Drucker im 2. Stock funktioniert nicht mehr. Er zeigt eine rote LED an und reagiert nicht auf Druckaufträge.',
      status: 'OPEN',
      priority: 'MEDIUM',
      createdBy: users.user3.id,
      assignedTo: null,
    },
    {
      title: 'VPN-Verbindung bricht ab',
      description: 'Die VPN-Verbindung zum Homeoffice bricht ständig ab. Ich kann nicht mehr auf die Firmenserver zugreifen.',
      status: 'OPEN',
      priority: 'HIGH',
      createdBy: users.user1.id,
      assignedTo: users.agent1.id,
    },
    {
      title: 'Software-Installation benötigt',
      description: 'Ich benötige Adobe Photoshop für meine Arbeit. Können Sie das bitte installieren?',
      status: 'CLOSED',
      priority: 'LOW',
      createdBy: users.user2.id,
      assignedTo: users.agent2.id,
    },
    {
      title: 'Passwort zurücksetzen',
      description: 'Ich habe mein Windows-Passwort vergessen und kann mich nicht mehr anmelden.',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      createdBy: users.user3.id,
      assignedTo: users.agent1.id,
    },
    {
      title: 'Monitor flackert',
      description: 'Mein Monitor flackert ständig und die Farben sehen seltsam aus. Ist das ein Hardware-Problem?',
      status: 'OPEN',
      priority: 'MEDIUM',
      createdBy: users.user1.id,
      assignedTo: null,
    },
    {
      title: 'Neue Tastatur benötigt',
      description: 'Meine Tastatur hat mehrere defekte Tasten. Ich benötige eine neue.',
      status: 'CLOSED',
      priority: 'LOW',
      createdBy: users.user2.id,
      assignedTo: users.agent2.id,
    },
  ];

  const createdTickets = [];
  for (const ticketData of tickets) {
    const ticket = await prisma.ticket.create({
      data: {
        title: ticketData.title,
        description: ticketData.description,
        status: ticketData.status as any,
        priority: ticketData.priority as any,
        createdBy: ticketData.createdBy,
        assignedTo: ticketData.assignedTo,
      },
    });
    createdTickets.push(ticket);
  }

  console.log('✅ Tickets seeded successfully');
  return createdTickets;
}

async function seedComments(tickets: any[], users: any) {
  console.log('🌱 Seeding comments...');

  const comments = [
    // Comments for first ticket (Computer läuft langsam)
    {
      content: 'Ich habe das Problem gemeldet. Wann können Sie vorbeikommen?',
      ticketId: tickets[0].id,
      authorId: users.user1.id,
    },
    {
      content: 'Ich schaue mir das heute Nachmittag an. Bitte lassen Sie den Computer eingeschaltet.',
      ticketId: tickets[0].id,
      authorId: users.agent1.id,
    },
    
    // Comments for second ticket (E-Mail-Probleme)
    {
      content: 'Ich habe bereits versucht, Outlook neu zu starten, aber das Problem besteht weiterhin.',
      ticketId: tickets[1].id,
      authorId: users.user2.id,
    },
    {
      content: 'Ich überprüfe gerade die Servereinstellungen. Das sollte in den nächsten 30 Minuten behoben sein.',
      ticketId: tickets[1].id,
      authorId: users.agent2.id,
    },
    {
      content: 'Problem identifiziert - es lag an den SMTP-Einstellungen. Wird gerade behoben.',
      ticketId: tickets[1].id,
      authorId: users.agent2.id,
    },

    // Comments for closed ticket (Software-Installation)
    {
      content: 'Adobe Photoshop wurde erfolgreich installiert. Sie finden es im Startmenü.',
      ticketId: tickets[4].id,
      authorId: users.agent2.id,
    },
    {
      content: 'Vielen Dank! Funktioniert perfekt.',
      ticketId: tickets[4].id,
      authorId: users.user2.id,
    },

    // Comments for password reset ticket
    {
      content: 'Ich bin gerade vor Ort und setze Ihr Passwort zurück.',
      ticketId: tickets[5].id,
      authorId: users.agent1.id,
    },
  ];

  for (const commentData of comments) {
    await prisma.comment.create({
      data: commentData,
    });
  }

  console.log('✅ Comments seeded successfully');
}

async function main() {
  try {
    console.log('🚀 Starting database seeding...');

    // Check if data already exists
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
      console.log('⚠️  Database already contains data. Skipping seed...');
      return;
    }

    // Seed in order due to foreign key constraints
    const users = await seedUsers();
    const tickets = await seedTickets(users);
    await seedComments(tickets, users);

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('Admin: admin@ticketsystem.com / admin123');
    console.log('Agent: john.doe@company.com / agent123');
    console.log('Agent: jane.smith@company.com / agent123');
    console.log('User: alice.johnson@company.com / user123');
    console.log('User: bob.wilson@company.com / user123');
    console.log('User: carol.brown@company.com / user123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { main as seedDatabase };