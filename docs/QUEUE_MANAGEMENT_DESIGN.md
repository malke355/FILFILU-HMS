# Queue Management Design (Section 5)

## Numbering

`QueueNumberSequence` unique per `(facilityId, departmentKey, serviceDate)`.  
Atomic allocate → `Q-{DEPT}-{0001}`.

## Entry fields

Patient, optional appointment, department key, doctor, priority (`normal` \| `urgent` \| `follow_up`), status, arrival/called/service/completed timestamps.

## Ordering

Waiting/called sorted by priority rank then arrival time. Staff assigns priority — no automated clinical triage.

## Statuses

`waiting → called → in_service → completed` with `skipped` / `cancelled` branches. Skip requires reason.

## Check-in safety

One active queue entry per appointment (`waiting|called|in_service`). Re-check-in returns the existing ticket.

## Display privacy

Board shows queue number, MRN, name, wait minutes, priority, department — not clinical notes.

## Real-time

Polling every ~8s in UI; `GET /queue/events?since=` for delta. No WebSocket server yet.
