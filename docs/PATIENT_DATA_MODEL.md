# Patient Data Model (Section 4)

## Patient

| Field | Notes |
|-------|--------|
| `patientNumber` | Stable facility MRN (`FIL-001-000001` style); unique `(facilityId, patientNumber)` |
| `firstName` / `middleName` / `lastName` | Structured name; `name` kept as display mirror |
| `dateOfBirth` | Preferred age source; `age` optional compatibility |
| `sex` | `male` \| `female` \| `other` \| `unknown` |
| Contact | `phone`, `phoneAlt`, `email` |
| Location | `region`, `zone`, `woreda`, `kebele`, `addressDetail` — **labels configurable** via `FacilitySettings.featuresJson.locationLabels` |
| `status` | `active` \| `archived` |
| `registeredById`, `registrationNotes` | Registration metadata |

## Related

| Model | Purpose |
|-------|---------|
| `PatientIdentifier` | Optional ID types (`national_id`, `passport`, …); unique per facility+system+value |
| `PatientEmergencyContact` | Emergency contacts (+ optional address) |
| `PatientAllergy` | Allergies with severity; not overwritten silently (`active` flag) |
| `MedicalHistoryEntry` | Structured history by category; updates deactivate rather than delete |
| `Encounter` | Visit foundation (`outpatient` \| `emergency` \| `inpatient` \| `follow_up`) |
| `PatientDocument` | Metadata + private `storageKey` (soft-delete via `deletedAt`) |
| `PatientNumberSequence` | Atomic MRN counter per facility |

## Future modules

Encounters / documents / history IDs are the integration points for clinical notes, lab results, and prescriptions — those payloads are **not** invented here.
