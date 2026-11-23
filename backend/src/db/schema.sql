-- Frontdesk PostgreSQL Schema
-- Designed for Arvo Systems Support Desk

CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'agent',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(150) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('critical', 'medium', 'low')),
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed')),
    assigned_to INTEGER REFERENCES agents(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    sla_reply_deadline TIMESTAMPTZ NOT NULL,
    sla_resolve_deadline TIMESTAMPTZ NOT NULL,
    sla_paused_at TIMESTAMPTZ,
    sla_total_paused_minutes INTEGER DEFAULT 0,
    sla_reply_breached BOOLEAN DEFAULT FALSE,
    sla_resolve_breached BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agents(id),
    author_name VARCHAR(100) NOT NULL,
    author_type VARCHAR(20) NOT NULL CHECK (author_type IN ('agent', 'customer', 'system')),
    body TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agents(id),
    actor_name VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Immutable Audit Log Enforcement: Prevent UPDATE and DELETE
CREATE OR REPLACE RULE no_update_audit AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_audit AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- Indexes for high-frequency queries
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_comments_ticket_id ON comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_comments_is_internal ON comments(is_internal);
CREATE INDEX IF NOT EXISTS idx_audit_ticket_id ON audit_log(ticket_id);
