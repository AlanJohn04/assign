# Frontdesk — Arvo Systems Support Platform

> A specialized, full-stack support management system built for **Arvo Systems** to replace their legacy shared spreadsheet and WhatsApp workflow. Designed to guarantee SLA compliance across 9 support agents handling ~40 customer problems daily.

---

## 1. The Story & Requirements Traceability

This system was engineered by analyzing the project meeting notes from Meera (Support Lead) and the three critical incident reports that triggered the project's approval.

### Extracted Business Rules & Incident Protections

| Ref | Requirement Extracted from Story | Source | Technical Implementation |
|---|---|---|---|
| **R1** | **3-Tier SLA Windows**<br>• Critical: 2 working hours reply, same working day resolution<br>• Medium: 4.5 working hours reply, ~3 working days (27h) resolution<br>• Low: 9 working hours (1 day) reply, ~1 working week (45h) resolution | Meera (§3 ¶1) | `slaEngine.js`: `calculateInitialDeadlines()` with priority matrix |
| **R2** | **Working Hours Clock (09:30 – 18:30, Mon–Fri)**<br>No clock ticks outside 09:30 to 18:30 on weekdays. | Meera (§3 ¶2) | `slaEngine.js`: `snapToBusinessHours()`, `addBusinessMinutes()` |
| **R3** | **Weekends & Festival Holidays Excluded**<br>*"If a ticket arrives at 6 PM on Friday, it should not be late on Sunday morning."* | Meera (§3 ¶2) | `holidays.js` calendar + weekend skipping math. Friday 18:00 has 30 mins left; remaining 90 mins resume Mon 09:30 (deadline Mon 11:00 AM). |
| **R4** | **SLA Clock Pause on Customer Wait**<br>Waiting on customer response does not count against agents. | Meera (§3 ¶3) | Status transition to `waiting_on_customer` stamps `sla_paused_at`. Resuming adds paused duration to deadlines. |
| **R5** | **Auto-Close on Customer Inactivity**<br>Auto-closes if customer does not reply for ~1 working week (45 working hours). | Meera (§3 ¶4) | `shouldAutoClose()` evaluates business time elapsed in `waiting_on_customer` >= 45 working hours. |
| **R6** | **Resolution Reopen Window**<br>Customers can reopen resolved tickets only within ~1 working week (45 working hours). After that, must open a new ticket. | Meera (§3 ¶5) | `canReopenTicket()` validator blocks reopen requests past 45 business hours with HTTP 400. |
| **R7** | **Single-Screen Agent Dashboard**<br>Agents see their queue, status, late warnings, and perform all actions from one screen. | Meera (§3 ¶6) | 3-pane responsive React dashboard: Queue Filters, Ticket List, and Detail Pane with Action Composer. |
| **R8** | **Real-Time Visual Indicators**<br>Immediate recognition of late/breached tickets and paused customer timers. | Meera (§3 ¶6) | Pulsing red `SLA BREACHED` badges, amber `SLA Paused` badges, and countdown timers. |
| **R9** | **Customer Replies vs. Internal Notes**<br>Support agents can reply to customers or record internal-only notes. | Meera (§3 ¶6) | Composer toggle: Blue public reply mode vs. amber private team note mode. |
| **R10** | **Mid-Ticket Priority Recalculation**<br>*"What happens to the timer if we change a ticket to urgent in the middle?"* | Meera (§3 ¶7) | `recalculateOnPriorityChange()` recalculates deadlines from `created_at` against new SLA target. If elapsed time > new window, flags instant breach. |
| **R11** | **INC-0291: Atomic Ticket Assignment**<br>Prevents collision where two agents take the same ticket and send conflicting answers. | INC-0291 (§4.1) | Atomic DB query: `UPDATE tickets SET assigned_to = $1 WHERE id = $2 AND assigned_to IS NULL`. Second agent receives HTTP 409 Conflict. |
| **R12** | **INC-0304: Zero-Leak Private Notes**<br>Private team notes must *never* be shown to customers in screens, API responses, exports, or lists. | INC-0304 (§4.2) | **Query-level enforcement**: Customer queries and export endpoints use `WHERE is_internal = false`. Internal notes never touch customer network packets. |
| **R13** | **INC-0318: Immutable Audit Trail**<br>Dispute over reply time requires tamper-proof proof of who did what and when. | INC-0318 (§4.3) | Append-only `audit_log` table with DB-level `NO UPDATE` and `NO DELETE` rules. Full event history with millisecond timestamps. |

