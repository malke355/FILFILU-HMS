# Appointment Module Architecture (Section 5)

## Scope

Facility-scoped appointments, provider availability (DoctorSchedule + unavailability), double-booking prevention, walk-ins, queue board, calendar API, notification outbox, and polling-based queue updates.

## Layers

| Layer | Path |
|-------|------|
| Models | `Appointment`, `AppointmentNumberSequence`, `AppointmentStatusEvent`, `ProviderUnavailability`, `QueueEntry`, `QueueNumberSequence`, `NotificationJob` |
| Core conflict logic | `backend/src/lib/appointments.ts` |
| Services | `backend/src/services/appointments/*` |
| HTTP | `backend/src/routes/appointmentsModule.ts` (+ legacy `POST/PATCH /appointments` in `resources.ts`) |
| UI | `landing/app.html` appointments / calendar / queue |
| OpenAPI | `backend/openapi/appointments.yaml` |

## Compatibility

Legacy statuses `requested` / `confirmed` remain valid. New statuses: `scheduled`, `checked_in`, `waiting`, `in_consultation`, `rescheduled`. Partial unique index expanded to cover all blocking statuses.

## Real-time

No Socket.IO/WebSocket in the monolith. Queue uses **polling** (`GET /queue` + optional `GET /queue/events?since=`). Documented for a future WS channel.
