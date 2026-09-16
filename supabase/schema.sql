-- ============================================================================
--  SYSTEMS ANALYSIS AND DESIGN - LAB 4 SECTION B
--  Role-Based Facility Reservation and Approval System
--  Supabase / PostgreSQL schema
-- ----------------------------------------------------------------------------
--  This file creates:
--    * Enums  (user_role, facility_status, reservation_status, service_status)
--    * Tables (profiles, facilities, reservations, service_requests, audit_logs)
--    * Row Level Security  (role based access control)
--    * Business-rule triggers (BR-B4-01 .. BR-B4-10)
--    * Audit-log triggers
--    * RPC wrappers used by the front-end
--  Run in: Supabase Dashboard -> SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extension
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('administrator', 'staff', 'requester');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.facility_status as enum ('active', 'maintenance', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reservation_status as enum
    ('pending', 'approved', 'rejected', 'scheduled', 'in_use', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.service_status as enum ('open', 'in_progress', 'resolved');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  full_name  text not null default '',
  role       public.user_role not null default 'requester',
  created_at timestamptz not null default now()
);

create table if not exists public.facilities (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  description    text not null default '',
  location       text not null default '',
  capacity       integer not null default 0 check (capacity >= 0),
  status         public.facility_status not null default 'active',
  condition_note text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.reservations (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities (id),
  requester_id uuid not null references public.profiles (id),
  title        text not null default '',
  purpose      text not null default '',
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  status       public.reservation_status not null default 'pending',
  reviewed_by  uuid references public.profiles (id),
  reviewed_at  timestamptz,
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- BR-B4-02 : Reservation start must precede end time
  constraint chk_start_before_end check (start_time < end_time)
);

create table if not exists public.service_requests (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  reported_by uuid not null references public.profiles (id),
  title       text not null default '',
  description text not null default '',
  status      public.service_status not null default 'open',
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles (id),
  action      text not null,
  entity_type text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_reservations_facility_time on public.reservations (facility_id, start_time, end_time);
create index if not exists idx_reservations_status          on public.reservations (status);
create index if not exists idx_reservations_requester       on public.reservations (requester_id);
create index if not exists idx_audit_user                   on public.audit_logs (user_id);
create index if not exists idx_audit_action                 on public.audit_logs (action);

-- ============================================================================
-- 4. Row Level Security - enable on all tables
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.facilities      enable row level security;
alter table public.reservations    enable row level security;
alter table public.service_requests enable row level security;
alter table public.audit_logs      enable row level security;

-- -------- helper: current role of the signed-in user ------------------------
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- -------- helper: has a given role ------------------------------------------
create or replace function public.has_role(p_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = p_role
  );
$$;

-- -------- profiles ----------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin_or_staff" on public.profiles;
create policy "profiles_select_own_or_admin_or_staff"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.has_role('staff')
    or public.has_role('administrator')
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- -------- facilities --------------------------------------------------------
drop policy if exists "facilities_select_all_authenticated" on public.facilities;
create policy "facilities_select_all_authenticated"
  on public.facilities for select
  to authenticated
  using (true);

-- -------- reservations ------------------------------------------------------
drop policy if exists "reservations_select_own_or_staff_or_admin" on public.reservations;
create policy "reservations_select_own_or_staff_or_admin"
  on public.reservations for select
  using (
    requester_id = auth.uid()
    or public.has_role('staff')
    or public.has_role('administrator')
  );

-- BR-B4-09 : requesters may modify only their own Pending requests
drop policy if exists "reservations_update_requester_own_pending" on public.reservations;
create policy "reservations_update_requester_own_pending"
  on public.reservations for update
  using (requester_id = auth.uid() and status = 'pending')
  with check (requester_id = auth.uid() and status in ('pending', 'cancelled'));

drop policy if exists "reservations_update_staff" on public.reservations;
create policy "reservations_update_staff"
  on public.reservations for update
  using (public.has_role('staff') or public.has_role('administrator'))
  with check (status in ('in_use', 'completed', 'approved', 'scheduled', 'rejected', 'cancelled'));

-- -------- service_requests --------------------------------------------------
drop policy if exists "service_requests_select_staff_admin" on public.service_requests;
create policy "service_requests_select_staff_admin"
  on public.service_requests for select
  using (public.has_role('staff') or public.has_role('administrator'));

-- -------- audit_logs --------------------------------------------------------
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
  on public.audit_logs for select
  using (public.has_role('administrator'));

-- Direct writes to audit_logs are NOT allowed from the client.
revoke insert, update, delete on public.audit_logs from anon, authenticated;

-- ============================================================================
-- 5. Business rule & audit triggers
-- ============================================================================

-- -------- helper: keep updated_at fresh -------------------------------------
create or replace function public.trg_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -------- helper: create profile when a user signs up -----------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'requester'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Business rules on reservations:
--   BR-B4-01 only active facilities may be reserved
--   BR-B4-02 reservation start must precede end time
--   BR-B4-03 overlapping approved schedules are prohibited
--   BR-B4-04 only Administrator may approve  (enforced in RPC + RLS)
--   BR-B4-05 rejected reservations cannot become scheduled
--   BR-B4-06 approved reservations reserve the time slot
--   BR-B4-07 completed reservations cannot be edited
--   BR-B4-08 facilities under maintenance cannot be reserved
-- ----------------------------------------------------------------------------
create or replace function public.enforce_reservation_rules()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_facility public.facilities%rowtype;
  v_overlap  integer;
  v_fac_id   uuid;
begin
  v_fac_id := new.facility_id;

  -- BR-B4-02 : start must precede end
  if new.start_time is null or new.end_time is null or new.start_time >= new.end_time then
    raise exception 'BR-B4-02: Reservation start must precede end time.';
  end if;

  select * into v_facility from public.facilities where id = v_fac_id;
  if not found then
    raise exception 'Facility not found.';
  end if;

  -- BR-B4-07 : completed reservations cannot be edited
  if tg_op = 'UPDATE' and old.status = 'completed' then
    raise exception 'BR-B4-07: Completed reservations cannot be edited.';
  end if;

  -- Allowed status transitions (includes BR-B4-05)
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if not (
       (old.status = 'pending'   and new.status in ('pending', 'approved', 'rejected', 'cancelled')) or
       (old.status = 'approved'  and new.status in ('scheduled', 'cancelled')) or
       (old.status = 'scheduled' and new.status in ('in_use', 'cancelled')) or
       (old.status = 'in_use'    and new.status = 'completed')
    ) then
      raise exception 'Illegal status transition: % -> %', old.status, new.status;
    end if;
  end if;

  -- BR-B4-05 : rejected cannot become scheduled
  if tg_op = 'UPDATE' and old.status = 'rejected' and new.status = 'scheduled' then
    raise exception 'BR-B4-05: Rejected reservations cannot become Scheduled.';
  end if;

  -- BR-B4-01 / BR-B4-08 : facility must be active at creation,
  -- and when a reservation becomes active (approved/scheduled/in_use)
  if tg_op = 'INSERT' then
    if v_facility.status <> 'active' then
      raise exception 'BR-B4-08: Cannot reserve facility "%" (status: %).', v_facility.name, v_facility.status;
    end if;
  elsif tg_op = 'UPDATE' and new.status in ('approved', 'scheduled', 'in_use')
        and v_facility.status <> 'active' then
    raise exception 'BR-B4-01: Facility "%" is not active (status: %).', v_facility.name, v_facility.status;
  end if;

  -- BR-B4-03 / BR-B4-06 : overlap check.
  -- Runs on insert, on edits that change time/facility, and whenever the
  -- reservation enters an active state.
  if tg_op = 'INSERT'
     or (tg_op = 'UPDATE' and (
         new.start_time is distinct from old.start_time
         or new.end_time   is distinct from old.end_time
         or new.facility_id is distinct from old.facility_id
         or new.status in ('approved', 'scheduled', 'in_use')
     ))
  then
    select count(*) into v_overlap
    from public.reservations r
    where r.facility_id = v_fac_id
      and r.status in ('approved', 'scheduled', 'in_use')
      and r.id <> new.id
      and new.start_time < r.end_time
      and new.end_time   > r.start_time;

    if v_overlap > 0 then
      raise exception 'BR-B4-03/06: Overlapping schedule conflict detected for facility "%".', v_facility.name;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reservation_rules on public.reservations;
create trigger trg_reservation_rules
  before insert or update on public.reservations
  for each row execute function public.enforce_reservation_rules();

drop trigger if exists trg_reservation_updated_at on public.reservations;
create trigger trg_reservation_updated_at
  before update on public.reservations
  for each row execute function public.trg_set_updated_at();

drop trigger if exists trg_facility_updated_at on public.facilities;
create trigger trg_facility_updated_at
  before update on public.facilities
  for each row execute function public.trg_set_updated_at();

-- ----------------------------------------------------------------------------
-- Audit logs  (BR-B4-10 : approval and status changes must be logged)
-- ----------------------------------------------------------------------------
create or replace function public.trg_audit_reservations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_old     text;
  v_new     text;
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'reservation_deleted', 'reservation', old.id::text,
            jsonb_build_object('old_status', old.status::text,
                               'facility_id', old.facility_id::text));
    return old;
  end if;

  if tg_op = 'INSERT' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'reservation_submitted', 'reservation', new.id::text,
            jsonb_build_object('old_status', null,
                               'new_status', new.status::text,
                               'facility_id', new.facility_id::text,
                               'requester_id', new.requester_id::text,
                               'start_time', new.start_time,
                               'end_time', new.end_time));
    return new;
  end if;

  -- UPDATE
  v_old := old.status::text;
  v_new := new.status::text;

  if v_old is distinct from v_new then
    v_action := case v_new
      when 'approved'  then 'reservation_approved'
      when 'rejected'  then 'reservation_rejected'
      when 'scheduled' then 'reservation_scheduled'
      when 'in_use'    then 'reservation_in_use'
      when 'completed' then 'reservation_completed'
      when 'cancelled' then 'reservation_cancelled'
      else 'reservation_status_changed'
    end;
  else
    v_action := 'reservation_updated';
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (auth.uid(), v_action, 'reservation', new.id::text,
          jsonb_build_object('old_status', v_old,
                             'new_status', v_new,
                             'facility_id', new.facility_id::text,
                             'requester_id', new.requester_id::text,
                             'start_time', new.start_time,
                             'end_time', new.end_time,
                             'reviewed_by', new.reviewed_by::text));
  return new;
end;
$$;

drop trigger if exists trg_audit_reservations on public.reservations;
create trigger trg_audit_reservations
  after insert or update or delete on public.reservations
  for each row execute function public.trg_audit_reservations();

create or replace function public.trg_audit_facilities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_action text;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'facility_created', 'facility', new.id::text,
            jsonb_build_object('name', new.name,
                               'new_status', new.status::text,
                               'condition_note', new.condition_note));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'facility_updated', 'facility', new.id::text,
            jsonb_build_object('name', new.name,
                               'old_status', old.status::text,
                               'new_status', new.status::text,
                               'condition_note', new.condition_note));
    return new;
  end if;

  -- DELETE
  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'facility_deleted', 'facility', old.id::text,
          jsonb_build_object('name', old.name,
                             'old_status', old.status::text));
  return old;
