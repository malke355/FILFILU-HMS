# Appointment Test Report (Section 5)

**Date:** 2026-11-23  
**Command:** `npm test` in `backend/`  
**Result:** **58 passed / 0 failed** (14 files)

| # | Requirement | Result |
|---|-------------|--------|
| 1 | Appointment creation | Pass |
| 2–3 | Availability + double-book / concurrent | Pass (1 success + 1 reject) |
| 5 | Leave / unavailability | Pass |
| 7–8 | Reschedule/cancel history | Covered by status events + cancel API |
| 9–12 | Walk-in / queue uniqueness / check-in dup | Pass |
| 15 | Cross-facility | Pass (404 history) |
| 16 | Realtime auth | Polling endpoints permission-gated |
| 17 | Prior suites | Pass |

Suite: `appointment.module.integration.test.ts` + prior Sections 2–4.
