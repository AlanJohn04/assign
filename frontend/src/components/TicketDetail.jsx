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
  Download
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

  if (!ticket) {
    return (
      <div className="ticket-detail-pane" style={{ alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
        <MessageSquare size={48} strokeWidth={1} style={{ marginBottom: '12px' }} />
        <p>Select a ticket from the list to view conversation and manage resolution</p>
      </div>
    );
  }

  const isAssignedToMe = currentAgent && ticket.assigned_to === currentAgent.id;
  const isUnassigned = !ticket.assigned_to;
  const isBreached = ticket.is_breached || ticket.sla_reply_breached || ticket.sla_resolve_breached;
  const isPaused = ticket.status === 'waiting_on_customer';

  // Format dates
  const formatTime = (iso) => {
    if (!iso) return 'Not yet';
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const handleSubmitComment = async (e) => {
    e.preventDefault();
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

  return (
    <div className="ticket-detail-pane">
      {/* Detail Header */}
      <div className="detail-header">
        {/* INC-0291 Conflict Banner */}
        {conflictError && (
          <div className="conflict-alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} />
              <span>{conflictError}</span>
            </div>
            <button className="btn-outline" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setConflictError(null)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="detail-header-top">
          <div className="detail-title-area">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="ticket-num" style={{ fontSize: '14px' }}>{ticket.ticket_number}</span>
              <span className={`badge badge-${ticket.priority}`}>{ticket.priority.toUpperCase()} PRIORITY</span>
              <span className="badge badge-status">{ticket.status.replace(/_/g, ' ').toUpperCase()}</span>
            </div>
            <h2>{ticket.subject}</h2>
            <div className="detail-customer-info">
              Customer: <strong>{ticket.customer_name}</strong> &lt;{ticket.customer_email}&gt; · Created: {formatTime(ticket.created_at)}
            </div>
          </div>

          {/* Action Controls */}
          {!customerMode && (
            <div className="detail-controls">
              {/* INC-0291 Exclusive Assignment */}
              {isUnassigned ? (
                <button className="btn-primary" onClick={handleTakeTicket} style={{ background: '#059669' }}>
                  ⚡ Take this Ticket
                </button>
              ) : isAssignedToMe ? (
                <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '6px 12px' }}>
                  <UserCheck size={14} /> Assigned to You
                </span>
              ) : (
                <span className="badge" style={{ background: '#f1f5f9', color: '#475569', padding: '6px 12px' }}>
                  👤 Assigned to {ticket.assignee_name || 'Agent'}
                </span>
              )}

              {/* Priority Selector (Meera SLA Recalculation) */}
              <select
                className="select-control"
                value={ticket.priority}
                onChange={(e) => onUpdatePriority(ticket.id, e.target.value)}
                title="Changing priority recalculates SLA deadlines"
              >
                <option value="critical">Critical (2h reply / Same day)</option>
                <option value="medium">Medium (4.5h reply / 3 days)</option>
                <option value="low">Low (1 day reply / 1 week)</option>
              </select>

              {/* Status Selector */}
              <select
                className="select-control"
                value={ticket.status}
                onChange={(e) => onUpdateStatus(ticket.id, e.target.value)}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_on_customer">Waiting on Customer (Pause SLA)</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              {/* Reopen button for resolved tickets within 1 week */}
              {ticket.status === 'resolved' && (
                <button className="btn-outline" onClick={() => onReopen(ticket.id)} title="Reopen allowed within 1 working week of resolution">
                  <RotateCcw size={14} /> Reopen Ticket
                </button>
              )}
            </div>
          )}
        </div>

        {/* SLA Status Banner */}
        <div className="sla-status-banner">
          <div className="sla-item">
            <span className="sla-item-label">First Reply SLA</span>
            <span className={`sla-item-value ${ticket.is_reply_breached ? 'sla-late' : 'sla-ok'}`}>
              {ticket.first_response_at ? (
                `Replied ${formatTime(ticket.first_response_at)} ${ticket.sla_reply_breached ? '(Late)' : '(On Time)'}`
              ) : (
                `Due: ${formatTime(ticket.sla_reply_deadline)} ${ticket.is_reply_breached ? '⚠️ BREACHED' : ''}`
              )}
            </span>
          </div>

          <div className="sla-item">
            <span className="sla-item-label">Resolution SLA</span>
            <span className={`sla-item-value ${ticket.is_resolve_breached ? 'sla-late' : 'sla-ok'}`}>
              {ticket.resolved_at ? (
                `Resolved ${formatTime(ticket.resolved_at)}`
              ) : (
                `Due: ${formatTime(ticket.sla_resolve_deadline)} ${ticket.is_resolve_breached ? '⚠️ BREACHED' : ''}`
              )}
            </span>
          </div>

          <div className="sla-item">
            <span className="sla-item-label">SLA Clock Status</span>
            <span className="sla-item-value">
              {isPaused ? (
                <span style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Pause size={14} /> Paused (Waiting on customer)
                </span>
              ) : ticket.status === 'resolved' || ticket.status === 'closed' ? (
                <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={14} /> Stopped ({ticket.status})
                </span>
              ) : isBreached ? (
                <span style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={14} /> Breached
                </span>
              ) : (
                <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} /> Active
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="detail-tabs">
        <button
          className={`tab-btn ${activeTab === 'conversation' ? 'active' : ''}`}
          onClick={() => setActiveTab('conversation')}
        >
          💬 Conversation ({ticket.comments?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          📜 Immutable Audit Trail ({auditTrail?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          📤 Customer Export View (INC-0304 Verifier)
        </button>
      </div>

      {/* TAB CONTENT: Conversation */}
      {activeTab === 'conversation' && (
        <>
          <div className="conversation-scroll">
            {/* Original Problem Description */}
            <div className="comment-card comment-customer">
              <div className="comment-header">
                <span>👤 {ticket.customer_name} (Initial Report)</span>
                <span>{formatTime(ticket.created_at)}</span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</div>
            </div>

            {/* Comments Thread */}
            {ticket.comments?.map((c) => {
              const isInternal = c.is_internal;
              const isCust = c.author_type === 'customer';

              return (
                <div
                  key={c.id}
                  className={`comment-card ${
                    isInternal ? 'comment-internal' : isCust ? 'comment-customer' : 'comment-agent'
                  }`}
                >
                  <div className="comment-header">
                    {isInternal ? (
                      <span className="internal-badge-header">
                        <Lock size={12} /> PRIVATE ARVO TEAM NOTE (HIDDEN FROM CUSTOMER)
                      </span>
                    ) : (
                      <span>
                        {isCust ? '👤' : '🛠️'} {c.author_name} ({isCust ? 'Customer' : 'Support Agent'})
                      </span>
                    )}
                    <span>{formatTime(c.created_at)}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
                </div>
              );
            })}
          </div>

          {/* Action Composer (INC-0304 Safeguard) */}
          <div className="composer-pane">
            {!customerMode ? (
              <div className="composer-toggle">
                <button
                  type="button"
                  className={`composer-tab ${composerMode === 'reply' ? 'active-reply' : ''}`}
                  onClick={() => setComposerMode('reply')}
                >
                  <Send size={14} /> Reply to Customer
                </button>
                <button
                  type="button"
                  className={`composer-tab ${composerMode === 'internal' ? 'active-note' : ''}`}
                  onClick={() => setComposerMode('internal')}
                >
                  <Lock size={14} /> Private Team Note (INC-0304 Safeguard)
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>
                Simulating Customer Reply (This will automatically resume the SLA clock)
              </div>
            )}

            <form onSubmit={handleSubmitComment}>
              <textarea
                className={`composer-textarea ${composerMode === 'internal' ? 'note-mode' : ''}`}
                placeholder={
                  customerMode
                    ? 'Write customer reply (e.g. Here is the requested screenshot)...'
                    : composerMode === 'internal'
                    ? 'Write private note for Arvo support team only... (This will NEVER be shown to customer)'
                    : 'Write official response to customer...'
                }
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />

              <div className="composer-footer">
                <div>
                  {composerMode === 'internal' && !customerMode && (
                    <span className="warning-note-banner">
                      <Lock size={14} /> Strict Guard: Internal notes are never sent to customer or shown in exports.
                    </span>
                  )}
                  {composerMode === 'reply' && !customerMode && (
                    <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={markWaiting}
                        onChange={(e) => setMarkWaiting(e.target.checked)}
                      />
                      Mark as "Waiting on Customer" (Pauses SLA timer)
                    </label>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  className="btn-primary"
                  style={
                    composerMode === 'internal' && !customerMode
                      ? { background: '#d97706' }
                      : customerMode
                      ? { background: '#2563eb' }
                      : {}
                  }
                >
                  {composerMode === 'internal' && !customerMode ? (
                    <>
                      <Lock size={14} /> Save Team Note
                    </>
                  ) : (
                    <>
                      <Send size={14} /> {customerMode ? 'Send as Customer' : 'Send to Customer'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* TAB CONTENT: Audit Trail (INC-0318) */}
      {activeTab === 'audit' && (
        <div className="audit-container">
          <div style={{ marginBottom: '16px', fontSize: '13px', color: '#64748b' }}>
            <strong>INC-0318 Proof Log:</strong> Append-only immutable record of all state transitions, assignments, replies, and priority changes.
          </div>
          <table className="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Verifiable Details</th>
              </tr>
            </thead>
            <tbody>
              {auditTrail?.map((log) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>{formatTime(log.created_at)}</td>
                  <td><strong>{log.actor_name}</strong></td>
                  <td>
                    <span className="audit-action-badge">{log.action.replace(/_/g, ' ')}</span>
                  </td>
                  <td style={{ color: '#334155', fontFamily: 'monospace', fontSize: '12px' }}>
                    {log.details || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT: Customer Export (INC-0304) */}
      {activeTab === 'export' && (
        <div className="audit-container">
          <div style={{ marginBottom: '16px', background: '#ecfdf5', border: '1px solid #10b981', padding: '12px 16px', borderRadius: '8px', color: '#065f46', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '4px' }}>
              <CheckCircle size={16} /> INC-0304 Guaranteed Privacy
            </div>
            This customer export is strictly filtered at the database query level (<code>WHERE is_internal = false</code>). Private team notes are completely omitted from the payload, list, and export.
          </div>

          <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px', overflowX: 'auto', fontSize: '12px' }}>
            {JSON.stringify(exportData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
