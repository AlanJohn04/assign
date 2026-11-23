import { query } from '../db/index.js';

/**
 * Append-only Audit Service
 * Enforces INC-0318: The system must record exactly what happened, when it happened,
 * and who did it. Nobody should be able to change that record later.
 * No UPDATE or DELETE functions are exposed.
 */
export async function recordAudit({ ticketId, agentId = null, actorName, action, details = null }) {
  const timestamp = new Date().toISOString();
  await query(
    `INSERT INTO audit_log (ticket_id, agent_id, actor_name, action, details, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [ticketId, agentId, actorName, action, typeof details === 'object' ? JSON.stringify(details) : details, timestamp]
  );
}

export async function getAuditTrail(ticketId) {
  return await query(
    `SELECT id, ticket_id, agent_id, actor_name, action, details, created_at
     FROM audit_log
     WHERE ticket_id = $1
     ORDER BY created_at ASC, id ASC`,
    [ticketId]
  );
}
