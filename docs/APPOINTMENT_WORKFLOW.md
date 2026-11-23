# Appointment Workflows (Section 5)

## Book (reception/admin)

1. Select patient + doctor + date.
2. `GET /appointments/availability` returns only free slots (schedules, overlaps, leave).
3. `POST /appointments/book` allocates `APT-…` number, writes status event, queues notification job.
4. Audit: `appointment.book`.

## Patient self-request

`POST /appointments` (existing) → status `requested`, MRN-style appointment number assigned.

## Check-in

`POST /appointments/:id/check-in` → status `waiting` + queue ticket. Second call returns existing entry (`duplicate: true`).

## Walk-in

`POST /walk-ins` → appointment (`bookingSource=walk_in`) + queue entry for today.

## Reschedule / cancel

`POST /appointments/:id/reschedule` validates new slot, records previous schedule in status event reason.  
`POST /appointments/:id/cancel` stores cancelledBy/At/reason; cancelled slots free for rebooking.

## Lifecycle (simplified)

`scheduled/requested → confirmed → checked_in → waiting → in_consultation → completed`  
Branches: `cancelled`, `no_show`, `rescheduled`.
