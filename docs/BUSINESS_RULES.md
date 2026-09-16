# Business Rules

All rules are enforced in the database (trigger / constraint / RPC), so they
hold for every calling path including the web UI.

| ID       | Rule                                          | Enforcement point in `supabase/schema.sql`                                  |
| -------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| BR-B4-01 | Only active facilities may be reserved.       | `enforce_reservation_rules()` — INSERT and transition to approved/scheduled/in_use require facility `status = 'active'`. |
| BR-B4-02 | Reservation start must precede end time.      | CHECK constraint `chk_start_before_end (start_time < end_time)` **and** a guard in `enforce_reservation_rules()`. |
| BR-B4-03 | Overlapping approved schedules are prohibited.| `enforce_reservation_rules()` counts overlapping `approved/scheduled/in_use` rows for the same facility and raises `BR-B4-03/06…`. Re-checked on approval and scheduling. |
| BR-B4-04 | Only Administrator may approve reservations.  | `admin_approve_reservation` / `admin_reject_reservation` call `public.has_role('administrator')` and raise `Permission denied` otherwise. |
| BR-B4-05 | Rejected reservations cannot become Scheduled.| Transition guard in `enforce_reservation_rules()` rejects `rejected → scheduled`. |
| BR-B4-06 | Approved reservations reserve the time slot.  | Same overlap mechanism as BR-B4-03 — an approved/scheduled/in_use reservation blocks any conflicting request. |
| BR-B4-07 | Completed reservations cannot be edited.      | `enforce_reservation_rules()` raises `BR-B4-07` on any `UPDATE` of a row with `status = 'completed'`. |
| BR-B4-08 | Facilities under Maintenance cannot be reserved.| Same facility-status check as BR-B4-01 (`status <> 'active'` blocked). UI also disables the reserve button for non-active facilities. |
| BR-B4-09 | Requesters may modify only their own Pending requests.| `update_pending_reservation` filters by `id = auth.uid()` and requires `status = 'pending'`; RLS policy `reservations_update_requester_own_pending` mirrors it. |
| BR-B4-10 | Approval and status changes must be logged.   | `SECURITY DEFINER` audit triggers on `reservations` (`trg_audit_reservations`), `facilities`, `service_requests` and `profiles` write every event into `audit_logs`. Client has no direct write access. |

## Additional defensive rules

- **Allowed transition matrix** in `enforce_reservation_rules()` (see
  `docs/WORKFLOW.md`) blocks illegal jumps such as `pending → completed`.
- **Slot re-check on approval/scheduling** prevents double-booking that could
  arise between submission and review.
- **Facility not found / capacity >= 0** constraints (`capacity >= 0`), plus
  NOT NULL / unique constraints on facility name and profile email.

## Test coverage map

| Business rule | Covered by test case(s) |
| ------------- | ----------------------- |
| BR-B4-01, BR-B4-08 | TC-B4-08 |
| BR-B4-02             | verified during TC-B4-01 (form validates) |
| BR-B4-03, BR-B4-06 | TC-B4-02 |
| BR-B4-04             | TC-B4-03, TC-B4-04 |
| BR-B4-05             | TC-B4-04 follow-up (rejected ↓ cannot schedule) |
| BR-B4-07             | TC-B4-06 follow-up (completed ↓ edit blocked) |
| BR-B4-09             | TC-B4-07 |
| BR-B4-10             | TC-B4-09 |
| RLS / access         | TC-B4-10 |