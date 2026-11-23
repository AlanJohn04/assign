import React from 'react';
import { Search, AlertCircle, Clock, Pause, CheckCircle } from 'lucide-react';

export default function TicketList({
  tickets,
  selectedTicketId,
  onSelectTicket,
  searchTerm,
  onSearchChange
}) {
  return (
    <div className="ticket-list-pane">
      <div className="list-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Tickets ({tickets.length})</h2>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            className="search-input"
            style={{ paddingLeft: '32px' }}
            placeholder="Search tickets, subject, customer..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="ticket-items-scroll">
        {tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: '13px' }}>
            No tickets match your filters
          </div>
        ) : (
          tickets.map((t) => {
            const isSelected = selectedTicketId === t.id;
            const isBreached = t.is_breached || t.sla_reply_breached || t.sla_resolve_breached;
            const isPaused = t.status === 'waiting_on_customer';

            return (
              <div
                key={t.id}
                className={`ticket-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectTicket(t.id)}
              >
                <div className="ticket-card-header">
                  <span className="ticket-num">{t.ticket_number}</span>
                  <span className="badge badge-status">
                    {t.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="ticket-title">{t.subject}</div>

                <div className="ticket-meta">
                  <span>{t.customer_name}</span>
                  <span>{t.assignee_name ? `👤 ${t.assignee_name.split(' ')[0]}` : '⚠️ Unassigned'}</span>
                </div>

                <div className="badges-row">
                  <span className={`badge badge-${t.priority}`}>
                    {t.priority.toUpperCase()}
                  </span>

                  {isBreached && (
                    <span className="badge badge-breached">
                      <AlertCircle size={12} />
                      SLA LATE
                    </span>
                  )}

                  {isPaused && (
                    <span className="badge badge-paused">
                      <Pause size={12} />
                      SLA Paused
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
