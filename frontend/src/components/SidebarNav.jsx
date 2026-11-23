import React from 'react';
import {
  Inbox,
  UserCheck,
  HelpCircle,
  AlertTriangle,
  PauseCircle,
  PlusCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  User,
  Clock,
  Activity
} from 'lucide-react';

export default function SidebarNav({
  agents,
  currentAgent,
  onSelectAgent,
  onOpenNewTicket,
  customerMode,
  onToggleCustomerMode,
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
    { id: 'critical', label: 'Critical (2h / Same Day)' },
    { id: 'medium', label: 'Medium (4.5h / 3 Days)' },
    { id: 'low', label: 'Low (1 Day / 1 Week)' }
  ];

  const initials = currentAgent?.name
    ? currentAgent.name.split(' ').map(n => n[0]).join('')
    : 'A';

  return (
    <aside className="dark-sidebar">
      {/* Brand Header */}
      <div className="dark-sidebar-brand">
        <div className="brand-logo-icon">F</div>
        <div className="brand-title-wrap">
          <h1 className="brand-app-name">Frontdesk</h1>
          <span className="brand-company-name">Arvo Systems</span>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="dark-sidebar-actions">
        <button className="btn-create-ticket" onClick={onOpenNewTicket}>
          <PlusCircle size={16} />
          <span>New Problem Ticket</span>
        </button>

        {/* Customer Perspective Simulator Toggle (INC-0304) */}
        <button
          className={`btn-customer-toggle ${customerMode ? 'active-customer-mode' : ''}`}
          onClick={onToggleCustomerMode}
          title="Toggle view as customer to verify private notes never leak"
        >
          {customerMode ? <EyeOff size={15} /> : <Eye size={15} />}
          <span>{customerMode ? 'Customer View Active' : 'Verify Customer View'}</span>
        </button>
      </div>

      {/* Agent Profile & Switcher */}
      <div className="dark-agent-card">
        <div className="agent-avatar-circle">
          {customerMode ? 'C' : initials}
        </div>
        <div className="agent-info-wrap">
          <div className="agent-name-text">
            {customerMode ? 'Customer Session' : currentAgent?.name || 'Agent'}
          </div>
          <div className="agent-role-text">
            {customerMode ? 'External Client' : currentAgent?.role || 'Support'}
          </div>
        </div>

        {!customerMode && (
          <select
            className="dark-agent-select"
            value={currentAgent?.id || ''}
            onChange={(e) => onSelectAgent(Number(e.target.value))}
            title="Switch active Arvo agent"
          >
            {agents.map((ag) => (
              <option key={ag.id} value={ag.id}>
                Switch: {ag.name} ({ag.role})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Navigation Links / Queue Views */}
      <div className="dark-nav-section">
        <div className="dark-section-title">Queue Views</div>
        <div className="dark-nav-list">
          {filterItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeFilter === item.id;
            return (
              <button
                key={item.id}
                className={`dark-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onChangeFilter(item.id)}
              >
                <div className="nav-item-left">
                  <Icon
                    size={16}
                    className={`nav-icon ${item.alert && item.count > 0 ? 'icon-alert' : ''}`}
                  />
                  <span>{item.label}</span>
                </div>
                <span
                  className={`dark-counter-badge ${
                    item.alert && item.count > 0 ? 'counter-alert' : ''
                  }`}
                >
                  {item.count || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SLA Tier / Priority Filters */}
      <div className="dark-nav-section">
        <div className="dark-section-title">SLA Priority Filter</div>
        <div className="dark-nav-list">
          {priorities.map((p) => (
            <button
              key={p.id}
              className={`dark-nav-item ${activePriority === p.id ? 'active' : ''}`}
              onClick={() => onChangePriority(p.id)}
            >
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="dark-sidebar-footer">
        <div className="sla-hours-status">
          <div className="status-indicator-dot"></div>
          <div>
            <div className="sla-hours-title">SLA Clock: Mon–Fri 09:30–18:30</div>
            <div className="sla-hours-sub">Weekends & Festivals Excluded</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
