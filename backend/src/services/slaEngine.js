import { isHoliday } from '../config/holidays.js';

// Business hours: 09:30 to 18:30 (Monday to Friday)
export const BUSINESS_HOURS = {
  START_HOUR: 9,
  START_MINUTE: 30,
  END_HOUR: 18,
  END_MINUTE: 30,
  DAILY_MINUTES: 9 * 60 // 540 minutes = 9 hours
};

export const SLA_TIERS = {
  critical: {
    name: 'Critical',
    replyHours: 2, // 2 working hours
    resolveHours: 9, // same working day (up to end of day / 9 hrs)
    sameDayResolve: true
  },
  medium: {
    name: 'Medium',
    replyHours: 4.5, // half a working day (4.5 hours)
    resolveHours: 27 // ~3 working days (27 hours)
  },
  low: {
    name: 'Low',
    replyHours: 9, // 1 working day (9 hours)
    resolveHours: 45 // ~1 working week (45 hours)
  }
};

/**
 * Checks if a given Date is a working day (Mon-Fri and not a festival holiday)
 */
export function isWorkingDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // 0 = Sunday, 6 = Saturday
  const dateStr = date.toISOString().slice(0, 10);
  return !isHoliday(dateStr);
}

/**
 * Get start of business hours for a specific date (09:30)
 */
export function getBusinessStart(date) {
  const d = new Date(date);
  d.setHours(BUSINESS_HOURS.START_HOUR, BUSINESS_HOURS.START_MINUTE, 0, 0);
  return d;
}

/**
 * Get end of business hours for a specific date (18:30)
 */
export function getBusinessEnd(date) {
  const d = new Date(date);
  d.setHours(BUSINESS_HOURS.END_HOUR, BUSINESS_HOURS.END_MINUTE, 0, 0);
  return d;
}

/**
 * Snap date into the next active business hours window if it falls outside
 */
export function snapToBusinessHours(date) {
  let d = new Date(date);

  // If outside business hours on a weekend/holiday, advance day by day
  while (!isWorkingDay(d)) {
    d.setDate(d.getDate() + 1);
    d = getBusinessStart(d);
  }

  const start = getBusinessStart(d);
  const end = getBusinessEnd(d);

  if (d < start) {
    return start;
  }
  if (d >= end) {
    // Past end of today, advance to next business day start
    d.setDate(d.getDate() + 1);
    return snapToBusinessHours(getBusinessStart(d));
  }

  return d;
}

/**
 * Add business minutes to a starting date, skipping weekends, holidays, and off-hours
 */
export function addBusinessMinutes(startDate, minutesToAdd) {
  let current = snapToBusinessHours(startDate);
  let remaining = minutesToAdd;

  while (remaining > 0) {
    const endOfToday = getBusinessEnd(current);
    const availableMinutesToday = Math.floor((endOfToday.getTime() - current.getTime()) / (1000 * 60));

    if (remaining <= availableMinutesToday) {
      return new Date(current.getTime() + remaining * 60 * 1000);
    } else {
      remaining -= availableMinutesToday;
      // Move to 09:30 of next business day
      const nextDay = new Date(current);
      nextDay.setDate(nextDay.getDate() + 1);
      current = snapToBusinessHours(getBusinessStart(nextDay));
    }
  }

  return current;
}

/**
 * Calculate business minutes elapsed between two dates
 */
export function getBusinessMinutesBetween(startDate, endDate) {
  if (startDate >= endDate) return 0;

  let current = new Date(startDate);
  const target = new Date(endDate);
  let totalMinutes = 0;

  while (current < target) {
    if (!isWorkingDay(current)) {
      current.setDate(current.getDate() + 1);
      current = getBusinessStart(current);
      continue;
    }

    const startOfToday = getBusinessStart(current);
    const endOfToday = getBusinessEnd(current);

    if (current < startOfToday) {
      current = startOfToday;
    }

    if (current >= endOfToday) {
      current.setDate(current.getDate() + 1);
      current = getBusinessStart(current);
      continue;
    }

    // Effective start and end within today's window
    const windowStart = current > startOfToday ? current : startOfToday;
    const windowEnd = target < endOfToday ? target : endOfToday;

    if (windowEnd > windowStart) {
      const diffMinutes = Math.floor((windowEnd.getTime() - windowStart.getTime()) / (1000 * 60));
      totalMinutes += diffMinutes;
      current = windowEnd;
    }

    if (current >= endOfToday) {
      current.setDate(current.getDate() + 1);
      current = getBusinessStart(current);
    } else {
      break;
    }
  }

  return totalMinutes;
}

/**
 * Calculate initial SLA deadlines for a ticket based on priority and creation time
 */
export function calculateInitialDeadlines(priority, createdAt = new Date()) {
  const tier = SLA_TIERS[priority] || SLA_TIERS.medium;
  const replyMinutes = tier.replyHours * 60;
  const replyDeadline = addBusinessMinutes(createdAt, replyMinutes);

  let resolveDeadline;
  if (tier.sameDayResolve) {
    // Critical: Same working day resolution
    const start = snapToBusinessHours(createdAt);
    resolveDeadline = getBusinessEnd(start);
  } else {
    const resolveMinutes = tier.resolveHours * 60;
    resolveDeadline = addBusinessMinutes(createdAt, resolveMinutes);
  }

  return {
    sla_reply_deadline: replyDeadline.toISOString(),
    sla_resolve_deadline: resolveDeadline.toISOString()
  };
}

