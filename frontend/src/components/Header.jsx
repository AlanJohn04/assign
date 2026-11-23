import React from 'react';
import { PlusCircle, ShieldAlert, User, Eye, EyeOff } from 'lucide-react';

export default function Header({
  agents,
  currentAgent,
  onSelectAgent,
  onOpenNewTicket,
  customerMode,
  onToggleCustomerMode
}) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-logo">F</div>
        <div className="brand-text">
          <h1>Frontdesk</h1>
          <span>Arvo Systems Support Desk</span>
        </div>
      </div>

      <div className="header-actions">
        {/* Toggle Customer Perspective Mode (INC-0304 Verifier) */}
        <button
          className="btn-outline"
          onClick={onToggleCustomerMode}
          title="Toggle view as customer to verify internal notes are never shown"
          style={customerMode ? { background: '#fef2f2', borderColor: '#ef4444', color: '#b91c1c' } : {}}
        >
          {customerMode ? <EyeOff size={16} /> : <Eye size={16} />}
          {customerMode ? 'Viewing as Customer (Internal Notes Stripped)' : 'Verify Customer View'}
        </button>

        {/* Create Ticket */}
        <button className="btn-primary" onClick={onOpenNewTicket}>
          <PlusCircle size={16} />
          New Problem Ticket
        </button>

        {/* 9 Arvo Agents Switcher */}
        {!customerMode && (
          <div className="agent-selector-wrapper">
            <User size={14} color="#64748b" />
            <span className="agent-selector-label">Agent:</span>
            <select
              className="agent-select"
              value={currentAgent?.id || ''}
              onChange={(e) => onSelectAgent(Number(e.target.value))}
            >
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.name} ({ag.role})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </header>
  );
}