---

## 2. Architecture & Technology Stack

- **Backend**: Node.js 22/24 with Express
- **Database**:
  - **PostgreSQL 16**: Supported via `pg` connection pool with full SQL schema (`backend/src/db/schema.sql`).
  - **Embedded SQLite Fallback**: Automatic zero-config fallback via Node's native `node:sqlite` for local evaluation and offline CI test runs without requiring external database services.
- **Frontend**: React 19 + Vite + Lucide Icons + Responsive CSS Design System (no heavy UI frameworks, instantaneous loading).
- **Security & Concurrency**:
  - JWT Authentication for all 9 Arvo agents
  - Database-level optimistic locking and atomic conditional updates
  - Immutable audit logs (no UPDATE or DELETE routes exist)

```
frontdesk/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── holidays.js         # Indian festival holidays calendar
│   │   ├── db/
│   │   │   ├── index.js            # Unified DB client (PostgreSQL & SQLite)
│   │   │   ├── schema.sql          # PostgreSQL DDL & immutability rules
│   │   │   └── seed.js             # Seeds the 9 Arvo agents & initial tickets
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT verification & agent context
│   │   ├── routes/
│   │   │   ├── auth.js             # Agent switcher & login
│   │   │   ├── tickets.js          # Ticket CRUD, atomic assign, priority recalculation
│   │   │   ├── comments.js         # Public replies vs. private notes (INC-0304)
│   │   │   └── audit.js            # Immutable audit trail reader (INC-0318)
│   │   ├── services/
│   │   │   ├── slaEngine.js        # Business hours math, SLA calculation, pause/resume
│   │   │   └── auditService.js     # Append-only audit logger
│   │   └── server.js               # Express server & static asset host
│   └── test/
│       ├── api.test.js             # INC-0291, INC-0304, INC-0318 integration tests
│       └── slaEngine.test.js       # Mathematical proofs of Friday 6 PM, pause, reopen
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx          # Agent switcher & customer view verifier
│   │   │   ├── TicketFilters.jsx   # Queue views & priority filters
│   │   │   ├── TicketList.jsx      # Ticket cards with SLA breach highlights
│   │   │   ├── TicketDetail.jsx    # Conversation, Audit Trail, and Export tabs
│   │   │   └── NewTicketModal.jsx  # Problem creation modal
│   │   ├── api.js                  # Frontend API client
│   │   ├── index.css               # Design system & responsive layout
│   │   └── App.jsx                 # Main application state orchestrator
│   └── vite.config.js
├── Dockerfile                      # Production multi-stage Docker build
├── docker-compose.yml              # Local PostgreSQL + App stack
└── package.json                    # Root orchestration scripts
```

---

## 3. Verified Incident Scenarios

### INC-0291 Concurrency Collision Test
- **The Issue**: Two agents clicked "take this ticket" on the spreadsheet simultaneously and gave conflicting answers.
- **The Solution**: The `PATCH /api/tickets/:id/assign` endpoint executes an atomic conditional update checking `assigned_to IS NULL`.
- **Proof**: Automated test `test/api.test.js` launches concurrent requests from Agent 1 and Agent 2. Agent 1 succeeds (HTTP 200); Agent 2 receives `HTTP 409 Conflict: This ticket has already been taken by Agent 1`.

