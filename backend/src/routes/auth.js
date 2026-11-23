import express from 'express';
import { query, queryOne } from '../db/index.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// List all 9 Arvo agents
router.get('/agents', async (req, res) => {
  try {
    const agents = await query('SELECT id, name, email, role, created_at FROM agents ORDER BY id ASC');
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve agents', details: err.message });
  }
});

// Switch/Login as an agent by email or agentId
router.post('/login', async (req, res) => {
  try {
    const { email, agentId } = req.body;
    let agent;
    if (agentId) {
      agent = await queryOne('SELECT id, name, email, role FROM agents WHERE id = $1', [agentId]);
    } else if (email) {
      agent = await queryOne('SELECT id, name, email, role FROM agents WHERE LOWER(email) = LOWER($1)', [email]);
    } else {
      // Default to Meera Nair (Support Lead) for quick access
      agent = await queryOne('SELECT id, name, email, role FROM agents WHERE id = 1');
    }

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const token = generateToken(agent);
    res.json({
      token,
      agent
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// Get current logged-in agent profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const agent = await queryOne('SELECT id, name, email, role FROM agents WHERE id = $1', [req.agent.id]);
    if (!agent) {
      return res.status(404).json({ error: 'Agent profile not found' });
    }
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent profile', details: err.message });
  }
});

export default router;
