# Filfilu HMS — Documentation

## Section 1 — Audit & architecture

| Document | Purpose |
|----------|---------|
| [PROJECT_AUDIT.md](./PROJECT_AUDIT.md) | What exists today |
| [TARGET_ARCHITECTURE.md](./TARGET_ARCHITECTURE.md) | Target SaaS architecture |
| [MODULE_IMPLEMENTATION_ROADMAP.md](./MODULE_IMPLEMENTATION_ROADMAP.md) | Module order / MVP |
| [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) | Express → Nest cutover plan |
| [TECHNICAL_DECISIONS.md](./TECHNICAL_DECISIONS.md) | ADRs |

## Section 2 — Database & multi-tenancy

| Document | Purpose |
|----------|---------|
| [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) | Modeling decisions |
| [MULTI_TENANCY_DESIGN.md](./MULTI_TENANCY_DESIGN.md) | Tenant isolation |
| [DATABASE_MIGRATION_GUIDE.md](./DATABASE_MIGRATION_GUIDE.md) | Migrations / backfill / seed |
| [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) | Model reference |

## Section 3 — Authentication, authorization & security

| Document | Purpose |
|----------|---------|
| [AUTHENTICATION_ARCHITECTURE.md](./AUTHENTICATION_ARCHITECTURE.md) | Cookies, JWT, refresh rotation |
| [RBAC_PERMISSION_MATRIX.md](./RBAC_PERMISSION_MATRIX.md) | Role → permission matrix |
| [SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md) | Controls and env vars |
| [AUDIT_LOGGING_DESIGN.md](./AUDIT_LOGGING_DESIGN.md) | Audit events and retention |
| [AUTH_API_REFERENCE.md](./AUTH_API_REFERENCE.md) | Endpoint reference |
| [SECURITY_TEST_REPORT.md](./SECURITY_TEST_REPORT.md) | Test results |

OpenAPI: `backend/openapi/auth.yaml` (served at `/api/openapi/auth.yaml`).

## Section 4 — Patient management & registration

| Document | Purpose |
|----------|---------|
| [PATIENT_MODULE_ARCHITECTURE.md](./PATIENT_MODULE_ARCHITECTURE.md) | Module layout |
| [PATIENT_DATA_MODEL.md](./PATIENT_DATA_MODEL.md) | Schema / fields |
| [PATIENT_API_REFERENCE.md](./PATIENT_API_REFERENCE.md) | Endpoints |
| [PATIENT_PERMISSIONS.md](./PATIENT_PERMISSIONS.md) | RBAC matrix |
| [PATIENT_WORKFLOW.md](./PATIENT_WORKFLOW.md) | Registration & search flows |
| [PATIENT_TEST_REPORT.md](./PATIENT_TEST_REPORT.md) | Test results |

OpenAPI: `backend/openapi/patients.yaml` → `/api/openapi/patients.yaml`.

## Section 5 — Appointments & queue

| Document | Purpose |
|----------|---------|
| [APPOINTMENT_MODULE_ARCHITECTURE.md](./APPOINTMENT_MODULE_ARCHITECTURE.md) | Module layout |
| [APPOINTMENT_WORKFLOW.md](./APPOINTMENT_WORKFLOW.md) | Booking / check-in flows |
| [PROVIDER_SCHEDULING_DESIGN.md](./PROVIDER_SCHEDULING_DESIGN.md) | Availability rules |
| [QUEUE_MANAGEMENT_DESIGN.md](./QUEUE_MANAGEMENT_DESIGN.md) | Queue numbering & board |
| [APPOINTMENT_API_REFERENCE.md](./APPOINTMENT_API_REFERENCE.md) | Endpoints |
| [APPOINTMENT_PERMISSION_MATRIX.md](./APPOINTMENT_PERMISSION_MATRIX.md) | RBAC |
| [APPOINTMENT_TEST_REPORT.md](./APPOINTMENT_TEST_REPORT.md) | Test results |

OpenAPI: `backend/openapi/appointments.yaml` → `/api/openapi/appointments.yaml`.

**Status:** Section 5 implemented — stop here; do not start Section 6 until approved.
