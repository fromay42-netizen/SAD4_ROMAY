-- ============================================================================
--  Lab 4 Section B - Seed / demo data
--  Run AFTER schema.sql in the Supabase SQL Editor.
--
--  Creates:
--    * 4 demo facilities (one under maintenance for TC-B4-08)
--    * 4 demo auth users  (all passwords: password123)
--        admin@example.com  -> Administrator
--        staff@example.com  -> Facility Staff
--        requester@example.com   -> Requester
--        requester2@example.com  -> Requester
--    * sample reservations covering the full workflow
--    * sample service requests
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Demo facilities
-- ----------------------------------------------------------------------------
insert into public.facilities (id, name, description, location, capacity, status, condition_note)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', 'Lecture Hall A',
   'Air-conditioned lecture hall with projector and whiteboard.',
   'Main Building, Floor 1', 120, 'active', 'Projector lamp replaced 2026-09-01.'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', 'Conference Room B',
   'Meeting room with video-conferencing equipment.',
   'Main Building, Floor 2', 20, 'active', ''),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', 'Sports Hall',
   'Indoor court for basketball, badminton and volleyball.',
   'Annex Building', 300, 'active', ''),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04', 'Computer Laboratory',
   '40 workstations with course software.',
   'ICT Building, Floor 3', 40, 'maintenance',
   'HVAC breakdown - under maintenance, temporarily not reservable.')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Demo auth users (all passwords: password123)
-- Profiles are created automatically by the on_auth_user_created trigger.
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  invited_at, confirmation_token, confirmation_sent_at, recovery_token,
  recovery_sent_at, email_change_token_new, email_change, email_change_sent_at,
  last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'admin@example.com', crypt('password123', gen_salt('bf')), now(),
   now(), '', now(), '', now(), '', false, now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Alice Administrator"}', false, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'staff@example.com', crypt('password123', gen_salt('bf')), now(),
   now(), '', now(), '', now(), '', false, now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Sam Staff"}', false, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'requester@example.com', crypt('password123', gen_salt('bf')), now(),
   now(), '', now(), '', now(), '', false, now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Rita Requester"}', false, now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated',
   'requester2@example.com', crypt('password123', gen_salt('bf')), now(),
   now(), '', now(), '', now(), '', false, now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Rex Requester"}', false, now(), now())
on conflict (id) do nothing;

-- Assign roles to profiles created by the trigger
update public.profiles set role = 'administrator' where email = 'admin@example.com';
update public.profiles set role = 'staff'         where email = 'staff@example.com';
-- requester@example.com and requester2@example.com stay 'requester'

-- ----------------------------------------------------------------------------
-- Sample reservations (cover the full workflow)
-- ----------------------------------------------------------------------------
insert into public.reservations
  (facility_id, requester_id, title, purpose, start_time, end_time, status, notes)
values
  -- Pending request -> appears in the admin approval queue
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01',
   '33333333-3333-3333-3333-333333333333',
   'Guest Lecture - Systems Analysis',
   'Semester 1 guest lecture, expected 90 attendees.',
   now() + interval '1 day 9 hours', now() + interval '1 day 11 hours',
   'pending', 'Awaiting approval.'),
  -- Approved request -> can be scheduled by admin
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02',
   '33333333-3333-3333-3333-333333333333',
   'Project Defence',
   'Final project defence session.',
   now() + interval '2 days 14 hours', now() + interval '2 days 16 hours',
   'approved', 'Approved by administrator.'),
  -- Already in use -> staff can record completion
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03',
   '33333333-3333-3333-3333-333333333333',
   'Inter-class Basketball',
   'Sports day basketball tournament.',
   now() - interval '2 hours', now() + interval '1 hour',
   'in_use', ''),
  -- Completed reservation -> cannot be edited (BR-B4-07)
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01',
   '44444444-4444-4444-4444-444444444444',
   'Orientation Talk',
   'Freshmen orientation.',
   now() - interval '1 day 10 hours', now() - interval '1 day 8 hours',
   'completed', 'Completed by staff.'),
  -- Rejected reservation -> cannot become scheduled (BR-B4-05)
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02',
   '44444444-4444-4444-4444-444444444444',
   'Personal Event',
   'Non-institutional private gathering.',
   now() - interval '1 day 15 hours', now() - interval '1 day 14 hours',
   'rejected', 'Rejected: private events not supported.'),
  -- Second pending request from another requester
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01',
   '44444444-4444-4444-4444-444444444444',
   'Study Group Session',
   'Weekly study group, 15 students.',
   now() + interval '1 day 12 hours', now() + interval '1 day 13 hours',
   'pending', 'Awaiting approval.')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Sample service requests
-- ----------------------------------------------------------------------------
insert into public.service_requests (facility_id, reported_by, title, description, status)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03',
   '22222222-2222-2222-2222-222222222222',
   'Loose basketball hoop ring',
   'The ring on court 1 is loose and unsafe.',
   'open'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04',
   '22222222-2222-2222-2222-222222222222',
   'HVAC breakdown',
   'Air-conditioning not working; facility placed under maintenance.',
   'in_progress')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Expected login accounts
-- ----------------------------------------------------------------------------
-- administrator : admin@example.com      / password123
-- staff         : staff@example.com      / password123
-- requester     : requester@example.com  / password123
-- requester 2   : requester2@example.com / password123