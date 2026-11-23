import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'frontdesk-arvo-secret-key-2026';

export function generateToken(agent) {
  return jwt.sign(
    { id: agent.id, name: agent.name, email: agent.email, role: agent.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.agent = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Optional auth: allows both agents and public/customer calls, setting req.agent if token is present
export function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.agent = decoded;
    } catch {
      req.agent = null;
    }
  } else {
    req.agent = null;
  }
  next();
}
