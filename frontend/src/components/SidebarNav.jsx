import React from 'react';
import {
  Inbox,
  UserCheck,
  HelpCircle,
  AlertTriangle,
  PauseCircle,
  PlusCircle,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Shield,
  Clock,
  Sparkles
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
  counts,
  isCollapsed,
  onToggleCollapse
}) {
  const filterItems = [
    { id: 'all', label: 'All Tickets', icon: Inbox, count: counts.all },
    { id: 'me', label: 'Assigned to Me', icon: UserCheck, count: counts.me },
    { id: 'unassigned', label: 'Unassigned', icon: HelpCircle, count: counts.unassigned },
    { id: 'late', label: 'Late / Breached', icon: AlertTriangle, count: counts.late, alert: true },
    { id: 'waiting', label: 'Waiting on Customer', icon: PauseCircle, count: counts.waiting }
  ];

  const priorities = [
    { id: 'all', label: 'All Priorities', short: 'All' },
    { id: 'critical', label: 'Critical (2h / Same Day)', short: 'Critical' },
    { id: 'medium', label: 'Medium (4.5h / 3 Days)', short: 'Medium' },
    { id: 'low', label: 'Low (1 Day / 1 Week)', short: 'Low' }
  ];

  const initials = currentAgent?.name
    ? currentAgent.name.split(' ').map((n) => n[0]).join('')
    : 'A';

  return (
    <aside className={`dark-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Top Header with Brand & Collapse Toggle */}
      <div className="dark-sidebar-header">
        {!isCollapsed && (
          <div className="dark-brand-block">
            <div className="brand-logo-glow">
              <span>F</span>
            </div>
            <div className="brand-text-block">
              <div className="brand-main-title">Frontdesk</div>
              <div className="brand-subtitle">Arvo Systems</div>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="brand-logo-glow compact" title="Frontdesk · Arvo Systems">
            <span>F</span>
          </div>
        )}

        {/* Clickable Navbar Toggle to Collapse/Expand */}
        <button
          className="btn-collapse-toggle"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Hide sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Primary Action Button */}
      <div className="sidebar-action-wrap">
        <button
          className={`btn-new-ticket ${isCollapsed ? 'compact' : ''}`}
          onClick={onOpenNewTicket}
          title="Create New Problem Ticket"
        >
          <PlusCircle size={17} />
          {!isCollapsed && <span>New Problem</span>}
        </button>

        {!isCollapsed && (
          <button
            className={`btn-verify-customer ${customerMode ? 'active' : ''}`}
            onClick={onToggleCustomerMode}
            title="Toggle customer perspective to prove private team notes never leak"
          >
            {customerMode ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{customerMode ? 'Customer View Active' : 'Verify Customer View'}</span>
          </button>
        )}
      </div>

      {/* Agent Identity Card & Switcher */}
      <div className={`agent-profile-card ${isCollapsed ? 'compact' : ''}`}>
        <div className="agent-avatar" title={`${currentAgent?.name} (${currentAgent?.role})`}>
          {customerMode ? 'C' : initials}
        </div>

        {!isCollapsed && (
          <div className="agent-text-wrap">
            <div className="agent-primary-name">
              {customerMode ? 'Customer Session' : currentAgent?.name || 'Agent'}
            </div>
            <div className="agent-secondary-role">
              {customerMode ? 'External View' : currentAgent?.role || 'Support'}
            </div>
          </div>
        )}

        {!customerMode && (
          <select
            className="agent-hidden-select"
            value={currentAgent?.id || ''}
            onChange={(e) => onSelectAgent(Number(e.target.value))}
            title="Click to switch support agent"
          >
            {agents.map((ag) => (
              <option key={ag.id} value={ag.id}>
                Switch to: {ag.name} ({ag.role})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="sidebar-nav-scroll">
        <div className="nav-group-section">
          {!isCollapsed && <div className="nav-group-heading">Queues</div>}
          <div className="nav-links-column">
            {filterItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeFilter === item.id;
              const isAlert = item.alert && item.count > 0;

              return (
                <button
                  key={item.id}
                  className={`sidebar-nav-button ${isActive ? 'active' : ''} ${
                    isCollapsed ? 'compact' : ''
                  }`}
                  onClick={() => onChangeFilter(item.id)}
                  title={`${item.label} (${item.count || 0})`}
                >
                  <div className="button-label-left">
                    <Icon size={17} className={`nav-icon ${isAlert ? 'alert-pulse' : ''}`} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>

                  {!isCollapsed && (
                    <span className={`pill-counter ${isAlert ? 'pill-alert' : ''}`}>
                      {item.count || 0}
                    </span>
                  )}

                  {isCollapsed && isAlert && <div className="collapsed-alert-dot" />}
                </button>
              );
            })}
          </div>
        </div>

        {!isCollapsed && (
          <div className="nav-group-section" style={{ marginTop: '16px' }}>
            <div className="nav-group-heading">SLA Priority Filter</div>
            <div className="nav-links-column">
              {priorities.map((p) => (
                <button
                  key={p.id}
                  className={`sidebar-nav-button priority-btn ${
                    activePriority === p.id ? 'active' : ''
                  }`}
                  onClick={() => onChangePriority(p.id)}
                >
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className={`sidebar-bottom-footer ${isCollapsed ? 'compact' : ''}`}>
        <div className="sla-live-badge">
          <div className="live-dot" />
          {!isCollapsed && (
            <div className="sla-hours-text">
              <span className="sla-label">SLA Clock: 09:30–18:30</span>
              <span className="sla-sub">Mon–Fri · Holidays Off</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
