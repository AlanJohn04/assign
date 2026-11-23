import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isWorkingDay,
  snapToBusinessHours,
  addBusinessMinutes,
  getBusinessMinutesBetween,
  calculateInitialDeadlines,
  recalculateOnPriorityChange,
  resumeSLATimer,
  canReopenTicket,
  evaluateBreach
} from '../src/services/slaEngine.js';

describe('Frontdesk SLA Engine Tests', () => {
  it('correctly identifies working days vs weekends', () => {
    // 2026-11-20 is a Friday
    const friday = new Date('2026-11-20T10:00:00Z');
    // 2026-11-21 is Saturday
    const saturday = new Date('2026-11-21T10:00:00Z');
    // 2026-11-22 is Sunday
    const sunday = new Date('2026-11-22T10:00:00Z');

    assert.strictEqual(isWorkingDay(friday), true);
    assert.strictEqual(isWorkingDay(saturday), false);
    assert.strictEqual(isWorkingDay(sunday), false);
  });

  it('Meera Rule: Friday 6:00 PM ticket is NOT late on Sunday morning', () => {
    // Friday at 18:00 (6:00 PM) local time (assuming local working hours 09:30 - 18:30)
    const friday6pm = new Date(2026, 10, 20, 18, 0, 0); // Nov 20, 2026 is Friday
    const { sla_reply_deadline } = calculateInitialDeadlines('critical', friday6pm);
    const deadlineDate = new Date(sla_reply_deadline);

    // On Friday, 30 min of work remain (18:00 to 18:30).
    // Remaining 90 mins (1.5 hours) must carry to Monday starting at 09:30.
    // So deadline must be Monday at 11:00 AM!
    assert.strictEqual(deadlineDate.getDay(), 1, 'Deadline should be Monday');
    assert.strictEqual(deadlineDate.getHours(), 11, 'Deadline hour should be 11');
    assert.strictEqual(deadlineDate.getMinutes(), 0, 'Deadline minute should be 0');

    // On Sunday morning at 10:00 AM:
    const sundayMorning = new Date(2026, 10, 22, 10, 0, 0);
    const mockTicket = {
      status: 'open',
      first_response_at: null,
      sla_reply_deadline,
      sla_resolve_deadline: new Date(2026, 10, 23, 18, 30, 0).toISOString(),
      sla_reply_breached: false
    };

    const breachState = evaluateBreach(mockTicket, sundayMorning);
    assert.strictEqual(breachState.replyBreached, false, 'Friday 6 PM ticket must NOT be late on Sunday morning');
  });

  it('correctly pauses and extends SLA when waiting on customer', () => {
    // Ticket created Monday at 10:00 AM
    const monday10am = new Date(2026, 10, 23, 10, 0, 0);
    const deadlines = calculateInitialDeadlines('medium', monday10am); // 4.5 hours reply = 14:30 Monday

    const ticket = {
      status: 'waiting_on_customer',
      created_at: monday10am.toISOString(),
      sla_reply_deadline: deadlines.sla_reply_deadline,
      sla_resolve_deadline: deadlines.sla_resolve_deadline,
      sla_paused_at: new Date(2026, 10, 23, 11, 0, 0).toISOString(), // Paused at 11:00 AM
      sla_total_paused_minutes: 0
    };

    // Customer replies 3 working hours later (at 14:00 Monday)
    const customerRepliedAt = new Date(2026, 10, 23, 14, 0, 0);
    const resumed = resumeSLATimer(ticket, customerRepliedAt);

    assert.strictEqual(resumed.sla_total_paused_minutes, 180, 'Paused for 180 working minutes');
    const newReplyDeadline = new Date(resumed.sla_reply_deadline);
    // Original reply deadline was 14:30, with 3h pause it should now be 17:30
    assert.strictEqual(newReplyDeadline.getHours(), 17);
    assert.strictEqual(newReplyDeadline.getMinutes(), 30);
  });

  it('solves Meera Question: changing priority mid-ticket recalculates deadlines and evaluates breach', () => {
    // Ticket created Monday 10:00 AM as Low priority (reply window = 9 working hours)
    const monday10am = new Date(2026, 10, 23, 10, 0, 0);
    const initial = calculateInitialDeadlines('low', monday10am);

    const ticket = {
      created_at: monday10am.toISOString(),
      status: 'open',
      first_response_at: null,
      sla_reply_deadline: initial.sla_reply_deadline,
      sla_resolve_deadline: initial.sla_resolve_deadline,
      sla_total_paused_minutes: 0,
      sla_reply_breached: false
    };

    // 3 hours later at 13:00 Monday, customer cannot work at all -> escalated to Critical (2h reply window)
    const monday1pm = new Date(2026, 10, 23, 13, 0, 0);
    const updated = recalculateOnPriorityChange(ticket, 'critical', monday1pm);

    // Since critical reply window is 2h from 10:00 AM (12:00 PM), and current time is 13:00,
    // it should be immediately marked breached!
    assert.strictEqual(updated.sla_reply_breached, 1, 'Should immediately breach because 3h > 2h critical limit');
  });

  it('enforces reopen window: allows within 1 working week, rejects after', () => {
    // Resolved Monday at 12:00
    const resolvedAt = new Date(2026, 10, 23, 12, 0, 0);
    const ticket = {
      status: 'resolved',
      resolved_at: resolvedAt.toISOString()
    };

    // 2 days later: allowed
    const twoDaysLater = new Date(2026, 10, 25, 12, 0, 0);
    assert.strictEqual(canReopenTicket(ticket, twoDaysLater).allowed, true);

    // 2 weeks later: rejected
    const twoWeeksLater = new Date(2026, 11, 7, 12, 0, 0);
    const result = canReopenTicket(ticket, twoWeeksLater);
    assert.strictEqual(result.allowed, false);
    assert.match(result.reason, /expired/i);
  });
});
