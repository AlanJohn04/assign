import express from 'express';
import { query, queryOne } from '../db/index.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { recordAudit } from '../services/auditService.js';
import { resumeSLATimer } from '../services/slaEngine.js';

const router = express.Router({ mergeParams: true });

/**
 * POST /api/tickets/:id/comments
 * Handles:
 * 1. Agent reply to customer (public)
 * 2. Agent private internal note (is_internal = true)
 * 3. Customer reply (resumes SLA if ticket was waiting on customer)
 */
router.post('/:id/comments', optionalAuthMiddleware, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { body, is_internal = false, author_type } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Comment body cannot be empty' });
    }

    const ticket = await queryOne('SELECT * FROM tickets WHERE id = $1', [ticketId]);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const isInternalNote = Boolean(is_internal);
    const isAgent = Boolean(req.agent);

    // Guard: Only authenticated agents can post internal notes
    if (isInternalNote && !isAgent) {
      return res.status(403).json({ error: 'Only authenticated support agents can create internal notes' });
    }

    const now = new Date();
    let authorName = '';
    let authorType = '';
    let agentId = null;

    if (isAgent) {
      authorName = req.agent.name;
      authorType = 'agent';
      agentId = req.agent.id;
    } else {
      authorName = ticket.customer_name;
      authorType = 'customer';
    }

    // Insert comment
    await query(
      `INSERT INTO comments (ticket_id, agent_id, author_name, author_type, body, is_internal, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [ticketId, agentId, authorName, authorType, body.trim(), isInternalNote ? 1 : 0, now.toISOString()]
    );

    const actorName = authorName;

    // Business Logic Handling:
    if (isAgent && !isInternalNote) {
      // 1. Agent replied publicly to customer
      // Check if this is the first response
      if (!ticket.first_response_at) {
        const replyDeadline = new Date(ticket.sla_reply_deadline);
        const isBreached = now > replyDeadline;
        await query(
          `UPDATE tickets
           SET first_response_at = $1,
               sla_reply_breached = $2,
               version = version + 1
           WHERE id = $3`,
          [now.toISOString(), isBreached ? 1 : 0, ticketId]
        );

        await recordAudit({
          ticketId,
          agentId,
          actorName,
          action: 'first_response_sent',
          details: {
            first_response_at: now.toISOString(),
            sla_reply_deadline: ticket.sla_reply_deadline,
            breached: isBreached
          }
        });
      }

      await recordAudit({
        ticketId,
        agentId,
        actorName,
        action: 'agent_reply_sent',
        details: 'Public response sent to customer.'
      });

    } else if (isAgent && isInternalNote) {
      // 2. Private internal team note
      await recordAudit({
        ticketId,
        agentId,
        actorName,
        action: 'internal_note_added',
        details: 'Private team note recorded (hidden from customer).'
      });

    } else if (!isAgent) {
      // 3. Customer reply
      // If ticket was waiting on customer, resume SLA timer and move back to in_progress!
      if (ticket.status === 'waiting_on_customer') {
        const resumed = resumeSLATimer(ticket, now);
        await query(
          `UPDATE tickets
           SET status = 'in_progress',
               sla_paused_at = NULL,
               sla_total_paused_minutes = $1,
               sla_reply_deadline = $2,
               sla_resolve_deadline = $3,
               version = version + 1
           WHERE id = $4`,
          [resumed.sla_total_paused_minutes, resumed.sla_reply_deadline, resumed.sla_resolve_deadline, ticketId]
        );

        await recordAudit({
          ticketId,
          actorName: ticket.customer_name,
          action: 'customer_replied',
          details: {
            message: 'Customer provided response. SLA timer resumed.',
            paused_minutes_added: resumed.sla_total_paused_minutes - (ticket.sla_total_paused_minutes || 0),
            new_resolve_deadline: resumed.sla_resolve_deadline
          }
        });
      } else {
        await recordAudit({
          ticketId,
          actorName: ticket.customer_name,
          action: 'customer_replied',
          details: 'Customer sent follow-up message.'
        });
      }
    }

    // Return the newly created comment
    const created = await queryOne(
      'SELECT * FROM comments WHERE ticket_id = $1 ORDER BY id DESC LIMIT 1',
      [ticketId]
    );

    res.status(201).json({
      ...created,
      is_internal: Boolean(created.is_internal)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post comment', details: err.message });
  }
});

export default router;
