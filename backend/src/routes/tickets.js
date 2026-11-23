import express from 'express';
import { query, queryOne } from '../db/index.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';
import {
  calculateInitialDeadlines,
  recalculateOnPriorityChange,
  resumeSLATimer,
  canReopenTicket,
  evaluateBreach,
  shouldAutoClose
} from '../services/slaEngine.js';

const router = express.Router();

/**
 * GET /api/tickets
 * Query params: status, assigned_to (number, 'me', or 'unassigned'), breached (boolean), search
 */
router.get('/', optionalAuthMiddleware, async (req, res) => {
  try {
    const { status, assigned_to, breached, priority, search } = req.query;

    let sql = `
      SELECT t.*, a.name as assignee_name, a.email as assignee_email
      FROM tickets t
      LEFT JOIN agents a ON t.assigned_to = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      sql += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }

    if (assigned_to === 'unassigned') {
      sql += ` AND t.assigned_to IS NULL`;
    } else if (assigned_to === 'me' && req.agent) {
      sql += ` AND t.assigned_to = $${paramIndex++}`;
      params.push(req.agent.id);
    } else if (assigned_to && assigned_to !== 'all') {
      sql += ` AND t.assigned_to = $${paramIndex++}`;
      params.push(Number(assigned_to));
    }

    if (priority && priority !== 'all') {
      sql += ` AND t.priority = $${paramIndex++}`;
      params.push(priority);
    }

    if (search) {
      sql += ` AND (t.ticket_number LIKE $${paramIndex} OR t.subject LIKE $${paramIndex} OR t.customer_name LIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY t.created_at DESC`;

    const tickets = await query(sql, params);

    // Dynamic SLA evaluation and auto-close check
    const now = new Date();
    const evaluatedTickets = tickets.map(ticket => {
      // Check auto-close for tickets waiting on customer > 45 working hours
      if (ticket.status === 'waiting_on_customer' && shouldAutoClose(ticket, now)) {
        // Queue status update to closed asynchronously
        query('UPDATE tickets SET status = $1, closed_at = $2 WHERE id = $3', ['closed', now.toISOString(), ticket.id])
          .then(() => {
            recordAudit({
              ticketId: ticket.id,
              actorName: 'Frontdesk System',
              action: 'auto_closed',
              details: 'Ticket automatically closed after 1 working week of customer inactivity.'
            });
          }).catch(console.error);
        ticket.status = 'closed';
        ticket.closed_at = now.toISOString();
      }

      const breach = evaluateBreach(ticket, now);
      return {
        ...ticket,
        is_reply_breached: breach.replyBreached,
        is_resolve_breached: breach.resolveBreached,
        is_breached: breach.replyBreached || breach.resolveBreached
      };
    });

    if (breached === 'true') {
      return res.json(evaluatedTickets.filter(t => t.is_breached));
    }

    res.json(evaluatedTickets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve tickets', details: err.message });
  }
});

/**
 * GET /api/tickets/:id
 * INC-0304 Enforcement: Customer requests or unauthenticated requests NEVER see internal notes
 */
router.get('/:id', optionalAuthMiddleware, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await queryOne(
      `SELECT t.*, a.name as assignee_name, a.email as assignee_email
       FROM tickets t
       LEFT JOIN agents a ON t.assigned_to = a.id
       WHERE t.id = $1`,
      [ticketId]
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Evaluate real-time breach
    const breach = evaluateBreach(ticket, new Date());
    ticket.is_reply_breached = breach.replyBreached;
    ticket.is_resolve_breached = breach.resolveBreached;
    ticket.is_breached = breach.replyBreached || breach.resolveBreached;

    // Comments query:
    // If agent is authenticated, return all comments.
    // If NOT authenticated as an agent, strictly filter is_internal = 0
    const isAgent = Boolean(req.agent);
    let commentsSql = `SELECT * FROM comments WHERE ticket_id = $1`;
    if (!isAgent) {
      commentsSql += ` AND (is_internal = 0 OR is_internal = false)`;
    }
    commentsSql += ` ORDER BY created_at ASC`;

    const comments = await query(commentsSql, [ticketId]);

    res.json({
      ...ticket,
      comments: comments.map(c => ({
        ...c,
        is_internal: Boolean(c.is_internal)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve ticket', details: err.message });
  }
});

/**
 * POST /api/tickets
 * Create a new support problem ticket
 */
router.post('/', async (req, res) => {
  try {
    const { subject, description, customer_name, customer_email, priority = 'medium' } = req.body;

    if (!subject || !description || !customer_name || !customer_email) {
      return res.status(400).json({ error: 'Missing required ticket fields' });
    }

    const ticketNumber = `TICK-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const now = new Date();
    const deadlines = calculateInitialDeadlines(priority, now);

    const insertSql = `
      INSERT INTO tickets (
        ticket_number, subject, description, customer_name, customer_email,
        priority, status, created_at, sla_reply_deadline, sla_resolve_deadline, version
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9, 1)
    `;

    await query(insertSql, [
      ticketNumber,
      subject,
      description,
      customer_name,
      customer_email,
      priority,
      now.toISOString(),
      deadlines.sla_reply_deadline,
      deadlines.sla_resolve_deadline
    ]);

    const createdTicket = await queryOne('SELECT * FROM tickets WHERE ticket_number = $1', [ticketNumber]);

    // Record creation in audit trail (INC-0318)
    await recordAudit({
      ticketId: createdTicket.id,
      actorName: customer_name,
      action: 'ticket_created',
      details: {
        priority,
        sla_reply_deadline: deadlines.sla_reply_deadline,
        sla_resolve_deadline: deadlines.sla_resolve_deadline
      }
    });

    res.status(201).json(createdTicket);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ticket', details: err.message });
  }
});

/**
 * PATCH /api/tickets/:id/assign
 * INC-0291 Enforcement: Atomic ticket assignment to prevent race condition collision
 */
router.patch('/:id/assign', authMiddleware, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const agentId = req.agent.id;
    const agentName = req.agent.name;

    // Check current ticket state
    const existing = await queryOne(
      `SELECT t.*, a.name as current_assignee_name
       FROM tickets t
       LEFT JOIN agents a ON t.assigned_to = a.id
       WHERE t.id = $1`,
      [ticketId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // If already assigned to someone else
    if (existing.assigned_to && existing.assigned_to !== agentId) {
      return res.status(409).json({
        error: 'Ticket assignment conflict (INC-0291)',
        message: `This ticket has already been taken by ${existing.current_assignee_name || 'another agent'}.`,
        assigned_to: existing.assigned_to,
        assignee_name: existing.current_assignee_name
      });
    }

    // Atomic update enforcing assigned_to IS NULL or assigned to current agent
    const updateRes = await query(
      `UPDATE tickets
       SET assigned_to = $1,
           status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
           version = version + 1
       WHERE id = $2 AND (assigned_to IS NULL OR assigned_to = $1)`,
      [agentId, ticketId]
    );

    const changed = updateRes.rowCount !== undefined ? updateRes.rowCount : 1;
    if (changed === 0) {
      return res.status(409).json({
        error: 'Assignment collision detected',
        message: 'Another agent took this ticket at the exact same moment.'
      });
    }

    // Record audit event
    await recordAudit({
      ticketId,
      agentId,
      actorName: agentName,
      action: 'ticket_assigned',
      details: `Ticket assigned exclusively to ${agentName}.`
    });

    const updated = await queryOne(
      `SELECT t.*, a.name as assignee_name, a.email as assignee_email
       FROM tickets t
       LEFT JOIN agents a ON t.assigned_to = a.id
       WHERE t.id = $1`,
      [ticketId]
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign ticket', details: err.message });
  }
});

/**
 * PATCH /api/tickets/:id/priority
 * Solves Meera Question: Recalculate SLA when priority changes mid-ticket
 */
router.patch('/:id/priority', authMiddleware, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { priority } = req.body;

    if (!['critical', 'medium', 'low'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority value' });
    }

    const ticket = await queryOne('SELECT * FROM tickets WHERE id = $1', [ticketId]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const oldPriority = ticket.priority;
    if (oldPriority === priority) {
      return res.json(ticket);
    }

    // Recalculate deadlines with SLA Engine
    const recalculated = recalculateOnPriorityChange(ticket, priority, new Date());

    await query(
      `UPDATE tickets
       SET priority = $1,
           sla_reply_deadline = $2,
           sla_resolve_deadline = $3,
           sla_reply_breached = $4,
           sla_resolve_breached = $5,
           version = version + 1
       WHERE id = $6`,
      [
        priority,
        recalculated.sla_reply_deadline,
        recalculated.sla_resolve_deadline,
        recalculated.sla_reply_breached,
        recalculated.sla_resolve_breached,
        ticketId
      ]
    );

    // Record audit trail
    await recordAudit({
      ticketId,
      agentId: req.agent.id,
      actorName: req.agent.name,
      action: 'priority_changed',
      details: {
        from: oldPriority,
        to: priority,
        new_reply_deadline: recalculated.sla_reply_deadline,
        new_resolve_deadline: recalculated.sla_resolve_deadline,
        breached: recalculated.sla_reply_breached || recalculated.sla_resolve_breached
      }
    });

    const updated = await queryOne('SELECT * FROM tickets WHERE id = $1', [ticketId]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to change priority', details: err.message });
  }
});

/**
 * PATCH /api/tickets/:id/status
 * Handles SLA pause when waiting_on_customer, resume when moving back to in_progress,
 * and records resolution/close timestamps
 */
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { status } = req.body;

    if (!['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const ticket = await queryOne('SELECT * FROM tickets WHERE id = $1', [ticketId]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const oldStatus = ticket.status;
    if (oldStatus === status) {
      return res.json(ticket);
    }

    const now = new Date();
    let slaPausedAt = ticket.sla_paused_at;
    let totalPausedMinutes = ticket.sla_total_paused_minutes || 0;
    let replyDeadline = ticket.sla_reply_deadline;
    let resolveDeadline = ticket.sla_resolve_deadline;
    let resolvedAt = ticket.resolved_at;
    let closedAt = ticket.closed_at;

    // Moving TO waiting_on_customer -> Pause SLA
    if (status === 'waiting_on_customer') {
      slaPausedAt = now.toISOString();
    }

    // Moving FROM waiting_on_customer to another active status -> Resume SLA
    if (oldStatus === 'waiting_on_customer' && status !== 'waiting_on_customer') {
      const resumed = resumeSLATimer(ticket, now);
      slaPausedAt = null;
      totalPausedMinutes = resumed.sla_total_paused_minutes;
      replyDeadline = resumed.sla_reply_deadline;
      resolveDeadline = resumed.sla_resolve_deadline;
    }

    if (status === 'resolved' && !resolvedAt) {
      resolvedAt = now.toISOString();
    }

    if (status === 'closed' && !closedAt) {
      closedAt = now.toISOString();
    }

    await query(
      `UPDATE tickets
       SET status = $1,
           sla_paused_at = $2,
           sla_total_paused_minutes = $3,
           sla_reply_deadline = $4,
           sla_resolve_deadline = $5,
           resolved_at = $6,
           closed_at = $7,
           version = version + 1
       WHERE id = $8`,
      [status, slaPausedAt, totalPausedMinutes, replyDeadline, resolveDeadline, resolvedAt, closedAt, ticketId]
    );

    // Record in immutable audit log
    await recordAudit({
      ticketId,
      agentId: req.agent.id,
      actorName: req.agent.name,
      action: 'status_changed',
      details: {
        from: oldStatus,
        to: status,
        sla_paused: status === 'waiting_on_customer',
        sla_resumed: oldStatus === 'waiting_on_customer'
      }
    });

    const updated = await queryOne('SELECT * FROM tickets WHERE id = $1', [ticketId]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ticket status', details: err.message });
  }
});

/**
 * POST /api/tickets/:id/reopen
 * Reopen resolved ticket within 1 working week window (Meera's rule)
 */
router.post('/:id/reopen', optionalAuthMiddleware, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await queryOne('SELECT * FROM tickets WHERE id = $1', [ticketId]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const check = canReopenTicket(ticket, new Date());
    if (!check.allowed) {
      return res.status(400).json({
        error: 'Cannot reopen ticket',
        reason: check.reason
      });
    }

    await query(
      `UPDATE tickets
       SET status = 'in_progress',
           resolved_at = NULL,
           version = version + 1
       WHERE id = $1`,
      [ticketId]
    );

    const actorName = req.agent ? req.agent.name : ticket.customer_name;
    await recordAudit({
      ticketId,
      agentId: req.agent?.id || null,
      actorName,
      action: 'ticket_reopened',
      details: 'Ticket reopened within allowable 1-week resolution window.'
    });

    const updated = await queryOne('SELECT * FROM tickets WHERE id = $1', [ticketId]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reopen ticket', details: err.message });
  }
});

/**
 * GET /api/tickets/:id/export
 * INC-0304 Hard Rule: Export strictly strips any private internal notes
 */
router.get('/:id/export', async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await queryOne(
      `SELECT t.*, a.name as assignee_name
       FROM tickets t
       LEFT JOIN agents a ON t.assigned_to = a.id
       WHERE t.id = $1`,
      [ticketId]
    );

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // STRICT QUERY: NEVER SELECT INTERNAL NOTES FOR EXPORT
    const publicComments = await query(
      `SELECT id, ticket_id, author_name, author_type, body, created_at
       FROM comments
       WHERE ticket_id = $1 AND (is_internal = 0 OR is_internal = false)
       ORDER BY created_at ASC`,
      [ticketId]
    );

    const exportData = {
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      description: ticket.description,
      customer: ticket.customer_name,
      status: ticket.status,
      priority: ticket.priority,
      assignedTo: ticket.assignee_name || 'Unassigned',
      createdAt: ticket.created_at,
      resolvedAt: ticket.resolved_at,
      closedAt: ticket.closed_at,
      conversationThread: publicComments
    };

    res.json(exportData);
  } catch (err) {
    res.status(500).json({ error: 'Export failed', details: err.message });
  }
});

export default router;