/**
 * Recalculate SLA deadlines when priority is changed mid-flight (Meera's question)
 * Recalculates from created_at using the new priority window, adding any paused duration
 */
export function recalculateOnPriorityChange(ticket, newPriority, currentTime = new Date()) {
  const createdAt = new Date(ticket.created_at);
  const tier = SLA_TIERS[newPriority] || SLA_TIERS.medium;
  const totalPausedMinutes = ticket.sla_total_paused_minutes || 0;

  // New base deadlines
  const replyMinutes = (tier.replyHours * 60) + totalPausedMinutes;
  const newReplyDeadline = addBusinessMinutes(createdAt, replyMinutes);

  let newResolveDeadline;
  if (tier.sameDayResolve) {
    const start = snapToBusinessHours(createdAt);
    const baseEnd = getBusinessEnd(start);
    newResolveDeadline = new Date(baseEnd.getTime() + totalPausedMinutes * 60 * 1000);
  } else {
    const resolveMinutes = (tier.resolveHours * 60) + totalPausedMinutes;
    newResolveDeadline = addBusinessMinutes(createdAt, resolveMinutes);
  }

  const now = new Date(currentTime);
  // Check if changing to higher priority immediately breaches SLA
  const isReplyBreached = !ticket.first_response_at && now > newReplyDeadline;
  const isResolveBreached = !ticket.resolved_at && now > newResolveDeadline;

  return {
    sla_reply_deadline: newReplyDeadline.toISOString(),
    sla_resolve_deadline: newResolveDeadline.toISOString(),
    sla_reply_breached: isReplyBreached ? 1 : (ticket.sla_reply_breached ? 1 : 0),
    sla_resolve_breached: isResolveBreached ? 1 : (ticket.sla_resolve_breached ? 1 : 0)
  };
}

/**
 * Resume SLA timer when customer replies
 * Extends deadlines by the business minutes elapsed while paused
 */
export function resumeSLATimer(ticket, currentTime = new Date()) {
  if (!ticket.sla_paused_at) {
    return {
      sla_paused_at: null,
      sla_total_paused_minutes: ticket.sla_total_paused_minutes || 0,
      sla_reply_deadline: ticket.sla_reply_deadline,
      sla_resolve_deadline: ticket.sla_resolve_deadline
    };
  }

  const pausedAt = new Date(ticket.sla_paused_at);
  const now = new Date(currentTime);
  const pausedMinutes = getBusinessMinutesBetween(pausedAt, now);
  const totalPausedMinutes = (ticket.sla_total_paused_minutes || 0) + pausedMinutes;

  // Extend both deadlines by pausedMinutes
  const currentReplyDeadline = new Date(ticket.sla_reply_deadline);
  const currentResolveDeadline = new Date(ticket.sla_resolve_deadline);

  const updatedReplyDeadline = addBusinessMinutes(currentReplyDeadline, pausedMinutes);
  const updatedResolveDeadline = addBusinessMinutes(currentResolveDeadline, pausedMinutes);

  return {
    sla_paused_at: null,
    sla_total_paused_minutes: totalPausedMinutes,
    sla_reply_deadline: updatedReplyDeadline.toISOString(),
    sla_resolve_deadline: updatedResolveDeadline.toISOString()
  };
}

/**
 * Check if ticket has exceeded auto-close threshold (45 working hours in waiting_on_customer)
 */
export function shouldAutoClose(ticket, currentTime = new Date()) {
  if (ticket.status !== 'waiting_on_customer' || !ticket.sla_paused_at) {
    return false;
  }
  const pausedAt = new Date(ticket.sla_paused_at);
  const now = new Date(currentTime);
  const waitingMinutes = getBusinessMinutesBetween(pausedAt, now);
  // 1 working week = 45 working hours = 2700 working minutes
  return waitingMinutes >= 45 * 60;
}

/**
 * Check if a resolved ticket can be reopened (within 1 working week of resolution)
 */
export function canReopenTicket(ticket, currentTime = new Date()) {
  if (ticket.status !== 'resolved' || !ticket.resolved_at) {
    return { allowed: false, reason: 'Only resolved tickets can be reopened.' };
  }
  const resolvedAt = new Date(ticket.resolved_at);
  const now = new Date(currentTime);
  const elapsedMinutes = getBusinessMinutesBetween(resolvedAt, now);
  const maxReopenMinutes = 45 * 60; // 1 working week = 45 hours

  if (elapsedMinutes > maxReopenMinutes) {
    return {
      allowed: false,
      reason: 'Resolution window expired (over 1 working week). A new ticket must be created.'
    };
  }

  return { allowed: true };
}

/**
 * Evaluate current SLA breach state
 */
export function evaluateBreach(ticket, currentTime = new Date()) {
  const now = new Date(currentTime);
  const isPaused = ticket.status === 'waiting_on_customer';

  // If already replied, reply SLA is permanently locked to response time
  let replyBreached = Boolean(ticket.sla_reply_breached);
  if (!ticket.first_response_at && !replyBreached && !isPaused) {
    if (now > new Date(ticket.sla_reply_deadline)) {
      replyBreached = true;
    }
  }

  // Resolve SLA
  let resolveBreached = Boolean(ticket.sla_resolve_breached);
  if (!ticket.resolved_at && !resolveBreached && !isPaused) {
    if (now > new Date(ticket.sla_resolve_deadline)) {
      resolveBreached = true;
    }
  }

  return {
    replyBreached,
    resolveBreached
  };
}
