// ============================================================================
//  Pages - role-based screens rendered into #app-root by the router
//  Each loader is async: fetches data, renders HTML, wires inline handlers.
// ============================================================================
(function () {
  "use strict";

  const role = () => window.DB.role();
  const is = (r) => role() === r;
  const oops = (e, fallback) => {
    console.error(e);
    return `<div class="card config-card"><h2>Something went wrong</h2><pre>${UI.esc(
      (e && (e.message || String(e))) || fallback || ""
    )}</pre></div>`;
  };

  const RES_COLS = ["Facility", "Title", "Requester", "Start", "End", "Status", "Actions"];

  function resActions(r) {
    const parts = [];
    if (is("requester")) {
      if (r.status === "pending") {
        parts.push(`<button class="btn btn-sm" onclick="App.editReservation('${r.id}')">Edit</button>`);
        parts.push(`<button class="btn btn-sm btn-ghost" onclick="App.cancelReservation('${r.id}')">Cancel</button>`);
      } else if (r.status === "approved") {
        parts.push(`<button class="btn btn-sm btn-ghost" onclick="App.cancelReservation('${r.id}')">Cancel</button>`);
      }
    }
    if (role() === "administrator") {
      if (r.status === "pending") {
        parts.push(`<button class="btn btn-sm btn-ok" onclick="App.approveReservation('${r.id}')">Approve</button>`);
        parts.push(`<button class="btn btn-sm btn-primary" onclick="App.approveAndSchedule('${r.id}')">Approve &amp; Schedule</button>`);
        parts.push(`<button class="btn btn-sm btn-danger" onclick="App.notesModal('reject','${r.id}')">Reject</button>`);
        parts.push(`<button class="btn btn-sm btn-ghost" onclick="App.adminCancel('${r.id}')">Cancel</button>`);
      } else if (r.status === "approved") {
        parts.push(`<button class="btn btn-sm btn-primary" onclick="App.scheduleReservation('${r.id}')">Schedule</button>`);
        parts.push(`<button class="btn btn-sm btn-ghost" onclick="App.adminCancel('${r.id}')">Cancel</button>`);
      }
    }
    if (is("staff") || role() === "administrator") {
      if (r.status === "scheduled") {
        parts.push(`<button class="btn btn-sm btn-ok" onclick="App.startReservation('${r.id}')">Mark In Use</button>`);
      } else if (r.status === "in_use") {
        parts.push(`<button class="btn btn-sm btn-primary" onclick="App.notesModal('complete','${r.id}')">Record Complete</button>`);
      }
    }
    return parts.join(" ") || "—";
  }

  function reservationsTable(rows, showRequester) {
    if (!rows.length) return UI.empty("No reservations match.");
    const head = `<tr>${RES_COLS.map((c) => `<th>${c}</th>`).join("")}</tr>`;
    const body = rows
      .map(
        (r) => `<tr>
          <td>${UI.esc(r.facility ? r.facility.name : "—")}</td>
          <td>${UI.esc(r.title)}</td>
          <td>${showRequester && r.requester ? UI.esc(r.requester.full_name) : "—"}</td>
          <td>${UI.dt(r.start_time)}</td>
          <td>${UI.dt(r.end_time)}</td>
          <td>${UI.badge(r.status)}</td>
          <td>${resActions(r)}</td>
        </tr>`
      )
      .join("");
    return `<div class="card"><div class="table-wrap"><table class="table"><thead>${head}</thead><tbody>${body}</tbody></table></div></div>`;
  }

  // ==========================================================================
  //  LOGIN / REGISTER (no session)
  // ==========================================================================
  function authShell() {
    return `
      <div class="auth-wrap">
        <div class="auth-card card">
          <div class="auth-brand">
            <span class="brand-mark">FR</span>
            <h1>Facility Reservation &amp; Approval</h1>
            <p>Role-based facility booking. Administrator, Staff and Requester roles.</p>
          </div>
          <div class="auth-tabs">
            <button class="auth-tab active" id="tab-login" onclick="App.authTab('login')">Sign in</button>
            <button class="auth-tab" id="tab-register" onclick="App.authTab('register')">Register</button>
          </div>
          <div id="auth-body"></div>
        </div>
      </div>`;
  }

  function loginForm() {
    return `
      <form onsubmit="App.submitLogin(event)" class="form">
        <label>Email
          <input type="email" id="login-email" required placeholder="requester@example.com">
        </label>
        <label>Password
          <input type="password" id="login-password" required placeholder="password123">
        </label>
        <button type="submit" class="btn btn-primary btn-block">Sign in</button>
      </form>
      <p class="hint">Demo accounts (from seed.sql): admin / staff / requester<code>@example.com</code> — password <code>password123</code></p>`;
  }

  function registerForm() {
    return `
      <form onsubmit="App.submitRegister(event)" class="form">
        <label>Full name
          <input type="text" id="reg-name" required placeholder="Jane Doe">
        </label>
        <label>Email
          <input type="email" id="reg-email" required placeholder="you@example.com">
        </label>
        <label>Password
          <input type="password" id="reg-password" required minlength="6" placeholder="min 6 characters">
        </label>
        <button type="submit" class="btn btn-primary btn-block">Create account</button>
      </form>
      <p class="hint">New accounts are created with the <b>Requester</b> role. An administrator can promote users later.</p>`;
  }

  // ==========================================================================
  //  DASHBOARD
  // ==========================================================================
  async function dashboard() {
    const me = window.Auth.state.profile;
    if (!me) return oops("Profile not loaded.");

    const greeting = `
      <div class="card hero-card">
        <div>
          <h2>Welcome, ${UI.esc(me.full_name || me.email)}</h2>
          <p>Signed in as ${UI.esc(me.email)}</p>
        </div>
        ${UI.badge(me.role)}
      </div>`;

    if (role() === "administrator") {
      const { data: res } = await DB.allReservations();
      const { data: logs } = await DB.auditLogs(8);
      const { data: svc } = await DB.serviceRequests();

      const pending = (res || []).filter((r) => r.status === "pending");
      const toSchedule = (res || []).filter((r) => r.status === "approved");
      const open = (svc || []).filter((s) => s.status === "open");

      return UI.layout(
        "Administrator Dashboard",
        "Manage facilities, users, approvals, reports and audit logs.",
        `<button class="btn" onclick="App.go('approvals')">Review approvals</button>`,
        greeting +
          statCards([
            ["Pending approval", pending.length, "badge-pending", "alert", "c-warn"],
            ["Awaiting scheduling", toSchedule.length, "badge-approved", "clock", "c-ok"],
            ["Active reservations", (res || []).filter((r) => ["scheduled", "in_use"].includes(r.status)).length, "badge-inuse", "trend", "c-info"],
            ["Open service requests", open.length, "badge-maintenance", "wrench", "c-danger"]
          ]) +
          `<div class="grid-2">
            <div class="card">
              <h3>Approval queue</h3>
              ${pending.length ? pending.slice(0, 5).map((r) => `<div class="row-line"><span>${UI.esc(r.title)} · ${UI.esc(r.facility ? r.facility.name : "")}</span>${UI.badge(r.status)}</div>`).join("") : UI.empty("No pending requests.")}
            </div>
            <div class="card">
              <h3>Recent activity</h3>
              ${logs && logs.length ? logs.slice(0, 6).map((l) => `<div class="row-line"><span>${UI.humanize(l.action)}</span><span class="muted small">${UI.dt(l.created_at)}</span></div>`).join("") : UI.empty("No activity yet.")}
            </div>
          </div>`
      );
    }

    if (role() === "staff") {
      const { data: res } = await DB.allReservations();
      const { data: svc } = await DB.serviceRequests();
      const { data: fac } = await DB.facilities();

      const today = new Date().toDateString();
      const inUse = (res || []).filter((r) => r.status === "in_use");
      const todaySched = (res || []).filter(
        (r) => r.status === "scheduled" && new Date(r.start_time).toDateString() === today
      );
      const open = (svc || []).filter((s) => s.status === "open");

      return UI.layout(
        "Staff Dashboard",
        "Confirm facility usage, record completion and manage service concerns.",
        `<button class="btn" onclick="App.go('services')">New service request</button>`,
        greeting +
          statCards([
            ["Scheduled today", todaySched.length, "badge-scheduled", "clock", "c-primary"],
            ["Facilities in use", inUse.length, "badge-inuse", "trend", "c-info"],
            ["Open service requests", open.length, "badge-maintenance", "wrench", "c-warn"],
            ["Active facilities", (fac || []).filter((f) => f.status === "active").length, "badge-active", "building", "c-ok"]
          ]) +
          `<div class="card">
            <h3>Reservations to attend today</h3>
            ${todaySched.length ? reservationsTable(todaySched, true) : UI.empty("No scheduled reservations today.")}
          </div>`
      );
    }

    // requester
    const { data: res } = await DB.myReservations();
    const mine = res || [];
    const upcoming = mine.filter((r) => ["approved", "scheduled"].includes(r.status));
    const pending = mine.filter((r) => r.status === "pending");

    return UI.layout(
      "Requester Dashboard",
      "Browse facilities, submit reservations and track their status.",
      `<button class="btn btn-primary" onclick="App.go('facilities')">Book a facility</button>`,
      greeting +
        statCards([
          ["My reservations", mine.length, "badge-active", "calendar", "c-primary"],
          ["Pending approval", pending.length, "badge-pending", "alert", "c-warn"],
          ["Upcoming (approved/scheduled)", upcoming.length, "badge-approved", "trend", "c-ok"],
          ["Completed", mine.filter((r) => r.status === "completed").length, "badge-completed", "check", "c-info"]
        ]) +
        `<div class="card">
          <h3>My recent reservations</h3>
          ${mine.length ? reservationsTable(mine.slice(0, 5), false) : UI.empty("You have not submitted any reservations yet.")}
        </div>`
    );
  }

  function statCards(items) {
    return `<div class="stat-grid">${items
      .map(([k, v, cls, icon, acc]) => `<div class="card stat-card">
        <div class="stat-ico ${acc || "c-primary"}">${(window.APP_ICONS && window.APP_ICONS[icon]) || ""}</div>
        <div><div class="stat-value ${cls}">${v}</div><div class="stat-label">${k}</div></div>
      </div>`)
      .join("")}</div>`;
  }

  // ==========================================================================
  //  FACILITIES
  // ==========================================================================
  async function facilities() {
    const { data: fac, error } = await DB.facilities();
    if (error) return oops(error);

    const admin = role() === "administrator";
    const staff = is("staff");

    const cards = fac.length ? fac.map((f) => `
      <div class="card facility-card">
        <div class="facility-top">
          <h3>${UI.esc(f.name)}</h3>
          ${UI.badge(f.status)}
        </div>
        <div class="meta-row">
          <span class="chip">${window.APP_ICONS.pin} ${UI.esc(f.location)}</span>
          <span class="chip">${window.APP_ICONS.users} ${f.capacity}</span>
          ${f.condition_note ? `<span class="chip chip-warn">${window.APP_ICONS.alert} ${UI.esc(f.condition_note)}</span>` : ""}
        </div>
        <p class="fac-desc">${UI.esc(f.description)}</p>
        <div class="facility-actions">
          ${f.status === "active" ? `<button class="btn btn-sm btn-primary" onclick="App.bookingModal('${f.id}','${UI.esc(f.name)}')">Reserve</button>` : `<button class="btn btn-sm" disabled title="BR-B4-08">Not reservable</button>`}
          ${staff || admin ? `<button class="btn btn-sm" onclick="App.conditionModal('${f.id}','${UI.esc(f.name)}','${UI.esc(f.condition_note)}')">Update condition</button>` : ""}
          ${admin ? `<button class="btn btn-sm btn-ghost" onclick="App.editFacility('${f.id}')">Edit</button>` : ""}
        </div>
      </div>`).join("") : UI.empty("No facilities yet.");

    return UI.layout(
      "Facilities",
      "Only facilities with status <b>Active</b> can be reserved (BR-B4-01 / BR-B4-08).",
      admin ? `<button class="btn btn-primary" onclick="App.newFacility()">New facility</button>` : "",
      `<div class="card-grid">${cards}</div>`
    );
  }

  // ==========================================================================
  //  RESERVATIONS
  // ==========================================================================
  async function reservations() {
    const admin = role() === "administrator";
    const staff = is("staff");
    const req = is("requester");

    let rows = [];
    if (req) {
      const { data } = await DB.myReservations();
      rows = data || [];
    } else {
      const { data } = await DB.allReservations();
      rows = data || [];
    }
    window.__resRows = rows;

    const statusFilter = `<input type="search" id="res-filter" class="input input-inline" placeholder="Filter by status…" oninput="App.filterReservations(this.value)">`;

    return UI.layout(
      req ? "My Reservations" : "Reservations",
      req
        ? "Submit requests, monitor approval and cancel eligible requests."
        : "All reservation requests across the organization.",
      req ? `<button class="btn btn-primary" onclick="App.go('facilities')">New reservation</button>` : statusFilter,
      `<div id="res-table">${reservationsTable(rows, !req)}</div>`
    );
  }

  // ==========================================================================
  //  APPROVALS (administrator only)
  // ==========================================================================
  async function approvals() {
    if (!is("administrator")) return UI.empty("Access denied.");
    const { data } = await DB.allReservations();
    const rows = data || [];
    const pending = rows.filter((r) => r.status === "pending");
    const toSchedule = rows.filter((r) => r.status === "approved");

    const block = (rows, extra) =>
      rows.length ? reservationsTable(rows, true) + (extra || "") : UI.empty("Nothing here.");

    return UI.layout(
      "Reservation Approvals",
      "Only the Administrator may approve or reject requests (BR-B4-04).",
      "",
      `<div class="section-title"><h3>Pending approval</h3></div>
       ${block(pending, "")}
       <div class="section-title" style="margin-top:24px"><h3>Approved — awaiting scheduling</h3></div>
       ${block(toSchedule, "")}`
    );
  }

  // ==========================================================================
  //  SERVICE REQUESTS (staff / administrator)
  // ==========================================================================
  async function services() {
    if (!is("staff") && !is("administrator")) return UI.empty("Access denied.");
    const { data, error } = await DB.serviceRequests();
    if (error) return oops(error);
    const rows = data || [];

    const body = rows.length
      ? `<div class="card"><div class="table-wrap"><table class="table">
          <thead><tr><th>Facility</th><th>Title</th><th>Description</th><th>Reported by</th><th>Status</th><th>Update</th></tr></thead>
          <tbody>${rows.map((s) => `
            <tr>
              <td>${UI.esc(s.facility ? s.facility.name : "—")}</td>
              <td>${UI.esc(s.title)}</td>
              <td>${UI.esc(s.description)}</td>
              <td>${UI.esc(s.reporter ? s.reporter.full_name : "—")}</td>
              <td>${UI.badge(s.status)}</td>
              <td>
                <select class="input input-sm" onchange="App.updateServiceStatus('${s.id}', this.value)">
                  ${["open", "in_progress", "resolved"].map((st) => `<option value="${st}" ${s.status === st ? "selected" : ""}>${UI.label(st)}</option>`).join("")}
                </select>
              </td>
            </tr>`).join("")}
          </tbody></table></div></div>`
      : UI.empty("No service requests.");

    return UI.layout(
      "Service Requests",
      "Facility staff report facility concerns and track resolution.",
      `<button class="btn btn-primary" onclick="App.newServiceRequest()">New service request</button>`,
      body
    );
  }

  // ==========================================================================
  //  AUDIT LOGS (administrator only)
  // ==========================================================================
  async function audit() {
    if (!is("administrator")) return UI.empty("Access denied.");
    const { data, error } = await DB.auditLogs(400);
    if (error) return oops(error);
    window.__audit = data || [];

    const filter = `<select class="input input-sm" onchange="App.renderAudit(this.value)">
      <option value="">All actions</option>
      <option value="reservation_">Reservations</option>
      <option value="facility_">Facilities</option>
      <option value="service_request">Service requests</option>
      <option value="user_">Users</option>
    </select>`;

    return UI.layout(
      "Audit Log",
      "Immutable trail of critical actions (BR-B4-10). Captured automatically by database triggers.",
      filter,
      `<div id="audit-table"></div>`
    );
  }

  // ==========================================================================
  //  REPORTS (administrator only)
  // ==========================================================================
  async function reports() {
    if (!is("administrator")) return UI.empty("Access denied.");
    const { data: res } = await DB.allReservations();
    const { data: svc } = await DB.serviceRequests();
    const { data: fac } = await DB.facilities();

    const rows = res || [];
    const statusCounts = {};
    for (const r of rows) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;

    const statusRows = ["pending", "approved", "rejected", "scheduled", "in_use", "completed", "cancelled"]
      .map((s) => `<tr><td>${UI.label(s)}</td><td>${statusCounts[s] || 0}</td></tr>`)
      .join("");

    const byFacility = (fac || []).map((f) => {
      const fr = rows.filter((r) => r.facility_id === f.id);
      const hrs = fr.reduce((acc, r) => acc + (new Date(r.end_time) - new Date(r.start_time)) / 36e5, 0);
      return `<tr><td>${UI.esc(f.name)}</td><td>${fr.length}</td><td>${hrs.toFixed(1)}</td></tr>`;
    }).join("");

    const svcOpen = (svc || []).filter((s) => s.status !== "resolved").length;

    return UI.layout(
      "Reports",
      "Reservation activity and facility utilisation.",
      "",
      statCards([
        ["Total reservations", rows.length, "badge-active", "calendar", "c-primary"],
        ["Approval rate", rows.length ? `${Math.round(((statusCounts.approved || 0) + (statusCounts.scheduled || 0) + (statusCounts.in_use || 0) + (statusCounts.completed || 0)) / rows.length * 100)}%` : "—", "badge-approved", "check", "c-ok"],
        ["Cancelled", statusCounts.cancelled || 0, "badge-cancelled", "alert", "c-danger"],
        ["Open service concerns", svcOpen, "badge-maintenance", "wrench", "c-warn"]
      ]) +
      `<div class="grid-2">
        <div class="card"><h3>Reservations by status</h3>
          <div class="table-wrap"><table class="table"><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>${statusRows}</tbody></table></div>
        </div>
        <div class="card"><h3>Utilisation by facility</h3>
          <div class="table-wrap"><table class="table"><thead><tr><th>Facility</th><th>Requests</th><th>Hours booked</th></tr></thead><tbody>${byFacility}</tbody></table></div>
        </div>
      </div>`);
  }

  // ==========================================================================
  //  USERS (administrator only)
  // ==========================================================================
  async function users() {
    if (!is("administrator")) return UI.empty("Access denied.");
    const { data, error } = await DB.profiles();
    if (error) return oops(error);

    const body = (data || []).length
      ? `<div class="card"><div class="table-wrap"><table class="table">
          <thead><tr><th>Email</th><th>Full name</th><th>Role</th><th>Joined</th><th>Action</th></tr></thead>
          <tbody>${(data || []).map((u) => `
            <tr>
              <td>${UI.esc(u.email)}</td>
              <td>${UI.esc(u.full_name)}</td>
              <td>${UI.badge(u.role)}</td>
              <td>${UI.dt(u.created_at)}</td>
              <td>
                <select class="input input-sm" ${u.id === window.Auth.state.session.user.id ? "disabled" : ""}>
                  ${["requester", "staff", "administrator"].map((r) => `<option value="${r}" ${u.role === r ? "selected" : ""}>${UI.label(r)}</option>`).join("")}
                </select>
                <button class="btn btn-sm" ${u.id === window.Auth.state.session.user.id ? "disabled" : ""} onclick="App.changeUserRole('${u.id}', this.previousElementSibling.value)">Save</button>
              </td>
            </tr>`).join("")}
          </tbody></table></div></div>`
      : UI.empty("No users.");

    return UI.layout("User Management", "Assign roles: Requester, Facility Staff or Administrator.", "", body);
  }

  // ==========================================================================
  //  Register everything
  // ==========================================================================
  window.Pages = {
    login() {
      UI.setContent(authShell());
      document.getElementById("auth-body").innerHTML = loginForm();
    },
    register() {
      UI.setContent(authShell());
      document.getElementById("auth-body").innerHTML = registerForm();
    },
    dashboard,
    facilities,
    reservations,
    approvals,
    services,
    audit,
    reports,
    users
  };

  window.__resRows = [];
  window.App = window.App || {};
  window.App.renderAudit = function (filter) {
    const rows = (window.__audit || []).filter(
      (l) => !filter || l.action.indexOf(filter) === 0
    );
    const html = rows.length
      ? `<div class="card"><div class="table-wrap"><table class="table">
          <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th><th>Details</th></tr></thead>
          <tbody>${rows.map((l) => `
            <tr>
              <td>${UI.dt(l.created_at)}</td>
              <td>${UI.esc(l.user ? l.user.email : "system")}</td>
              <td>${UI.esc(UI.humanize(l.action))}</td>
              <td>${UI.esc(l.entity_type)}</td>
              <td class="small mono">${UI.esc((l.entity_id || "").slice(0, 8))}</td>
              <td><details class="audit-details"><summary>view</summary><pre>${UI.esc(JSON.stringify(l.details, null, 2))}</pre></details></td>
            </tr>`).join("")}
          </tbody></table></div></div>`
      : UI.empty("No log entries.");
    const el = document.getElementById("audit-table");
    if (el) el.innerHTML = html;
  };
  window.App.filterReservations = function (val) {
    const q = (val || "").trim().toLowerCase();
    const el = document.getElementById("res-table");
    if (!el) return;
    const rows = q ? (window.__resRows || []).filter((r) => (r.status || "").indexOf(q) === 0) : window.__resRows;
    el.innerHTML = reservationsTable(rows, true);
  };
})();