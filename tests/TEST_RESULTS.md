# Functional Test Results

Test each scenario, record the result, and paste a screenshot (or a short
video/photo) as evidence. The expected result column is pre-filled from the
spec; the **Actual** column is your observed outcome.

> Demo accounts (seed.sql): `admin@example.com`, `staff@example.com`,
> `requester@example.com`, `requester2@example.com` — all password `password123`.
> If you use fresh signups, promote one user to administrator in SQL first
> (`update public.profiles set role='administrator' where email='…';`).

| Test ID | Scenario | Steps (which account) | Expected result | Actual result | Pass/Fail |
| ------- | -------- | --------------------- | --------------- | ------------- | :-------: |
| TC-B4-01 | Requester submits reservation | `requester@example.com` → Facilities → **Reserve** on **Lecture Hall A** → pick a future time → Submit | Saved with status **Pending**; appears in “My reservations”. | | |
| TC-B4-02 | Submit overlapping schedule | Same requester → try to book **Lecture Hall A** overlapping the **approved** “Project Defence” slot (or another approved slot) | Conflict detected and blocked — toast shows `BR-B4-03/06: Overlapping schedule conflict…`; no new row created. | | |
| TC-B4-03 | Administrator approves request | `admin@example.com` → Approvals → pick a Pending row → **Approve** (or **Approve & Schedule**) | Status becomes **Approved** (then **Scheduled**); requester sees new status. | | |
| TC-B4-04 | Administrator rejects request | Approvals → pick another Pending row → Reject + note | Status becomes **Rejected**; requester sees rejection note. Rejected row has **no Schedule** button (BR-B4-05). | | |
| TC-B4-05 | Staff marks facility In Use | `staff@example.com` → Reservations → a **Scheduled** row → **Mark In Use** | Status updated to **In Use**. | | |
| TC-B4-06 | Staff completes reservation | Reservations → an **In Use** row → **Record Complete** | Status becomes **Completed**. Further edits blocked (BR-B4-07). | | |
| TC-B4-07 | Requester edits another user's request | Log in as `requester@example.com`; try to open/resubmit a request owned by `requester2@example.com` (e.g. via another tab / direct RPC) | Blocked — `update_pending_reservation` raises “Reservation not found or you do not own it.”; RLS hides other users’ rows. | | |
| TC-B4-08 | Reserve facility under maintenance | Requester → Facilities → **Computer Laboratory** (maintenance) | Reserve button disabled; direct RPC attempt returns `BR-B4-08: Cannot reserve facility …`. | | |
| TC-B4-09 | Check audit log | `admin@example.com` → Audit Logs | Entries visible for submit / approve / reject / in-use / complete / cancel. Sample query below. | | |
| TC-B4-10 | Open protected page without login | Open the app in a private window, try `#/audit` or `#/approvals` before signing in | Access denied — redirected to the login screen; menu shows no protected links. | | |

## Supporting queries

```sql
-- All audit entries involving reservations (TC-B4-09)
select a.created_at, p.email, a.action, a.details
from public.audit_logs a
left join public.profiles p on p.id = a.user_id
where a.entity_type = 'reservation'
order by a.created_at desc;

-- Confirm no overlapping active reservation exists (BR-B4-03/06)
select f.name, r.start_time, r.end_time, r.status
from public.reservations r
join public.facilities f on f.id = r.facility_id
where r.status in ('approved','scheduled','in_use')
order by f.name, r.start_time;

-- Verify only active facilities are reservable (BR-B4-01/08)
select name, status from public.facilities order by name;
```

## Outcome summary

| Metric                | Value |
| --------------------- | ----- |
| Total test cases      | 10    |
| Passed                |       |
| Failed                |       |
| Tested on            | date / browser |