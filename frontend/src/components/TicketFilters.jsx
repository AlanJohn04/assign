import React from 'react';
import { Inbox, UserCheck, HelpCircle, AlertTriangle, PauseCircle } from 'lucide-react';

export default function TicketFilters({
  activeFilter,
  onChangeFilter,
  activePriority,
  onChangePriority,
  counts
}) {
  const filterItems = [
    { id: 'all', label: 'All Tickets', icon: Inbox, count: counts.all },
    { id: 'me', label: 'Assigned to Me', icon: UserCheck, count: counts.me },
    { id: 'unassigned', label: 'Unassigned', icon: HelpCircle, count: counts.unassigned },
    { id: 'late', label: 'Late / SLA Breached', icon: AlertTriangle, count: counts.late, alert: true },
    { id: 'waiting', label: 'Waiting on Customer', icon: PauseCircle, count: counts.waiting }
  ];

  const priorities = [
    { id: 'all', label: 'All Priorities' },
    { id: 'critical', label: 'Critical (2h Reply / Same Day)' },
    { id: 'medium', label: 'Medium (4.5h Reply / 3 Days)' },
    { id: 'low', label: 'Low (1 Day Reply / 1 Week)' }
  ];

  return (
    <aside className="dashboard-sidebar">
      <div className="filter-section">
        <h3>Queue Views</h3>
        <div className="filter-list">
          {filterItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeFilter === item.id;
            return (
              <button
                key={item.id}
                className={`filter-item ${isActive ? 'active' : ''}`}
                onClick={() => onChangeFilter(item.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon size={16} color={item.alert && item.count > 0 ? '#ef4444' : undefined} />
                  <span>{item.label}</span>
                </div>
                <span
                  className="filter-count"
                  style={item.alert && item.count > 0 ? { background: '#fee2e2', color: '#991b1b', fontWeight: 700 } : {}}
                >
                  {item.count || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="filter-section">
        <h3>SLA Tier / Priority</h3>
        <div className="filter-list">
          {priorities.map((p) => (
            <button
              key={p.id}
              className={`filter-item ${activePriority === p.id ? 'active' : ''}`}
              onClick={() => onChangePriority(p.id)}
            >
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
