// ============================================================================
//  App - router, application shell and all business actions
// ============================================================================
(function () {
  "use strict";

  const NAV = {
    requester: [["dashboard", "Dashboard"], ["facilities", "Facilities"], ["reservations", "My Reservations"]],
    staff: [["dashboard", "Dashboard"], ["facilities", "Facilities"], ["reservations", "Reservations"], ["services", "Service Requests"]],
    administrator: [["dashboard", "Dashboard"], ["facilities", "Facilities"], ["reservations", "Reservations"], ["approvals", "Approvals"], ["services", "Service Requests"], ["audit", "Audit Logs"], ["reports", "Reports"], ["users", "Users"]]
  };

  const PROTECTED = ["dashboard", "facilities", "reservations", "approvals", "services", "audit", "reports", "users"];
  const ROLE_ONLY = { approvals: "administrator", audit: "administrator", reports: "administrator", users: "administrator", services: "staff" };

  // ---- inline icon set (feather-style strokes) -----------------------------
  const S = (p) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

  window.APP_ICONS = {
    dashboard: S('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
    facilities: S('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/><path d="M2 21h20"/>'),
    reservations: S('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/><path d="M9 15l2 2 4-4"/>'),
    approvals: S('<path d="M12 2l2.4 1.8 2.9-.4 1 2.8 2.6 1.4-.6 2.9L21 12l-.6 2.9.6 2.9-2.6 1.4-1 2.8-2.9-.4L12 22l-2.4-1.8-2.9.4-1-2.8-2.6-1.4.6-2.9L3 12l.6-2.9-.6-2.9 2.6-1.4 1-2.8 2.9.4z"/><path d="M9 12l2 2 4-4"/>'),
    services: S('<path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.6L3 17.6V21h3.4l5.7-5.7a4.5 4.5 0 0 0 5.6-6L14.4 11l-1.4-1.4 2.7-3.3z"/><path d="M14 14l6-6M17 5l2 2"/>'),
    audit: S('<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>'),
    reports: S('<path d="M3 3v18h18"/><path d="M7 15l4-6 3 3 5-8"/>'),
    users: S('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    logout: S('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
    clock: S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    check: S('<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4L12 14l-3-3"/>'),
    alert: S('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
    trend: S('<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>'),
    sparkle: S('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>'),
    pin: S('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
    calendar: S('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>'),
    building: S('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>'),
    wrench: S('<path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.6L3 17.6V21h3.4l5.7-5.7a4.5 4.5 0 0 0 5.6-6L14.4 11l-1.4-1.4 2.7-3.3z"/>')
  };

  window.App = Object.assign({}, window.App || {}, {
    currentRoute: "dashboard",

    // ------------------------------------------------------------------ auth
    authTab(tab) {
      const loginTab = document.getElementById("tab-login");
      const regTab = document.getElementById("tab-register");
      if (!loginTab) return;
      const body = document.getElementById("auth-body");
      if (tab === "login") {
        loginTab.classList.add("active");
        regTab.classList.remove("active");
        body.innerHTML = "";
        body.innerHTML = Pages.__loginForm();
      } else {
        regTab.classList.add("active");
        loginTab.classList.remove("active");
        body.innerHTML = Pages.__registerForm();
      }
    },

    async submitLogin(ev) {
      ev.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;
      const btn = ev.target.querySelector("button");
      btn.disabled = true;
      btn.textContent = "Signing in…";
      try {
        const { error } = await window.Auth.signIn(email, password);
        if (error) {
          UI.toast(error.message || "Invalid credentials.", "error");
          btn.disabled = false;
          btn.textContent = "Sign in";
          return;
        }
        location.hash = "#/dashboard";
      } catch (e) {
        UI.toast(App.msg(e), "error");
        btn.disabled = false;
        btn.textContent = "Sign in";
      }
    },

    async submitRegister(ev) {
      ev.preventDefault();
      const name = document.getElementById("reg-name").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const password = document.getElementById("reg-password").value;
      const btn = ev.target.querySelector("button");
      btn.disabled = true;
      btn.textContent = "Creating account…";
      try {
        const { data, error } = await window.Auth.signUp(email, password, name);
        if (error) {
          UI.toast(error.message || "Sign up failed.", "error");
          btn.disabled = false;
          btn.textContent = "Create account";
          return;
        }
        if (data.session) {
          location.hash = "#/dashboard";
          UI.toast(`Welcome, ${name || email}!`);
        } else {
          UI.toast("Account created. Confirm your email, then sign in.", "success");
          App.authTab("login");
          document.getElementById("login-email").value = email;
        }
      } catch (e) {
        UI.toast(App.msg(e), "error");
        btn.disabled = false;
        btn.textContent = "Create account";
      }
    },

    async signOut() {
      await window.Auth.signOut();
      location.hash = "#/login";
    },

    // ------------------------------------------------------------ navigation
    go(route) {
      location.hash = "#/" + route;
    },

    authTabNavigate(route) {
      if (route === "login" || route === "register") {
        if (window.Auth.state.session) return "dashboard";
        return route;
      }
      if (!window.Auth.state.session) return "login";
      if (ROLE_ONLY[route]) {
        if (window.DB.role() !== ROLE_ONLY[route] && !(ROLE_ONLY[route] === "staff" && window.DB.role() === "administrator")) {
          return "dashboard";
        }
      }
      return route;
    },

    async loadRoute(route) {
      route = App.authTabNavigate(route);
      App.currentRoute = route;

      // Auth screens are rendered standalone (no application shell).
      if (route === "login" || route === "register") {
        document.getElementById("app-root").innerHTML = "";
        if (typeof window.Pages[route] === "function") await window.Pages[route]();
        return;
      }

      App.shell();
      const loader = window.Pages[route];
      if (typeof loader !== "function") return App.loadRoute("dashboard");
      try {
        await loader();
      } catch (e) {
        if (e && e.configMissing) {
          UI.setContent(UI.configCard(e.message));
        } else {
          console.error(e);
          UI.setContent(
            `<div class="card config-card"><h2>Request failed</h2><pre>${UI.esc(App.msg(e))}</pre></div>`
          );
        }
      }
      if (route === "audit") window.App.renderAudit("");
      App.paintNav(route);
    },

    paintNav(active) {
      document.querySelectorAll(".nav-link").forEach((a) => {
        a.classList.toggle("active", a.getAttribute("data-route") === active);
      });
    },

    // ------------------------------------------------------------------ shell
    async boot() {
      await window.Auth.init();
      if (window.Auth.state.error && window.Auth.state.error.configMissing) {
        UI.setContent(UI.configCard(window.Auth.state.error.message));
        return;
      }
      const onRoute = () => App.loadRoute((location.hash || "#/dashboard").replace(/^#\//, ""));
      window.addEventListener("hashchange", onRoute);
      onRoute();
    },

    shell(route) {
      const p = window.Auth.state.profile;
      const roleName = p ? p.role : "guest";
      const links = (NAV[roleName] || []).map(
        ([r, label]) => `<a class="nav-link" data-route="${r}" href="#/${r}">
          <span class="nav-ico">${window.APP_ICONS[r] || ""}</span>
          <span class="nav-label">${label}</span>
        </a>`
      ).join("");

      document.getElementById("app-root").innerHTML = `
        <div class="shell">
          <aside class="sidebar">
            <div class="brand">
              <span class="brand-mark">FR</span>
              <span><b>Facility</b><br>Reservation System</span>
            </div>
            <nav class="nav">${links}</nav>
            <div class="side-foot">
              <div class="side-user">
                <div class="avatar">${p ? UI.esc((p.full_name || p.email || "?")[0].toUpperCase()) : "?"}</div>
                <div>
                  <b>${p ? UI.esc(p.full_name || "User") : "Guest"}</b>
                  ${p ? UI.badge(p.role) : ""}
                </div>
              </div>
              <button class="btn btn-ghost btn-block btn-sm" onclick="App.signOut()">${window.APP_ICONS.logout} <span>Sign out</span></button>
            </div>
          </aside>
          <main class="main">
            <div class="page" id="page-root"></div>
          </main>
        </div>`;
    },

    // ------------------------------------------------------------- error msg
    msg(e) {
      let m = (e && e.message) || String(e || "Unknown error");
      m = m.replace(/^.*?"message"\s*:\s*"/, "").replace(/".*$/, "");
      return m.slice(0, 300);
    }
  });

  // ==========================================================================
  //  Reservation workflows
  // ==========================================================================
  window.App.bookingModal = async function (facId, facName) {
    const { data: fac } = await DB.facilities();
    const opts = (fac || [])
      .map(
        (f) => `<option value="${f.id}" ${f.id === facId ? "selected" : ""} ${f.status !== "active" ? "disabled" : ""}>${UI.esc(f.name)}${f.status !== "active" ? " (not reservable)" : ""}</option>`
      )
      .join("");
    const start = new Date(Date.now() + 3600e3);
    const end = new Date(Date.now() + 7200e3);
    UI.modal(
      "New reservation",
      `<form onsubmit="event.preventDefault();App.submitBooking()">
        <label>Facility
          <select id="booking-facility" class="input">${opts}</select>
        </label>
        <label>Title
          <input id="booking-title" class="input" required placeholder="e.g. Guest lecture">
        </label>
        <label>Purpose
          <textarea id="booking-purpose" class="input" rows="3" placeholder="Reason for requesting the facility"></textarea>
        </label>
        <label class="grid-2">
          <span>Start <input type="datetime-local" id="booking-start" class="input" value="${UI.dateInputValue(start)}" required></span>
          <span>End <input type="datetime-local" id="booking-end" class="input" value="${UI.dateInputValue(end)}" required></span>
        </label>
      </form>`,
      `<button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="App.submitBooking()">Submit request</button>`
    );
  };

  window.App.submitBooking = async function () {
    const facility_id = document.getElementById("booking-facility").value;
    const title = document.getElementById("booking-title").value.trim();
    const purpose = document.getElementById("booking-purpose").value.trim();
    const start = new Date(document.getElementById("booking-start").value);
    const end = new Date(document.getElementById("booking-end").value);
    if (!(start && end)) return UI.toast("Both times are required.", "error");

    try {
      const { data, error } = await DB.rpc("create_reservation", {
        p_facility_id: facility_id,
        p_title: title,
        p_purpose: purpose,
        p_start_time: start.toISOString(),
        p_end_time: end.toISOString()
      });
      if (error) return UI.toast(App.msg(error), "error");
      UI.closeModal();
      UI.toast("Reservation submitted — status is Pending (TC-B4-01).", "success");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  window.App.editReservation = async function (id) {
    const rows = window.__resRows || [];
    const r = rows.find((x) => x.id === id);
    if (!r) return UI.toast("Reservation not found.", "error");
    const { data: fac } = await DB.facilities();
    const opts = (fac || [])
      .map((f) => `<option value="${f.id}" ${f.id === r.facility_id ? "selected" : ""}>${UI.esc(f.name)}</option>`)
      .join("");
    UI.modal(
      "Edit pending reservation",
      `<form onsubmit="event.preventDefault();App.saveEditReservation('${id}')">
        <label>Facility<select id="edit-facility" class="input">${opts}</select></label>
        <label>Title<input id="edit-title" class="input" required value="${UI.esc(r.title)}"></label>
        <label>Purpose<textarea id="edit-purpose" class="input" rows="3">${UI.esc(r.purpose)}</textarea></label>
        <label class="grid-2">
          <span>Start <input type="datetime-local" id="edit-start" class="input" required value="${UI.dateInputValue(r.start_time)}"></span>
          <span>End <input type="datetime-local" id="edit-end" class="input" required value="${UI.dateInputValue(r.end_time)}"></span>
        </label>
      </form>`,
      `<button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="App.saveEditReservation('${id}')">Save changes</button>`
    );
  };

  window.App.saveEditReservation = async function (id) {
    try {
      const { error } = await DB.rpc("update_pending_reservation", {
        p_reservation_id: id,
        p_facility_id: document.getElementById("edit-facility").value,
        p_title: document.getElementById("edit-title").value.trim(),
        p_purpose: document.getElementById("edit-purpose").value.trim(),
        p_start_time: new Date(document.getElementById("edit-start").value).toISOString(),
        p_end_time: new Date(document.getElementById("edit-end").value).toISOString()
      });
      if (error) return UI.toast(App.msg(error), "error");
      UI.closeModal();
      UI.toast("Pending reservation updated.", "success");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  window.App.cancelReservation = async function (id) {
    if (!confirm("Cancel this reservation?")) return;
    try {
      const { error } = await DB.rpc("cancel_reservation", { p_reservation_id: id });
      if (error) return UI.toast(App.msg(error), "error");
      UI.toast("Reservation cancelled.", "success");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  // ---- Administrator approval workflow (BR-B4-04) --------------------------
  window.App.approveReservation = async function (id) {
    try {
      const { error } = await DB.rpc("admin_approve_reservation", { p_reservation_id: id });
      if (error) return UI.toast(App.msg(error), "error");
      UI.toast("Reservation approved → Approved (TC-B4-03).", "success");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  window.App.approveAndSchedule = async function (id) {
    try {
      const { error } = await DB.rpc("admin_approve_and_schedule", {
        p_reservation_id: id,
        p_notes: "Approved and scheduled by administrator."
      });
      if (error) return UI.toast(App.msg(error), "error");
      UI.toast("Reservation approved and scheduled.", "success");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  window.App.scheduleReservation = async function (id) {
    try {
      const { error } = await DB.rpc("admin_schedule_reservation", { p_reservation_id: id });
      if (error) return UI.toast(App.msg(error), "error");
      UI.toast("Reservation scheduled.", "success");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  window.App.adminCancel = async function (id) {
    if (!confirm("Cancel this reservation as administrator?")) return;
    try {
      const { error } = await DB.rpc("admin_cancel_reservation", { p_reservation_id: id });
      if (error) return UI.toast(App.msg(error), "error");
      UI.toast("Reservation cancelled by administrator.", "success");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  // ---- Facility staff workflow ---------------------------------------------
  window.App.startReservation = async function (id) {
    try {
      const { error } = await DB.rpc("staff_start_reservation", { p_reservation_id: id });
      if (error) return UI.toast(App.msg(error), "error");
      UI.toast("Facility marked In Use (TC-B4-05).", "success");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  // Generic notes modal for "reject" and "complete"
  window.App.notesModal = function (kind, id) {
    const labels = { reject: "Reject reservation", complete: "Record completion" };
    UI.modal(
      labels[kind],
      `<label>Notes<textarea id="notes-input" class="input mono" rows="4" ${
        kind === "reject" ? 'required placeholder="Reason (visible to requester)"' : 'placeholder="Optional completion notes"'
      }></textarea></label>`,
      `<button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="App.doNotes('${kind}','${id}')">Confirm</button>`
    );
  };

  window.App.doNotes = async function (kind, id) {
    const notes = document.getElementById("notes-input").value.trim();
    try {
      const rpc =
        kind === "reject"
          ? DB.rpc("admin_reject_reservation", { p_reservation_id: id, p_notes: notes })
          : DB.rpc("staff_complete_reservation", { p_reservation_id: id, p_notes: notes });
      const { error } = await rpc;
      if (error) return UI.toast(App.msg(error), "error");
      UI.closeModal();
      UI.toast(kind === "reject" ? "Reservation rejected (TC-B4-04)." : "Reservation completed (TC-B4-06).", "success");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  // ==========================================================================
  //  Facilities
  // ==========================================================================
  window.App.conditionModal = function (id, name, note) {
    UI.modal(
      `Update condition — ${name}`,
      `<label>Condition note<textarea id="cond-note" class="input" rows="3" placeholder="Latest condition of the facility">${UI.esc(note)}</textarea></label>
       <label>Facility status
         <select id="cond-status" class="input">
           <option value="active">Active (reservable)</option>
           <option value="maintenance">Under maintenance</option>
         </select>
       </label>`,
      `<button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="App.saveCondition('${id}')">Save</button>`
    );
  };

  window.App.saveCondition = async function (id) {
    try {
      const { error } = await DB.rpc("staff_update_facility_operational", {
        p_facility_id: id,
        p_condition_note: document.getElementById("cond-note").value.trim(),
        p_status: document.getElementById("cond-status").value
      });
      if (error) return UI.toast(App.msg(error), "error");
      UI.closeModal();
      UI.toast("Facility condition updated.");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  window.App.newFacility = function () {
    UI.modal(
      "New facility",
      `<label>Name<input id="fac-name" class="input" required></label>
       <label>Location<input id="fac-location" class="input"></label>
       <label>Capacity<input id="fac-capacity" class="input" type="number" min="0" value="0"></label>
       <label>Description<textarea id="fac-desc" class="input" rows="3"></textarea></label>
       <label>Status<select id="fac-status" class="input">
         <option value="active">Active</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option>
       </select></label>`,
      `<button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="App.saveNewFacility()">Create</button>`
    );
  };

  window.App.saveNewFacility = async function () {
    try {
      const { error } = await DB.rpc("admin_create_facility", {
        p_name: document.getElementById("fac-name").value.trim(),
        p_description: document.getElementById("fac-desc").value.trim(),
        p_location: document.getElementById("fac-location").value.trim(),
        p_capacity: parseInt(document.getElementById("fac-capacity").value, 10) || 0,
        p_status: document.getElementById("fac-status").value
      });
      if (error) return UI.toast(App.msg(error), "error");
      UI.closeModal();
      UI.toast("Facility created.");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  window.App.editFacility = async function (id) {
    const { data: fac } = await DB.facilities();
    const f = (fac || []).find((x) => x.id === id);
    if (!f) return;
    UI.modal(
      `Edit facility — ${UI.esc(f.name)}`,
      `<label>Name<input id="fac-name" class="input" required value="${UI.esc(f.name)}"></label>
       <label>Location<input id="fac-location" class="input" value="${UI.esc(f.location)}"></label>
       <label>Capacity<input id="fac-capacity" class="input" type="number" min="0" value="${f.capacity}"></label>
       <label>Description<textarea id="fac-desc" class="input" rows="3">${UI.esc(f.description)}</textarea></label>
       <label>Status<select id="fac-status" class="input">
         ${["active", "maintenance", "inactive"].map((s) => `<option value="${s}" ${f.status === s ? "selected" : ""}>${UI.label(s)}</option>`).join("")}
       </select></label>
       <label>Condition note<textarea id="fac-condition" class="input" rows="2">${UI.esc(f.condition_note)}</textarea></label>`,
      `<button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="App.saveEditFacility('${id}')">Save</button>`
    );
  };

  window.App.saveEditFacility = async function (id) {
    try {
      const { error } = await DB.rpc("admin_update_facility", {
        p_facility_id: id,
        p_name: document.getElementById("fac-name").value.trim(),
        p_description: document.getElementById("fac-desc").value.trim(),
        p_location: document.getElementById("fac-location").value.trim(),
        p_capacity: parseInt(document.getElementById("fac-capacity").value, 10) || 0,
        p_status: document.getElementById("fac-status").value,
        p_condition_note: document.getElementById("fac-condition").value.trim()
      });
      if (error) return UI.toast(App.msg(error), "error");
      UI.closeModal();
      UI.toast("Facility updated.");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  // ==========================================================================
  //  Service requests
  // ==========================================================================
  window.App.newServiceRequest = async function () {
    const { data: fac } = await DB.facilities();
    const opts = (fac || []).map((f) => `<option value="${f.id}">${UI.esc(f.name)}</option>`).join("");
    UI.modal(
      "New service request",
      `<label>Facility<select id="svc-facility" class="input">${opts}</select></label>
       <label>Title<input id="svc-title" class="input" required placeholder="e.g. Broken projector"></label>
       <label>Description<textarea id="svc-desc" class="input" rows="3" placeholder="Describe the issue"></textarea></label>`,
      `<button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="App.saveNewServiceRequest()">Submit</button>`
    );
  };

  window.App.saveNewServiceRequest = async function () {
    try {
      const { error } = await DB.rpc("create_service_request", {
        p_facility_id: document.getElementById("svc-facility").value,
        p_title: document.getElementById("svc-title").value.trim(),
        p_description: document.getElementById("svc-desc").value.trim()
      });
      if (error) return UI.toast(App.msg(error), "error");
      UI.closeModal();
      UI.toast("Service request created.");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  window.App.updateServiceStatus = async function (id, status) {
    try {
      const { error } = await DB.rpc("update_service_request_status", { p_request_id: id, p_status: status });
      if (error) return UI.toast(App.msg(error), "error");
      UI.toast(`Service request → ${UI.label(status)}.`);
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  // ==========================================================================
  //  User management
  // ==========================================================================
  window.App.changeUserRole = async function (uid, role) {
    try {
      const { error } = await DB.rpc("admin_set_user_role", { p_user_id: uid, p_role: role });
      if (error) return UI.toast(App.msg(error), "error");
      UI.toast("Role updated.");
      App.reload();
    } catch (e) {
      UI.toast(App.msg(e), "error");
    }
  };

  // ==========================================================================
  //  Refresh & bootstrap
  // ==========================================================================
  window.App.reload = function () {
    App.loadRoute(App.currentRoute);
  };

  // keep forms available to the auth tab switcher
  window.Pages.__loginForm = function () {
    return `<form onsubmit="App.submitLogin(event)" class="form">
      <label>Email<input type="email" id="login-email" class="input" required placeholder="requester@example.com"></label>
      <label>Password<input type="password" id="login-password" class="input" required placeholder="password123"></label>
      <button type="submit" class="btn btn-primary btn-block">Sign in</button>
    </form>
    <p class="hint">Demo (seed.sql): admin / staff / requester<code>@example.com</code> · password <code>password123</code></p>`;
  };

  window.Pages.__registerForm = function () {
    return `<form onsubmit="App.submitRegister(event)" class="form">
      <label>Full name<input type="text" id="reg-name" class="input" required placeholder="Jane Doe"></label>
      <label>Email<input type="email" id="reg-email" class="input" required placeholder="you@example.com"></label>
      <label>Password<input type="password" id="reg-password" class="input" required minlength="6" placeholder="min 6 characters"></label>
      <button type="submit" class="btn btn-primary btn-block">Create account</button>
    </form>
    <p class="hint">New accounts get the <b>Requester</b> role.</p>`;
  };

  document.addEventListener("DOMContentLoaded", () => {
    window.App.boot();
  });
})();