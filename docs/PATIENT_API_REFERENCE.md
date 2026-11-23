# Patient API Reference (Section 4)

Base: `/api`. Auth: HttpOnly session cookie. OpenAPI: `/api/openapi/patients.yaml` (file at `backend/openapi/patients.yaml`).

| Method | Path | Permission (summary) |
|--------|------|----------------------|
| GET | `/patients` | patients.read / assigned / ward / own |
| GET | `/patients/stats` | same |
| GET | `/patients/meta` | auth — location labels & ID types |
| POST | `/patients/duplicates` | create/update |
| POST | `/patients` | patients.create |
| GET | `/patients/:id` | scoped view |
| PATCH | `/patients/:id` | patients.update |
| GET/POST | `/patients/:id/medical-history` | medical_history.* / clinical |
| PATCH | `/patients/:id/medical-history/:entryId` | manage |
| POST | `/patients/:id/allergies` | medical history manage |
| GET/POST | `/patients/:id/encounters` | encounters.* |
| PATCH | `/encounters/:id` | encounters.update |
| GET/POST | `/patients/:id/documents` | documents.* |
| GET | `/patients/:patientId/documents/:docId/download` | documents.read |
| DELETE | `/patients/:patientId/documents/:docId` | documents.delete |

### Registration notes

- `409` + `code: POSSIBLE_DUPLICATES` when soft matches exist and `acknowledgeDuplicates` is not true.
- MRN assigned server-side only.

### Document upload body

```json
{
  "fileName": "report.pdf",
  "mimeType": "application/pdf",
  "contentBase64": "...",
  "category": "medical_report",
  "encounterId": null
}
```

Max size default 10MB (`PATIENT_DOC_MAX_BYTES`). Allowed: PDF, JPEG, PNG, WebP, text/plain.