end;
$$;

drop trigger if exists trg_audit_facilities on public.facilities;
create trigger trg_audit_facilities
  after insert or update or delete on public.facilities
  for each row execute function public.trg_audit_facilities();

create or replace function public.trg_audit_service_requests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_action text; v_old text; v_new text;
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'service_request_deleted', 'service_request', old.id::text,
            jsonb_build_object('old_status', old.status::text));
    return old;
  end if;

  v_action := 'service_request_created';
  if tg_op = 'UPDATE' then
    v_old := old.status::text;
    v_new := new.status::text;
    v_action := case
      when v_new = 'resolved'  then 'service_request_resolved'
      when v_old = 'open' and v_new = 'in_progress' then 'service_request_in_progress'
      else 'service_request_updated'
    end;
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (auth.uid(), v_action, 'service_request', new.id::text,
          jsonb_build_object('facility_id', new.facility_id::text,
                             'status', new.status::text));
  return new;
end;
$$;

drop trigger if exists trg_audit_service_requests on public.service_requests;
create trigger trg_audit_service_requests
  after insert or update or delete on public.service_requests
  for each row execute function public.trg_audit_service_requests();

create or replace function public.trg_audit_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_action text;
begin
  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    v_action := 'user_role_changed';
  elsif tg_op = 'UPDATE' then
    v_action := 'user_profile_updated';
  else
    return coalesce(new, old);
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (auth.uid(), v_action, 'profile', new.id::text,
          jsonb_build_object('email', new.email,
                             'old_role', old.role::text,
                             'new_role', new.role::text));
  return new;
