# Entity Relationship Diagram (ERD)

Role-Based Facility Reservation and Approval System — Supabase (PostgreSQL).

## ER Diagram

```mermaid
erDiagram
    profiles ||--o{ reservations : "requests"
    profiles ||--o{ service_requests : "reports"
    facilities ||--o{ reservations : "hosts"
    facilities ||--o{ service_requests : "subject of"
    profiles ||--o| reservations : "reviews (reviewed_by)"
    profiles ||--o{ audit_logs : "performs (user_id)"

    profiles {
        uuid id PK "references auth.users"
        text email UK
        text full_name
        user_role role "administrator | staff | requester"
        timestamptz created_at
    }

    facilities {
        uuid id PK
        text name UK
        text description
        text location
        int capacity ">= 0"
        facility_status status "active | maintenance | inactive"
        text condition_note
        timestamptz created_at
        timestamptz updated_at
    }

    reservations {
        uuid id PK
        uuid facility_id FK "-> facilities.id"
        uuid requester_id FK "-> profiles.id"
        text title
        text purpose
        timestamptz start_time
        timestamptz end_time
        reservation_status status "pending | approved | rejected | scheduled | in_use | completed | cancelled"
        uuid reviewed_by FK "-> profiles.id (administrator)"
        timestamptz reviewed_at
        text notes
        timestamptz created_at
        timestamptz updated_at
        "chk_start_before_end (start_time < end_time) -- BR-B4-02"
    }

    service_requests {
        uuid id PK
        uuid facility_id FK "-> facilities.id"
        uuid reported_by FK "-> profiles.id"
        text title
        text description
        service_status status "open | in_progress | resolved"
        timestamptz resolved_at
        timestamptz created_at
    }

    audit_logs {
        bigint id PK "identity"
        uuid user_id FK "-> profiles.id"
        text action
        text entity_type
        text entity_id
        jsonb details
        timestamptz created_at
    }
```

## Notes

- **profiles** is a 1:1 extension of Supabase `auth.users`. A trigger
  (`handle_new_user`) creates a profile (with `requester` role) whenever an
  auth user signs up. Administrator/Staff roles are assigned by an existing
  administrator (or via `seed.sql` for the demo accounts).
- **reservations** contains the full approval lifecycle. `reviewed_by` /
  `reviewed_at` record which administrator processed the request
  (auditability, BR-B4-10).
- **reserved time slots** are protected by a trigger that rejects rows whose
  `[start_time, end_time)` overlaps any `approved`, `scheduled` or `in_use`
  reservation of the same facility (BR-B4-03 / BR-B4-06).
- **audit_logs** is append-only from the client: no `INSERT/UPDATE/DELETE`
  grants are given to `anon`/`authenticated`. Every entry is written by a
  `SECURITY DEFINER` trigger (BR-B4-10).
- Cardinality: a facility can host many reservations; a profile (requester)
  can create many reservations; an administrator reviews many reservations;
  staff report many service requests.

## Relationships summary

| Relationship                       | Type   | Key                          |
| ---------------------------------- | ------ | ---------------------------- |
| profile requests reservation       | 1 : N  | reservations.requester_id    |
| facility hosts reservation         | 1 : N  | reservations.facility_id     |
| administrator reviews reservation  | 1 : N  | reservations.reviewed_by     |
| facility is subject of service req | 1 : N  | service_requests.facility_id |
| profile reports service request    | 1 : N  | service_requests.reported_by |
| profile performs audit log entry   | 1 : N  | audit_logs.user_id           |