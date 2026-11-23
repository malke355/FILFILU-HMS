# Provider Scheduling Design (Section 5)

## Sources of availability

1. **`DoctorSchedule`** — published day slots (`slotsJson`). If present and not `full`, booking times must be in the list.
2. **Default grid** — when no schedule rows exist for the date, availability API offers 08:00–16:30 half-hours (walk-in/admin style), still subject to conflicts.
3. **`ProviderUnavailability`** — leave / breaks (`allDay` or time window). Blocks booking overlaps.
4. **`Shift`** — duty roster (draft/publish) remains separate operational roster; not the sole booking source.

## Conflict rules

- Blocking statuses occupy the provider: `requested`, `scheduled`, `confirmed`, `checked_in`, `waiting`, `in_consultation`.
- Duration overlap (default 30 minutes) checked server-side.
- Partial unique index on `(doctorId, date, time)` for blocking statuses (race backstop).
- Cancelled / completed / no_show do not block.

## Management APIs

- `PUT /schedules/doctor-day` — upsert day slots (`schedule.manage`).
- `POST /schedules/unavailability` — create leave/break.
- Historical appointments are never rewritten when schedules change; only future availability is affected.
