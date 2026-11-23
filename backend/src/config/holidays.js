// List of official company / festival holidays
// Format: YYYY-MM-DD
export const FESTIVAL_HOLIDAYS = [
  '2026-01-01', // New Year's Day
  '2026-01-26', // Republic Day
  '2026-03-04', // Holi
  '2026-03-21', // Eid ul-Fitr
  '2026-05-01', // May Day
  '2026-08-15', // Independence Day
  '2026-08-28', // Onam
  '2026-10-02', // Gandhi Jayanti
  '2026-10-20', // Dussehra / Vijayadashami
  '2026-11-08', // Diwali
  '2026-12-25', // Christmas
];

export function isHoliday(dateStr, holidays = FESTIVAL_HOLIDAYS) {
  return holidays.includes(dateStr);
}
