import { query, queryOne, initDatabase } from './index.js';

export const ARVO_AGENTS = [
  { name: 'Meera Nair', email: 'meera@arvo.internal', role: 'Support Lead' },
  { name: 'Rahul Sharma', email: 'rahul@arvo.internal', role: 'Support Agent' },
  { name: 'Priya Patel', email: 'priya@arvo.internal', role: 'Support Agent' },
  { name: 'Arun Kumar', email: 'arun@arvo.internal', role: 'Support Agent' },
  { name: 'Ananya Das', email: 'ananya@arvo.internal', role: 'Support Agent' },
  { name: 'Rohan Verma', email: 'rohan@arvo.internal', role: 'Support Agent' },
  { name: 'Sneha Reddy', email: 'sneha@arvo.internal', role: 'Support Agent' },
  { name: 'Vikram Joshi', email: 'vikram@arvo.internal', role: 'Support Agent' },
  { name: 'Divya Menon', email: 'divya@arvo.internal', role: 'Support Agent' }
];

export async function seedDatabase() {
  await initDatabase();
  console.log('[Seed] Seeding 9 Arvo Support Agents...');

  for (const agent of ARVO_AGENTS) {
    const existing = await queryOne('SELECT id FROM agents WHERE email = $1', [agent.email]);
    if (!existing) {
      await query(
        'INSERT INTO agents (name, email, role) VALUES ($1, $2, $3)',
        [agent.name, agent.email, agent.role]
      );
      console.log(`[Seed] Created agent: ${agent.name} (${agent.email})`);
    }
  }

  // Check if we already have tickets
  const ticketCountRow = await queryOne('SELECT COUNT(*) as count FROM tickets');
  const count = Number(ticketCountRow?.count || 0);

  if (count === 0) {
    console.log('[Seed] Inserting initial sample tickets...');
    const sampleTickets = [
      {
        ticket_number: 'TICK-1001',
        subject: 'Cannot login to production accounting dashboard',
        description: 'Customer completely unable to process invoices. Error: 500 Internal Server Error.',
        customer_name: 'David Miller',
        customer_email: 'david@acmecorp.com',
        priority: 'critical',
        status: 'open',
        sla_reply_deadline: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        sla_resolve_deadline: new Date(Date.now() + 8 * 3600 * 1000).toISOString()
      },
      {
        ticket_number: 'TICK-1002',
        subject: 'Slow report export on weekly summary',
        description: 'Exporting 10,000 records takes over 3 minutes. Need optimization.',
        customer_name: 'Sarah Connor',
        customer_email: 'sarah@cyberdyne.com',
        priority: 'medium',
        status: 'open',
        sla_reply_deadline: new Date(Date.now() + 4.5 * 3600 * 1000).toISOString(),
        sla_resolve_deadline: new Date(Date.now() + 27 * 3600 * 1000).toISOString()
      },
      {
        ticket_number: 'TICK-1003',
        subject: 'Question regarding API rate limits for webhook events',
        description: 'Hi, we are planning our integration and want to know the max calls per minute.',
        customer_name: 'Alex Wong',
        customer_email: 'alex@nextgen.io',
        priority: 'low',
        status: 'waiting_on_customer',
        sla_reply_deadline: new Date(Date.now() + 9 * 3600 * 1000).toISOString(),
        sla_resolve_deadline: new Date(Date.now() + 45 * 3600 * 1000).toISOString()
      }
    ];

    for (const t of sampleTickets) {
      await query(
        `INSERT INTO tickets (ticket_number, subject, description, customer_name, customer_email, priority, status, sla_reply_deadline, sla_resolve_deadline)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [t.ticket_number, t.subject, t.description, t.customer_name, t.customer_email, t.priority, t.status, t.sla_reply_deadline, t.sla_resolve_deadline]
      );
    }
    console.log('[Seed] Sample tickets created.');
  }

  console.log('[Seed] Database initialization and seed complete.');
}

// Run directly if invoked as script
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase().then(() => process.exit(0)).catch(err => {
    console.error('[Seed Error]', err);
    process.exit(1);
  });
}