### INC-0304 Private Note Leak Test
- **The Issue**: An agent's private internal note regarding a difficult customer was accidentally sent to the customer.
- **The Solution**: Strict segregation at the query level. Any request from a customer or public export executes `SELECT ... WHERE is_internal = false`.
- **Proof**: Automated test posts a private team note. When querying as customer or fetching `/api/tickets/:id/export`, the internal note is 100% stripped from the JSON response.

### INC-0318 Immutable Audit Log Test
- **The Issue**: Customer claimed Arvo replied late next morning; Arvo claimed 40 minutes; no one could prove who was right.
- **The Solution**: Every ticket creation, assignment, reply, priority change, and status change creates an immutable row in `audit_log` with actor name, exact ISO timestamp, and verifiable details. No UPDATE or DELETE endpoints exist.

---

## 4. Running Locally

### Option A: Double-Click Batch File (Windows — Quickest)

Simply double-click:
- **`run.bat`**: Automatically checks dependencies, builds the frontend if needed, launches the server on port 3000, and opens `http://localhost:3000` in your default browser.
- **`test.bat`**: Executes all 10 unit and integration tests and displays the verification report.

---

### Option B: Quick Start (Zero Config — Recommended via CLI)

Node.js 20+ is required:

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Build frontend production assets
npm run build

# 3. Run all unit and integration tests (100% pass)
npm test

# 4. Start the application
npm start
```
Open **`http://localhost:3000`** in your browser. The app runs out of the box with the 9 seeded Arvo agents and sample tickets!

---

### Option B: Docker Compose with PostgreSQL

To run with real PostgreSQL 16:

```bash
docker-compose up --build
```
Open **`http://localhost:3000`**.

---

### Option C: Using External PostgreSQL

Set your `DATABASE_URL` in `backend/.env`:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/frontdesk_db
PORT=3000
JWT_SECRET=arvo-secret-key-2026
```
Then run:
```bash
npm run seed
npm start
```

---

## 5. Pre-Seeded Arvo Support Agents

You can switch between any of Arvo's 9 support agents instantly using the agent switcher in the top-right header:

1. **Meera Nair** (Support Lead) — `meera@arvo.internal`
2. **Rahul Sharma** (Support Agent) — `rahul@arvo.internal`
3. **Priya Patel** (Support Agent) — `priya@arvo.internal`
4. **Arun Kumar** (Support Agent) — `arun@arvo.internal`
5. **Ananya Das** (Support Agent) — `ananya@arvo.internal`
6. **Rohan Verma** (Support Agent) — `rohan@arvo.internal`
7. **Sneha Reddy** (Support Agent) — `sneha@arvo.internal`
8. **Vikram Joshi** (Support Agent) — `vikram@arvo.internal`
9. **Divya Menon** (Support Agent) — `divya@arvo.internal`

Click the **"Verify Customer View"** toggle in the header at any time to inspect how a customer sees the ticket without internal notes.

---

## 6. Automated Test Suite

Run the full automated test suite anytime:

```bash
cd backend && npm test
```

Test Results:
```text
▶ Frontdesk Integration API Tests
  ✔ verifies agent login and list
  ✔ INC-0291 Prevention: Two agents attempting to take the same ticket results in atomic assignment and 409 Conflict
  ✔ INC-0304 Hard Enforcement: Private internal notes must NEVER leak in customer views or exports
  ✔ INC-0318 Proof & Audit Trail: System records who did what, when, and cannot be altered
  ✔ SLA Pause & Customer Reply: Pauses SLA on waiting_on_customer and resumes when customer replies
✔ Frontdesk Integration API Tests (562ms)

▶ Frontdesk SLA Engine Tests
  ✔ correctly identifies working days vs weekends
  ✔ Meera Rule: Friday 6:00 PM ticket is NOT late on Sunday morning
  ✔ correctly pauses and extends SLA when waiting on customer
  ✔ solves Meera Question: changing priority mid-ticket recalculates deadlines and evaluates breach
  ✔ enforces reopen window: allows within 1 working week, rejects after
✔ Frontdesk SLA Engine Tests (11ms)

ℹ tests 10
ℹ suites 2
ℹ pass 10
ℹ fail 0
```
