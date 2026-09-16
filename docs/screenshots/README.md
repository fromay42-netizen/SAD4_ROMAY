# Screenshots

## Required by the submission (Submission requirement #7)

Capture the **Audit Log** screen after performing the workflow tests
(TC-B4-01 … TC-B4-09). Suggested evidence set:

1. `audit-log.png` — **Audit Log** page (Administrator) showing entries for
   `reservation_submitted`, `reservation_approved`, `reservation_rejected`,
   `reservation_scheduled`, `reservation_in_use`, `reservation_completed`,
   `reservation_cancelled`, `facility_updated`, `user_role_changed`.
2. `approval-screen.png` — Approvals page showing Pending queue.
3. `reservation-requester.png` — Requester “My Reservations” with Pending status.
4. `blocked-overlap.png` — the `BR-B4-03/06` conflict toast (TC-B4-02).
5. `blocked-maintenance.png` — reserve control disabled for maintenance facility.

### How to capture

1. Deploy the app (see `README.md`) and sign in with `admin@example.com`.
2. Complete the TC-B4-01 … TC-B4-09 steps in `tests/TEST_RESULTS.md`.
3. Open **Audit Logs**, expand a few rows (`view`) and take a screenshot.
4. Save the images in this folder and reference them in
   `tests/TEST_RESULTS.md`.

> Placeholder note: images are to be added after the live deployment. This
> folder is part of the repository so the final submission includes the
> screenshot in version control.