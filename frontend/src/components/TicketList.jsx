import React from 'react';
import { Search, AlertCircle, Clock, Pause, CheckCircle, Flame, User } from 'lucide-react';

export default function TicketList({
  tickets,
  selectedTicketId,
  onSelectTicket,
  searchTerm,
  onSearchChange
}) {
  return (
    <div className="ticket-list-pane">
      <div className="list-search-header">
        <div className="search-title-row">
          <span className="queue-label-heading">Problems Queue</span>
          <span className="queue-total-count">{tickets.length}</span>
        </div>

        <div className="search-input-wrapper">
          <Search size={14} className="search-icon-inside" />
          <input
            type="text"
            className="search-field"
            placeholder="Search tickets, subject, customer..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="ticket-cards-column">
        {tickets.length === 0 ? (
          <div className="empty-tickets-view">
            <p>No tickets found matching your filters</p>
          </div>
        ) : (
          tickets.map((t) => {
            const isSelected = selectedTicketId === t.id;
            const isBreached = t.is_breached || t.sla_reply_breached || t.sla_resolve_breached;
            const isPaused = t.status === 'waiting_on_customer';

            return (
              <div
                key={t.id}
                className={`ticket-summary-card ${isSelected ? 'active-ticket' : ''} priority-border-${t.priority}`}
                onClick={() => onSelectTicket(t.id)}
              >
                <div className="card-top-meta">
                  <span className="card-ticket-id">{t.ticket_number}</span>
                  <span className={`status-badge-tag status-${t.status}`}>
                    {t.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="card-ticket-subject">{t.subject}</div>

                <div className="card-reporter-assignee">
                  <span className="reporter-name">{t.customer_name}</span>
                  <span className={`assignee-name ${t.assigned_to ? 'has-assignee' : 'no-assignee'}`}>
                    {t.assignee_name ? `👤 ${t.assignee_name.split(' ')[0]}` : '⚠️ Unassigned'}
                  </span>
                </div>

                <div className="card-tags-row">
                  <span className={`priority-tag-mini tag-${t.priority}`}>
                    {t.priority.toUpperCase()}
                  </span>

                  {isBreached && (
                    <span className="sla-alert-pill">
                      <AlertCircle size={11} /> SLA LATE
                    </span>
                  )}

                  {isPaused && (
                    <span className="sla-pause-pill">
                      <Pause size={11} /> SLA Paused
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
