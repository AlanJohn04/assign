import express from 'express';
import { getAuditTrail } from '../services/auditService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

/**
 * GET /api/tickets/:id/audit
 * INC-0318 Enforcement: Verifiable, immutable history of everything that happened
 * NOTE: There are deliberately NO PUT, PATCH, or DELETE routes in this service.
 */
router.get('/:id/audit', authMiddleware, async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const trail = await getAuditTrail(ticketId);
    res.json(trail);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve audit trail', details: err.message });
  }
});

export default router;
