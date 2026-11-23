# Appointment Permission Matrix (Section 5)

| Permission | Admin | Receptionist | Doctor | Nurse |
|------------|:-----:|:------------:|:------:|:-----:|
| appointments.read / manage / create / cancel / reschedule | Y | Y | own write/reschedule | ward read |
| schedules.read / manage | Y | read | read_own / read | read |
| queue.read | Y | Y | Y | Y |
| queue.manage / call_next / checkin / manage_priority | Y | Y | — | checkin |

Cashiers retain `appointments.read` only. Patients: `request` + `read_own`.
