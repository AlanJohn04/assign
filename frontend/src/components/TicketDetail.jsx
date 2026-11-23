import React, { useState } from 'react';
import {
  Lock,
  Send,
  MessageSquare,
  Clock,
  AlertCircle,
  Pause,
  CheckCircle,
  RotateCcw,
  UserCheck,
  ShieldAlert,
  FileText,
  Copy,
  Check,
  Sparkles,
  Paperclip,
  Smile,
  CornerDownLeft,
  Mail,
  User,
  ShieldCheck,
  Flame,
  Info
} from 'lucide-react';

export default function TicketDetail({
  ticket,
  currentAgent,
  customerMode,
  onAssign,
  onUpdateStatus,
  onUpdatePriority,
  onPostComment,
  onReopen,
  auditTrail,
  exportData,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState('conversation'); // 'conversation', 'audit', 'export'
  const [composerMode, setComposerMode] = useState('reply'); // 'reply' (public) or 'internal' (team only)
  const [commentText, setCommentText] = useState('');
  const [markWaiting, setMarkWaiting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflictError, setConflictError] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!ticket) {
    return (
      <div className="ticket-detail-empty">
        <div className="empty-state-card">
          <div className="empty-icon-ring">
            <MessageSquare size={36} />
          </div>
          <h3>Select a Support Ticket</h3>
          <p>Choose any customer problem from the queue to start investigating, review SLA deadlines, and collaborate.</p>
        </div>
      </div>
    );
  }

  const isAssignedToMe = currentAgent && ticket.assigned_to === currentAgent.id;
  const isUnassigned = !ticket.assigned_to;
  const isBreached = ticket.is_breached || ticket.sla_reply_breached || ticket.sla_resolve_breached;
  const isPaused = ticket.status === 'waiting_on_customer';

  // Format dates in readable human time
  const formatTime = (iso) => {
    if (!iso) return 'Pending';
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyTicketId = () => {
    navigator.clipboard.writeText(ticket.ticket_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTakeTicket = async () => {
    setConflictError(null);
    try {
      await onAssign(ticket.id);
    } catch (err) {
      if (err.status === 409) {
        setConflictError(err.message || 'Collision detected! Another agent took this ticket first.');
      } else {
        alert(err.message);
      }
    }
  };

  const applyTemplate = (templateText, autoWait = false) => {
    setCommentText(templateText);
    if (autoWait) setMarkWaiting(true);
  };

  const handleSubmitComment = async (e) => {
    if (e) e.preventDefault();
    if (!commentText.trim()) return;

    setSubmitting(true);
    try {
      const isInternal = composerMode === 'internal';
      await onPostComment(ticket.id, {
        body: commentText.trim(),
        is_internal: isInternal,
        author_type: customerMode ? 'customer' : 'agent'
      });

      // If agent checked mark as waiting on customer
      if (markWaiting && ticket.status !== 'waiting_on_customer') {
        await onUpdateStatus(ticket.id, 'waiting_on_customer');
      }

      setCommentText('');
      setMarkWaiting(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmitComment();
    }
  };

  return (
    <div className="ticket-detail-pane">
      {/* Top Header of Ticket */}
      <div className="detail-header-card">
        {/* INC-0291 Conflict Banner */}
        {conflictError && (
          <div className="conflict-alert-card">
            <div className="alert-content-left">
              <ShieldAlert size={20} />
              <div>
                <strong>Assignment Race Condition Blocked</strong>
                <p>{conflictError}</p>
              </div>
            </div>
            <button className="btn-alert-dismiss" onClick={() => setConflictError(null)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="header-meta-row">
          <div className="ticket-id-tag-group">
            <button className="ticket-number-chip" onClick={copyTicketId} title="Click to copy Ticket ID">
              <span>{ticket.ticket_number}</span>
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            </button>

            <span className={`priority-pill priority-${ticket.priority}`}>
              <Flame size={12} />
              {ticket.priority.toUpperCase()}
            </span>

            <span className={`status-pill status-${ticket.status}`}>
              {ticket.status.replace(/_/g, ' ').toUpperCase()}
            </span>

            {isPaused && (
              <span className="paused-pill">
                <Pause size={12} /> SLA Paused
              </span>
            )}

            {isBreached && (
              <span className="breached-pill">
                <AlertCircle size={12} /> SLA Breached
              </span>
            )}
          </div>

          {/* Action Controls for Agent */}
          {!customerMode && (
            <div className="header-action-controls">
              {/* INC-0291 Take Ticket */}
              {isUnassigned ? (
                <button className="btn-take-ticket" onClick={handleTakeTicket}>
                  ⚡ Take this Ticket
                </button>
              ) : isAssignedToMe ? (
                <div className="assigned-to-you-chip">
                  <UserCheck size={14} /> Assigned to You
                </div>
              ) : (
                <div className="assigned-other-chip">
                  <User size={13} /> {ticket.assignee_name || 'Assigned'}
                </div>
              )}

              {/* Priority Selector (Meera SLA Recalculation) */}
              <div className="custom-select-wrap">
                <select
                  className="sleek-select priority-select"
                  value={ticket.priority}
                  onChange={(e) => onUpdatePriority(ticket.id, e.target.value)}
                  title="Changing priority recalculates SLA deadlines"
                >
                  <option value="critical">🔴 Critical (2h reply / Same day)</option>
                  <option value="medium">🟡 Medium (4.5h reply / 3 days)</option>
                  <option value="low">🟢 Low (1 day reply / 1 week)</option>
                </select>
              </div>

              {/* Status Selector */}
              <div className="custom-select-wrap">
                <select
                  className="sleek-select status-select"
                  value={ticket.status}
                  onChange={(e) => onUpdateStatus(ticket.id, e.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting_on_customer">Waiting on Customer (Pause SLA)</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {/* Reopen button for resolved tickets within 1 week */}
              {ticket.status === 'resolved' && (
                <button
                  className="btn-reopen"
                  onClick={() => onReopen(ticket.id)}
                  title="Reopen allowed within 1 working week of resolution"
                >
                  <RotateCcw size={13} /> Reopen
                </button>
              )}
            </div>
          )}
        </div>

        {/* Ticket Title & Customer Info */}
        <div className="header-subject-row">
          <h2 className="ticket-subject-title">{ticket.subject}</h2>
          <div className="ticket-reporter-info">
            <span className="customer-avatar-small">
              {ticket.customer_name ? ticket.customer_name[0] : 'C'}
            </span>
            <span className="customer-name-bold">{ticket.customer_name}</span>
            <span className="customer-email-muted">&lt;{ticket.customer_email}&gt;</span>
            <span className="dot-separator">·</span>
            <span className="ticket-time-muted">Reported {formatTime(ticket.created_at)}</span>
          </div>
        </div>

        {/* SLA Telemetry Dashboard Banner */}
        <div className="sla-telemetry-banner">
          <div className="sla-metric-box">
            <div className="metric-label">
              <Clock size={12} /> First Reply SLA
            </div>
            <div className="metric-value-row">
              <span className={`metric-main-text ${ticket.is_reply_breached ? 'text-breached' : 'text-ontrack'}`}>
                {ticket.first_response_at ? 'Replied' : formatTime(ticket.sla_reply_deadline)}
              </span>
              <span className={`metric-status-tag ${ticket.is_reply_breached ? 'tag-breached' : 'tag-ontrack'}`}>
                {ticket.first_response_at
                  ? ticket.sla_reply_breached ? 'Breached' : 'On Time'
                  : ticket.is_reply_breached ? 'OVERDUE' : 'Active'}
              </span>
            </div>
            <div className="metric-subtext">
              Target: {ticket.priority === 'critical' ? '2h' : ticket.priority === 'medium' ? '4.5h' : '1 Day'}
            </div>
          </div>

          <div className="sla-metric-box">
            <div className="metric-label">
              <ShieldCheck size={12} /> Resolution SLA
            </div>
            <div className="metric-value-row">
              <span className={`metric-main-text ${ticket.is_resolve_breached ? 'text-breached' : 'text-ontrack'}`}>
                {ticket.resolved_at ? 'Resolved' : formatTime(ticket.sla_resolve_deadline)}
              </span>
              <span className={`metric-status-tag ${ticket.is_resolve_breached ? 'tag-breached' : 'tag-ontrack'}`}>
                {ticket.resolved_at
                  ? 'Completed'
                  : ticket.is_resolve_breached ? 'OVERDUE' : 'Active'}
              </span>
            </div>
            <div className="metric-subtext">
              Target: {ticket.priority === 'critical' ? 'Same Day' : ticket.priority === 'medium' ? '3 Days' : '1 Week'}
            </div>
          </div>

          <div className="sla-metric-box">
            <div className="metric-label">
              <Activity size={12} /> Clock State
            </div>
            <div className="metric-value-row">
              <span className="metric-main-text">
                {isPaused ? (
                  <span style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Pause size={14} /> Paused
                  </span>
                ) : ticket.status === 'resolved' || ticket.status === 'closed' ? (
                  <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={14} /> Stopped
                  </span>
                ) : (
                  <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="live-clock-pulse"></span> Running
                  </span>
                )}
              </span>
            </div>
            <div className="metric-subtext">
              {isPaused ? 'Waiting on Customer Reply' : '9:30 - 18:30 Mon-Fri'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="detail-tabs-bar">
        <button
          className={`tab-item-btn ${activeTab === 'conversation' ? 'active' : ''}`}
          onClick={() => setActiveTab('conversation')}
        >
          <MessageSquare size={15} />
          <span>Conversation Thread</span>
          <span className="tab-count-pill">{ticket.comments?.length ? ticket.comments.length + 1 : 1}</span>
        </button>

        <button
          className={`tab-item-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <FileText size={15} />
          <span>Immutable Audit Trail (INC-0318)</span>
          <span className="tab-count-pill">{auditTrail?.length || 0}</span>
        </button>

        <button
          className={`tab-item-btn ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          <Shield size={15} />
          <span>Customer Export Verifier (INC-0304)</span>
        </button>
      </div>

      {/* TAB: Conversation */}
      {activeTab === 'conversation' && (
        <div className="chat-thread-wrapper">
          <div className="chat-messages-container">
            {/* 1. Initial Problem Report by Customer */}
            <div className="message-bubble-row customer-row">
              <div className="bubble-avatar-column">
                <div className="avatar-customer">
                  {ticket.customer_name ? ticket.customer_name[0] : 'C'}
                </div>
              </div>

              <div className="bubble-card bubble-customer-card">
                <div className="bubble-card-header">
                  <div className="author-identity">
                    <span className="author-name">{ticket.customer_name}</span>
                    <span className="author-badge-client">Customer</span>
                    <span className="author-sub-action">reported this problem</span>
                  </div>
                  <span className="bubble-timestamp">{formatTime(ticket.created_at)}</span>
                </div>
                <div className="bubble-body-content">{ticket.description}</div>
              </div>
            </div>

            {/* 2. Thread of replies & internal notes */}
            {ticket.comments?.map((c) => {
              const isInternal = c.is_internal;
              const isCust = c.author_type === 'customer';

              if (isInternal) {
                // INC-0304 High-Tech Internal Note
                return (
                  <div key={c.id} className="internal-note-card">
                    <div className="internal-card-accent-bar"></div>
                    <div className="internal-card-body">
                      <div className="internal-header-row">
                        <div className="internal-badge-tag">
                          <Lock size={13} />
                          <span>CONFIDENTIAL INTERNAL TEAM NOTE</span>
                          <span className="internal-security-pill">NEVER SHOWN TO CUSTOMER</span>
                        </div>
                        <span className="internal-time-stamp">{formatTime(c.created_at)}</span>
                      </div>
                      <div className="internal-message-text">{c.body}</div>
                      <div className="internal-footer-meta">
                        <span>Logged by <strong>{c.author_name}</strong> for Arvo team</span>
                        <span className="dot-sep">•</span>
                        <span>Query-level locked (INC-0304)</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (isCust) {
                // Follow-up Customer Reply
                return (
                  <div key={c.id} className="message-bubble-row customer-row">
                    <div className="bubble-avatar-column">
                      <div className="avatar-customer">
                        {c.author_name ? c.author_name[0] : 'C'}
                      </div>
                    </div>
                    <div className="bubble-card bubble-customer-card">
                      <div className="bubble-card-header">
                        <div className="author-identity">
                          <span className="author-name">{c.author_name}</span>
                          <span className="author-badge-client">Customer Reply</span>
                        </div>
                        <span className="bubble-timestamp">{formatTime(c.created_at)}</span>
                      </div>
                      <div className="bubble-body-content">{c.body}</div>
                      <div className="customer-resumed-notice">
                        <Clock size={12} /> Resumed SLA clock upon arrival
                      </div>
                    </div>
                  </div>
                );
              }

              // Agent Public Reply
              return (
                <div key={c.id} className="message-bubble-row agent-row">
                  <div className="bubble-avatar-column">
                    <div className="avatar-agent">
                      {c.author_name ? c.author_name[0] : 'A'}
                    </div>
                  </div>
                  <div className="bubble-card bubble-agent-card">
                    <div className="bubble-card-header">
                      <div className="author-identity">
                        <span className="author-name">{c.author_name}</span>
                        <span className="author-badge-agent">Support Agent</span>
                      </div>
                      <span className="bubble-timestamp">{formatTime(c.created_at)}</span>
                    </div>
                    <div className="bubble-body-content">{c.body}</div>
                    <div className="agent-delivery-tag">
                      <Mail size={12} /> Sent to customer via email
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Response Templates */}
          {!customerMode && (
            <div className="templates-toolbar">
              <span className="templates-label">Quick Responses:</span>
              <button
                type="button"
                className="btn-template-chip"
                onClick={() => applyTemplate('Hello, we are actively investigating this issue and reviewing system diagnostics right now.')}
              >
                + Acknowledged & Investigating
              </button>
              <button
                type="button"
                className="btn-template-chip"
                onClick={() => applyTemplate('Could you please provide the steps to reproduce this along with screenshots or system error logs?', true)}
              >
                + Request Info & Logs (Pauses SLA)
              </button>
              <button
                type="button"
                className="btn-template-chip"
                onClick={() => applyTemplate('We have deployed a fix to resolve this issue. Please verify and let us know if everything is working.')}
              >
                + Propose Fix
              </button>
            </div>
          )}

          {/* Modern Action Composer */}
          <div className={`modern-composer-card ${composerMode === 'internal' ? 'mode-internal' : ''}`}>
            {/* Mode Switcher */}
            {!customerMode ? (
              <div className="composer-mode-bar">
                <button
                  type="button"
                  className={`composer-mode-pill ${composerMode === 'reply' ? 'active-reply' : ''}`}
                  onClick={() => setComposerMode('reply')}
                >
                  <Send size={13} />
                  <span>Public Reply to Customer</span>
                  <span className="recipient-tag">To: {ticket.customer_email}</span>
                </button>

                <button
                  type="button"
                  className={`composer-mode-pill ${composerMode === 'internal' ? 'active-internal' : ''}`}
                  onClick={() => setComposerMode('internal')}
                >
                  <Lock size={13} />
                  <span>Private Team Note (INC-0304)</span>
                  <span className="internal-lock-tag">Never Visible to Customer</span>
                </button>
              </div>
            ) : (
              <div className="customer-simulator-banner">
                <Info size={15} />
                <span>Simulating Customer Reply — Sending this message will automatically resume the SLA clock</span>
              </div>
            )}

            {/* Composer Input Area */}
            <form onSubmit={handleSubmitComment} className="composer-form">
              <textarea
                className={`composer-smart-textarea ${composerMode === 'internal' ? 'textarea-internal' : ''}`}
                placeholder={
                  customerMode
                    ? 'Type reply as customer (e.g. Here is the requested screenshot)...'
                    : composerMode === 'internal'
                    ? 'Write confidential team note... (Guaranteed private, team-only, never sent to customer)'
                    : `Reply to ${ticket.customer_name}...`
                }
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
              />

              <div className="composer-action-footer">
                <div className="footer-left-options">
                  {composerMode === 'internal' && !customerMode && (
                    <div className="internal-guard-notice">
                      <Lock size={13} />
                      <span>Strict Isolation: Excluded from customer views, API responses & exports.</span>
                    </div>
                  )}

                  {composerMode === 'reply' && !customerMode && (
                    <label className="checkbox-auto-wait">
                      <input
                        type="checkbox"
                        checked={markWaiting}
                        onChange={(e) => setMarkWaiting(e.target.checked)}
                      />
                      <span>Mark as <strong>Waiting on Customer</strong> (Pauses SLA timer)</span>
                    </label>
                  )}
                </div>

                <div className="footer-right-buttons">
                  <span className="shortcut-hint">Ctrl + Enter</span>
                  <button
                    type="submit"
                    disabled={submitting || !commentText.trim()}
                    className={`btn-send-message ${
                      composerMode === 'internal' && !customerMode ? 'btn-send-internal' : 'btn-send-reply'
                    }`}
                  >
                    {composerMode === 'internal' && !customerMode ? (
                      <>
                        <Lock size={14} /> Save Team Note
                      </>
                    ) : (
                      <>
                        <Send size={14} /> {customerMode ? 'Send Reply' : 'Send to Customer'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB: Immutable Audit Trail (INC-0318) */}
      {activeTab === 'audit' && (
        <div className="audit-tab-panel">
          <div className="audit-info-banner">
            <div className="audit-banner-title">
              <ShieldCheck size={18} />
              <span>INC-0318 Cryptographic Audit Trail</span>
            </div>
            <p>Every event is recorded in an immutable, append-only table. Nobody can update, backdate, or delete these records.</p>
          </div>

          <div className="audit-timeline-stream">
            {auditTrail?.map((log, index) => (
              <div key={log.id} className="timeline-event-card">
                <div className="timeline-marker-column">
                  <div className="timeline-dot" />
                  {index !== auditTrail.length - 1 && <div className="timeline-line" />}
                </div>

                <div className="timeline-content-card">
                  <div className="event-header-row">
                    <span className="event-action-chip">{log.action.replace(/_/g, ' ')}</span>
                    <span className="event-timestamp">{formatTime(log.created_at)}</span>
                  </div>

                  <div className="event-actor-row">
                    <span>Performed by: <strong>{log.actor_name}</strong></span>
                  </div>

                  {log.details && (
                    <div className="event-details-box">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Customer Export Verifier (INC-0304) */}
      {activeTab === 'export' && (
        <div className="audit-tab-panel">
          <div className="export-security-banner">
            <CheckCircle size={18} color="#059669" />
            <div>
              <strong>INC-0304 Privacy Hard Guarantee</strong>
              <p>This is the raw customer-facing export payload. Internal notes are filtered at the SQL query level (<code>WHERE is_internal = false</code>). They are mathematically absent from this JSON object.</p>
            </div>
          </div>

          <div className="export-json-viewer">
            <pre>{JSON.stringify(exportData, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Activity(props) {
  return <Clock {...props} />;
}
function Shield(props) {
  return <ShieldCheck {...props} />;
}
