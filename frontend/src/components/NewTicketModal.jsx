import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

export default function NewTicketModal({ isOpen, onClose, onCreate }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject || !description || !customerName || !customerEmail) {
      setError('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        subject,
        description,
        customer_name: customerName,
        customer_email: customerEmail,
        priority
      });
      // Reset
      setSubject('');
      setDescription('');
      setCustomerName('');
      setCustomerEmail('');
      setPriority('medium');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Create New Customer Problem</h3>
          <button className="btn-outline" style={{ border: 'none', padding: '4px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Subject *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Cannot process credit card payments at checkout"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Severity / Priority *</label>
              <select
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="critical">Critical — Customer cannot work at all (2h Reply / Same Day Fix)</option>
                <option value="medium">Medium — Significant issue (4.5h Reply / 3 Days Fix)</option>
                <option value="low">Low — Small question / minor request (1 Day Reply / 1 Week Fix)</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Rachel Green"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Email *</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="rachel@centralperk.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Problem Details *</label>
              <textarea
                className="form-textarea"
                placeholder="Describe what happened, error messages, and customer impact..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
