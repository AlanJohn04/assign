const API_BASE = '/api';

function getHeaders() {
  const token = localStorage.getItem('frontdesk_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchAgents() {
  const res = await fetch(`${API_BASE}/auth/agents`);
  if (!res.ok) throw new Error('Failed to load agents');
  return res.json();
}

export async function loginAgent(agentId) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId })
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  localStorage.setItem('frontdesk_token', data.token);
  localStorage.setItem('frontdesk_agent', JSON.stringify(data.agent));
  return data;
}

export function getStoredAgent() {
  const str = localStorage.getItem('frontdesk_agent');
  return str ? JSON.parse(str) : null;
}

export function logoutAgent() {
  localStorage.removeItem('frontdesk_token');
  localStorage.removeItem('frontdesk_agent');
}

export async function fetchTickets(params = {}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      query.append(key, val);
    }
  }
  const res = await fetch(`${API_BASE}/tickets?${query.toString()}`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch tickets');
  return res.json();
}

export async function fetchTicket(id, asCustomer = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (!asCustomer) {
    const token = localStorage.getItem('frontdesk_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/tickets/${id}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch ticket');
  return res.json();
}

export async function createTicket(ticketData) {
  const res = await fetch(`${API_BASE}/tickets`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(ticketData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create ticket');
  }
  return res.json();
}

export async function assignTicket(id) {
  const res = await fetch(`${API_BASE}/tickets/${id}/assign`, {
    method: 'PATCH',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.message || data.error || 'Failed to assign ticket');
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function updatePriority(id, priority) {
  const res = await fetch(`${API_BASE}/tickets/${id}/priority`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ priority })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update priority');
  }
  return res.json();
}

export async function updateStatus(id, status) {
  const res = await fetch(`${API_BASE}/tickets/${id}/status`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ status })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update status');
  }
  return res.json();
}

export async function postComment(id, { body, is_internal = false, author_type = null }) {
  const res = await fetch(`${API_BASE}/tickets/${id}/comments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ body, is_internal, author_type })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to post message');
  }
  return res.json();
}

export async function reopenTicket(id) {
  const res = await fetch(`${API_BASE}/tickets/${id}/reopen`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.reason || data.error || 'Cannot reopen ticket');
  }
  return data;
}

export async function fetchAuditTrail(id) {
  const res = await fetch(`${API_BASE}/tickets/${id}/audit`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch audit trail');
  return res.json();
}

export async function fetchExport(id) {
  const res = await fetch(`${API_BASE}/tickets/${id}/export`);
  if (!res.ok) throw new Error('Failed to export ticket');
  return res.json();
}