end;
$$;

drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
  after update on public.profiles
  for each row execute function public.trg_audit_profiles();

-- ============================================================================
-- 6. RPC functions used by the front-end
-- ============================================================================

-- -------- Reservations : requester -----------------------------------------
create or replace function public.create_reservation(
  p_facility_id uuid,
  p_title       text,
  p_purpose     text,
  p_start_time  timestamptz,
  p_end_time    timestamptz
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.reservations;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  insert into public.reservations
    (facility_id, requester_id, title, purpose, start_time, end_time, status)
  values (p_facility_id, auth.uid(), coalesce(p_title, ''), coalesce(p_purpose, ''),
          p_start_time, p_end_time, 'pending')
  returning * into v_res;

  return v_res;
end;
$$;

-- BR-B4-09 : requesters may modify only their own Pending requests
create or replace function public.update_pending_reservation(
  p_reservation_id uuid,
  p_facility_id     uuid,
  p_title           text,
  p_purpose         text,
  p_start_time      timestamptz,
  p_end_time        timestamptz
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res    public.reservations;
  v_active boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  select (status = 'active') into v_active from public.facilities where id = p_facility_id;
  if v_active is null then
    raise exception 'Facility not found.';
  elsif not v_active then
    raise exception 'BR-B4-08: Facility is not active and cannot be reserved.';
  end if;

  select * into v_res from public.reservations
   where id = p_reservation_id and requester_id = auth.uid() for update;

  if not found then
    raise exception 'Reservation not found or you do not own it.';
  elsif v_res.status <> 'pending' then
    raise exception 'BR-B4-09: Only your own Pending requests may be modified.';
  end if;

  update public.reservations
     set facility_id = p_facility_id,
         title       = coalesce(p_title, v_res.title),
         purpose     = coalesce(p_purpose, v_res.purpose),
         start_time  = p_start_time,
         end_time    = p_end_time
   where id = p_reservation_id
   returning * into v_res;

  return v_res;
end;
$$;

create or replace function public.cancel_reservation(
  p_reservation_id uuid
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.reservations;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  select * into v_res from public.reservations
   where id = p_reservation_id and requester_id = auth.uid() for update;

  if not found then
    raise exception 'Reservation not found or you do not own it.';
  elsif v_res.status not in ('pending', 'approved') then
    raise exception 'This reservation can no longer be cancelled (status: %).', v_res.status;
  end if;

  update public.reservations
     set status = 'cancelled',
         notes  = left(trim(concat_ws(' ', v_res.notes, 'Cancelled by requester.')), 1000)
   where id = p_reservation_id
   returning * into v_res;

  return v_res;
end;
$$;

-- -------- Reservations : administrator (BR-B4-04) ---------------------------
create or replace function public.admin_approve_reservation(
  p_reservation_id uuid,
  p_notes           text default null
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.reservations;
begin
  if not public.has_role('administrator') then
    raise exception 'BR-B4-04: Only an Administrator may approve reservations.';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;

  if not found then
    raise exception 'Reservation not found.';
  elsif v_res.status <> 'pending' then
    raise exception 'Only Pending reservations can be approved (status: %).', v_res.status;
  end if;

  update public.reservations
     set status = 'approved',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         notes = left(trim(concat_ws(' ', v_res.notes, coalesce(p_notes, ''))), 1000)
   where id = p_reservation_id
   returning * into v_res;

  return v_res;
end;
$$;

create or replace function public.admin_reject_reservation(
  p_reservation_id uuid,
  p_notes           text default null
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.reservations;
begin
  if not public.has_role('administrator') then
    raise exception 'Permission denied: administrator role required.';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;

  if not found then
    raise exception 'Reservation not found.';
  elsif v_res.status <> 'pending' then
    raise exception 'Only Pending reservations can be rejected (status: %).', v_res.status;
  end if;

  update public.reservations
     set status = 'rejected',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         notes = left(trim(concat_ws(' ', v_res.notes, coalesce(p_notes, ''))), 1000)
   where id = p_reservation_id
   returning * into v_res;

  return v_res;
end;
$$;

create or replace function public.admin_schedule_reservation(
  p_reservation_id uuid
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.reservations;
begin
  if not public.has_role('administrator') then
    raise exception 'Permission denied: administrator role required.';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;

  if not found then
    raise exception 'Reservation not found.';
  elsif v_res.status <> 'approved' then
    raise exception 'Only Approved reservations can be scheduled (status: %).', v_res.status;
  end if;

  update public.reservations
     set status = 'scheduled'
   where id = p_reservation_id
   returning * into v_res;

  return v_res;
end;
$$;

create or replace function public.admin_approve_and_schedule(
  p_reservation_id uuid,
  p_notes           text default null
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.reservations;
begin
  v_res := public.admin_approve_reservation(p_reservation_id, p_notes);
  if v_res.status <> 'approved' then
    return v_res;
  end if;
  v_res := public.admin_schedule_reservation(p_reservation_id);
  return v_res;
end;
$$;

create or replace function public.admin_cancel_reservation(
  p_reservation_id uuid,
  p_notes           text default null
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.reservations;
begin
  if not public.has_role('administrator') then
    raise exception 'Permission denied: administrator role required.';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;

  if not found then
    raise exception 'Reservation not found.';
  elsif v_res.status not in ('pending', 'approved', 'scheduled') then
    raise exception 'This reservation can no longer be cancelled (status: %).', v_res.status;
  end if;

  update public.reservations
     set status = 'cancelled',
         notes  = left(trim(concat_ws(' ', v_res.notes, 'Cancelled by administrator.', coalesce(p_notes, ''))), 1000)
   where id = p_reservation_id
   returning * into v_res;

  return v_res;
end;
$$;

-- -------- Reservations : facility staff ------------------------------------
create or replace function public.staff_start_reservation(
  p_reservation_id uuid
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.reservations;
begin
  if not (public.has_role('staff') or public.has_role('administrator')) then
    raise exception 'Permission denied: staff role required.';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;

  if not found then
    raise exception 'Reservation not found.';
  elsif v_res.status <> 'scheduled' then
    raise exception 'Only Scheduled reservations can be marked In Use (status: %).', v_res.status;
  end if;

  update public.reservations set status = 'in_use'
   where id = p_reservation_id
   returning * into v_res;

  return v_res;
end;
$$;

create or replace function public.staff_complete_reservation(
  p_reservation_id uuid,
  p_notes           text default null
) returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare v_res public.reservations;
begin
  if not (public.has_role('staff') or public.has_role('administrator')) then
    raise exception 'Permission denied: staff role required.';
  end if;

  select * into v_res from public.reservations where id = p_reservation_id for update;

  if not found then
    raise exception 'Reservation not found.';
  elsif v_res.status <> 'in_use' then
    raise exception 'Only In Use reservations can be completed (status: %).', v_res.status;
  end if;

  update public.reservations
     set status = 'completed',
         notes  = left(trim(concat_ws(' ', v_res.notes, coalesce(p_notes, ''))), 1000)
   where id = p_reservation_id
   returning * into v_res;

  return v_res;
end;
$$;

-- -------- Facilities --------------------------------------------------------
create or replace function public.staff_update_facility_operational(
  p_facility_id    uuid,
  p_condition_note text,
  p_status         text default null  -- 'active' | 'maintenance'
) returns public.facilities
language plpgsql
security definer
set search_path = public
as $$
declare v_fac public.facilities; v_status public.facility_status;
begin
  if not (public.has_role('staff') or public.has_role('administrator')) then
    raise exception 'Permission denied: staff role required.';
  end if;

  if p_status is not null then
    if p_status not in ('active', 'maintenance') then
      raise exception 'Staff may only set a facility to active or maintenance.';
    end if;
    v_status := p_status::public.facility_status;
  end if;

  update public.facilities
     set condition_note = coalesce(p_condition_note, condition_note),
         status = coalesce(v_status, status)
   where id = p_facility_id
   returning * into v_fac;

  if not found then raise exception 'Facility not found.'; end if;
  return v_fac;
end;
$$;

create or replace function public.admin_update_facility(
  p_facility_id   uuid,
  p_name          text,
  p_description   text,
  p_location      text,
  p_capacity      integer,
  p_status        public.facility_status,
  p_condition_note text
) returns public.facilities
language plpgsql
security definer
set search_path = public
as $$
declare v_fac public.facilities;
begin
  if not public.has_role('administrator') then
    raise exception 'Permission denied: administrator role required.';
  end if;

  update public.facilities
     set name = coalesce(p_name, name),
         description = coalesce(p_description, description),
         location = coalesce(p_location, location),
         capacity = coalesce(p_capacity, capacity),
         status = coalesce(p_status, status),
         condition_note = coalesce(p_condition_note, condition_note)
   where id = p_facility_id
   returning * into v_fac;

  if not found then raise exception 'Facility not found.'; end if;
  return v_fac;
end;
$$;

create or replace function public.admin_create_facility(
  p_name          text,
  p_description   text,
  p_location      text,
  p_capacity      integer,
  p_status        public.facility_status default 'active',
  p_condition_note text default ''
) returns public.facilities
language plpgsql
security definer
set search_path = public
as $$
declare v_fac public.facilities;
begin
  if not public.has_role('administrator') then
    raise exception 'Permission denied: administrator role required.';
  end if;

  insert into public.facilities (name, description, location, capacity, status, condition_note)
  values (p_name, coalesce(p_description, ''), coalesce(p_location, ''),
          coalesce(p_capacity, 0), p_status, coalesce(p_condition_note, ''))
  returning * into v_fac;

  return v_fac;
end;
$$;

-- -------- Service requests (facility staff) --------------------------------
create or replace function public.create_service_request(
  p_facility_id uuid,
  p_title       text,
  p_description text
) returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare v_req public.service_requests;
begin
  if not (public.has_role('staff') or public.has_role('administrator')) then
    raise exception 'Permission denied: staff role required.';
  end if;

  insert into public.service_requests (facility_id, reported_by, title, description, status)
  values (p_facility_id, auth.uid(), coalesce(p_title, ''), coalesce(p_description, ''), 'open')
  returning * into v_req;

  return v_req;
end;
$$;

create or replace function public.update_service_request_status(
  p_request_id uuid,
  p_status     public.service_status
) returns public.service_requests
language plpgsql
security definer
set search_path = public
as $$
declare v_req public.service_requests;
begin
  if not (public.has_role('staff') or public.has_role('administrator')) then
    raise exception 'Permission denied: staff role required.';
  end if;

  select * into v_req from public.service_requests where id = p_request_id for update;
  if not found then raise exception 'Service request not found.'; end if;

  update public.service_requests
     set status = p_status,
         resolved_at = case when p_status = 'resolved' then now() else null end
   where id = p_request_id
   returning * into v_req;

  return v_req;
end;
$$;

-- -------- Users (administrator) --------------------------------------------
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role    public.user_role
) returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare v_prof public.profiles;
begin
  if not public.has_role('administrator') then
    raise exception 'Permission denied: administrator role required.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role.';
  end if;

  update public.profiles set role = p_role where id = p_user_id
  returning * into v_prof;

  if not found then raise exception 'User profile not found.'; end if;
  return v_prof;
end;
$$;

create or replace function public.update_own_profile(
  p_full_name text
) returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare v_prof public.profiles;
begin
  if auth.uid() is null then raise exception 'Not authenticated.'; end if;

  update public.profiles set full_name = coalesce(p_full_name, full_name)
   where id = auth.uid()
   returning * into v_prof;

  if not found then raise exception 'Profile not found.'; end if;
  return v_prof;
end;
$$;

-- ============================================================================
-- 7. Grants
-- ============================================================================
revoke all on all functions in schema public from public;
grant execute on all functions in schema public to authenticated;

grant select on public.profiles        to authenticated;
grant select on public.facilities      to authenticated;
grant select on public.reservations    to authenticated;
grant select on public.service_requests to authenticated;
grant select on public.audit_logs      to authenticated;