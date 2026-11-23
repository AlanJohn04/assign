import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { app } from '../src/server.js';
import { initDatabase } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';

let server;
let baseUrl = '';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

describe('Frontdesk Integration API Tests', () => {
  let agent1Token = '';
  let agent2Token = '';

  before(async () => {
    await initDatabase();
    await seedDatabase();

    await new Promise(resolve => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Login as Meera (Agent 1)
    const login1 = await request('POST', '/api/auth/login', { agentId: 1 });
    agent1Token = login1.data.token;

    // Login as Rahul (Agent 2)
    const login2 = await request('POST', '/api/auth/login', { agentId: 2 });
    agent2Token = login2.data.token;
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('verifies agent login and list', async () => {
    const res = await request('GET', '/api/auth/agents');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.length, 9, 'All 9 Arvo agents should be seeded');
  });

  it('INC-0291 Prevention: Two agents attempting to take the same ticket results in atomic assignment and 409 Conflict', async () => {
    // 1. Create an unassigned ticket
    const ticketRes = await request('POST', '/api/tickets', {
      subject: 'Urgent checkout bug',
      description: 'Customer cart emptying randomly',
      customer_name: 'Acme Corp',
      customer_email: 'buyer@acme.com',
      priority: 'critical'
    });
    assert.strictEqual(ticketRes.status, 201);
    const ticketId = ticketRes.data.id;

    // 2. Agent 1 takes the ticket
    const assign1 = await request('PATCH', `/api/tickets/${ticketId}/assign`, {}, {
      Authorization: `Bearer ${agent1Token}`
    });
    assert.strictEqual(assign1.status, 200);
    assert.strictEqual(assign1.data.assigned_to, 1);

    // 3. Agent 2 simultaneously attempts to take the SAME ticket
    const assign2 = await request('PATCH', `/api/tickets/${ticketId}/assign`, {}, {
      Authorization: `Bearer ${agent2Token}`
    });

    // Must be rejected with 409 Conflict!
    assert.strictEqual(assign2.status, 409, 'Second agent must be rejected with 409 Conflict');
    assert.match(assign2.data.message, /already been taken by/i);
  });

  it('INC-0304 Hard Enforcement: Private internal notes must NEVER leak in customer views or exports', async () => {
    // 1. Create a ticket
    const ticketRes = await request('POST', '/api/tickets', {
      subject: 'Billing inquiry',
      description: 'Customer claims overcharged by $200',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      priority: 'medium'
    });
    const ticketId = ticketRes.data.id;

    // 2. Agent adds a private internal team note explaining how to handle this difficult customer
    const noteRes = await request(
      'POST',
      `/api/tickets/${ticketId}/comments`,
      {
        body: 'CONFIDENTIAL TEAM NOTE: Customer has repeatedly disputed valid charges. Check stripe log before replying.',
        is_internal: true
      },
      { Authorization: `Bearer ${agent1Token}` }
    );
    if (noteRes.status !== 201) {
      console.error('DEBUG noteRes status & data:', noteRes.status, noteRes.data);
    }
    assert.strictEqual(noteRes.status, 201);

    // 3. Agent also adds a public reply to the customer
    const replyRes = await request(
      'POST',
      `/api/tickets/${ticketId}/comments`,
      {
        body: 'Hello John, we are reviewing your billing statement right now.',
        is_internal: false
      },
      { Authorization: `Bearer ${agent1Token}` }
    );
    assert.strictEqual(replyRes.status, 201);

    // 4. Customer/unauthenticated user queries ticket details:
    const customerView = await request('GET', `/api/tickets/${ticketId}`);
    assert.strictEqual(customerView.status, 200);

    const customerComments = customerView.data.comments;
    if (customerComments.length !== 1) {
      console.error('DEBUG INC-0304 customerComments:', customerComments);
    }
    assert.strictEqual(customerComments.length, 1, 'Customer should only see the 1 public reply');
    assert.strictEqual(customerComments[0].body.includes('CONFIDENTIAL TEAM NOTE'), false);

    // 5. Customer export endpoint check:
    const exportRes = await request('GET', `/api/tickets/${ticketId}/export`);
    assert.strictEqual(exportRes.status, 200);
    const exportBody = JSON.stringify(exportRes.data);
    assert.strictEqual(exportBody.includes('CONFIDENTIAL TEAM NOTE'), false, 'Export must never contain internal notes');

    // 6. When authenticated agent views ticket:
    const agentView = await request('GET', `/api/tickets/${ticketId}`, null, {
      Authorization: `Bearer ${agent1Token}`
    });
    assert.strictEqual(agentView.data.comments.length, 2, 'Agents can see both public reply and internal note');
  });

  it('INC-0318 Proof & Audit Trail: System records who did what, when, and cannot be altered', async () => {
    const ticketRes = await request('POST', '/api/tickets', {
      subject: 'System audit verification',
      description: 'Audit log integrity check',
      customer_name: 'Audit Client',
      customer_email: 'audit@example.com',
      priority: 'low'
    });
    const ticketId = ticketRes.data.id;

    // Take ticket
    await request('PATCH', `/api/tickets/${ticketId}/assign`, {}, {
      Authorization: `Bearer ${agent1Token}`
    });

    // Change status
    await request('PATCH', `/api/tickets/${ticketId}/status`, { status: 'waiting_on_customer' }, {
      Authorization: `Bearer ${agent1Token}`
    });

    // Fetch audit trail
    const auditRes = await request('GET', `/api/tickets/${ticketId}/audit`, null, {
      Authorization: `Bearer ${agent1Token}`
    });
    assert.strictEqual(auditRes.status, 200);
    assert.ok(auditRes.data.length >= 3, 'Audit trail should record created, assigned, and status change');

    const actions = auditRes.data.map(a => a.action);
    assert.ok(actions.includes('ticket_created'));
    assert.ok(actions.includes('ticket_assigned'));
    assert.ok(actions.includes('status_changed'));

    // Check timestamps are present on all records
    for (const record of auditRes.data) {
      assert.ok(record.created_at);
      assert.ok(record.actor_name);
    }
  });

  it('SLA Pause & Customer Reply: Pauses SLA on waiting_on_customer and resumes when customer replies', async () => {
    const ticketRes = await request('POST', '/api/tickets', {
      subject: 'Feature query',
      description: 'Need more clarification',
      customer_name: 'Tech Lead',
      customer_email: 'lead@tech.com',
      priority: 'medium'
    });
    const ticketId = ticketRes.data.id;

    // Agent sets status to waiting_on_customer
    const pauseRes = await request('PATCH', `/api/tickets/${ticketId}/status`, { status: 'waiting_on_customer' }, {
      Authorization: `Bearer ${agent1Token}`
    });
    assert.strictEqual(pauseRes.status, 200);
    assert.ok(pauseRes.data.sla_paused_at, 'sla_paused_at should be recorded');

    // Customer replies
    const replyRes = await request('POST', `/api/tickets/${ticketId}/comments`, {
      body: 'Here is the additional information you requested.',
      author_type: 'customer'
    });
    assert.strictEqual(replyRes.status, 201);

    // Ticket should now be back in in_progress with sla_paused_at cleared
    const checkTicket = await request('GET', `/api/tickets/${ticketId}`);
    assert.strictEqual(checkTicket.data.status, 'in_progress');
    assert.strictEqual(checkTicket.data.sla_paused_at, null);
  });
});
