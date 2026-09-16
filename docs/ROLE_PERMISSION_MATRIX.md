# Role–Permission Matrix

Legend: **R** = read/view · **C** = create · **U** = update · **✓** = full
(function-based) · **—** = not permitted (blocked).

| Functionality                                     | Requester | Facility Staff | Administrator |
| ------------------------------------------------- | :-------: | :------------: | :-----------: |
| **Facilities**                                    |           |                |               |
| Browse facilities & conditions                    | R         | R              | R             |
| Create / edit / set facility status               | —         | U (condition, active↔maintenance) | ✓ (CRUD) |
| Reserve a facility                                | C         | —              | —             |
| **Reservations**                                  |           |                |               |
| Submit reservation request                        | ✓         | —              | —             |
| View own reservations / history                   | R         | —              | —             |
| View all reservations                             | —         | R              | R             |
| Edit own **Pending** request                      | ✓ (own)   | —              | —             |
| Cancel own eligible request (Pending/Approved)    | ✓ (own)   | —              | —             |
| Approve / reject (BR-B4-04)                       | —         | —              | ✓             |
| Schedule approved reservation                     | —         | —              | ✓             |
| Cancel reservation (admin override)               | —         | —              | ✓             |
| Confirm facility usage → **In Use**               | —         | ✓              | ✓             |
| Record completion → **Completed**                 | —         | ✓              | ✓             |
| **Service requests**                              |           |                |               |
| Create service request                            | —         | ✓              | ✓             |
| Update service request status                     | —         | ✓              | ✓             |
| View service concerns                             | —         | R              | R             |
| **Users & audit**                                 |           |                |               |
| Manage user roles                                 | —         | —              | ✓             |
| View audit log                                    | —         | —              | R             |
| View reports                                      | —         | —              | R             |
| Update own profile name                           | ✓         | ✓              | ✓             |

## Permitted functions per role (summary)

| Role          | Permitted functions (lab spec)                        |
| ------------- | ----------------------------------------------------- |
| Administrator | Manage facilities & users; approve/reject reservations; view service concerns, reports & audit logs |
| Facility Staff| View reservations; confirm facility usage; record completion; create service requests; update facility condition |
| Requester     | View facilities; submit reservation requests; view status; cancel eligible own requests; view history |

## Enforcement layers

1. **UI / navigation** — `js/app.js` builds the menu from the signed-in role;
   pages restrict actions per role.
2. **RPC functions (database)** — every write is a `SECURITY DEFINER` function
   that re-checks the caller's role (`public.has_role(...)`) before acting.
3. **Row Level Security** — `SELECT` policies on `reservations` limit requesters
   to their own rows; `audit_logs` is administrator-only; direct client writes
   to `audit_logs` are revoked.
4. **Triggers** — business rules (overlap, transitions, completed-lock, etc.)
   run regardless of the calling path (BR-B4-01 … BR-B4-10).