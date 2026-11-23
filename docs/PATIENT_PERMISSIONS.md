# Patient Permissions (Section 4)

| Permission | Admin | Doctor | Nurse | Receptionist | Lab | Pharmacist |
|------------|:-----:|:------:|:-----:|:------------:|:---:|:----------:|
| patients.read | Y | — | — | Y | — | — |
| patients.read_assigned | — | Y | — | — | Y | Y |
| patients.read_ward | — | — | Y | — | — | — |
| patients.create / update | Y | — | — | Y | — | — |
| patients.archive | Y | — | — | —* | — | — |
| patients.medical_history.read | Y | Y | Y | — | — | — |
| patients.medical_history.manage | Y | Y | — | — | — | — |
| patients.documents.read | Y | Y | Y | Y | Y | — |
| patients.documents.upload | Y | Y | — | Y | — | — |
| patients.documents.delete | Y | — | — | — | — | — |
| encounters.read/create | Y | Y | Y† | Y | read | — |
| encounters.update | Y | Y | — | — | — | — |

\* Receptionist may set `status: archived` only if also granted `patients.archive` (default: admin). Update path still requires `patients.update`.  
† Nurses: create + read.

Clinical `condition` remains redacted for roles without clinical/medical-history access.
