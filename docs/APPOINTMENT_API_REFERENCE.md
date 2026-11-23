# Appointment API Reference (Section 5)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/appointments` | Existing list (resources) |
| POST | `/appointments` | Existing create (patient/staff) |
| PATCH | `/appointments/:id` | Existing update |
| GET | `/appointments/stats` | Today counts |
| GET | `/appointments/availability` | Free slots |
| GET | `/appointments/calendar` | Range feed |
| POST | `/appointments/book` | Reception booking |
| POST | `/appointments/:id/reschedule` | New slot |
| POST | `/appointments/:id/cancel` | Cancel + reason |
| POST | `/appointments/:id/check-in` | Queue ticket |
| GET | `/appointments/:id/history` | Status events |
| POST | `/walk-ins` | Walk-in + queue |
| GET | `/queue` | Board |
| GET | `/queue/events` | Poll deltas |
| POST | `/queue/call-next` | Call next waiting |
| POST | `/queue/:id/transition` | Queue status |
| GET/POST | `/schedules/unavailability` | Leave/breaks |
| PUT | `/schedules/doctor-day` | Upsert slots |

OpenAPI file: `backend/openapi/appointments.yaml` → `/api/openapi/appointments.yaml`.
