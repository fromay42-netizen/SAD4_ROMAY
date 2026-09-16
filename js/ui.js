// ============================================================================
//  UI - shared rendering helpers (badges, toasts, modals, layout)
// ============================================================================
(function () {
  "use strict";

  const STATUS_STYLE = {
    pending: "badge badge-pending",
    approved: "badge badge-approved",
    rejected: "badge badge-rejected",
    scheduled: "badge badge-scheduled",
    in_use: "badge badge-inuse",
    completed: "badge badge-completed",
    cancelled: "badge badge-cancelled",

    active: "badge badge-active",
    maintenance: "badge badge-maintenance",
    inactive: "badge badge-cancelled",

    open: "badge badge-pending",
    in_progress: "badge badge-inuse",
    resolved: "badge badge-completed",

    administrator: "badge badge-scheduled",
    staff: "badge badge-approved",
    requester: "badge badge-inuse"
  };

  window.UI = {
    setContent(html) {
      const target = document.getElementById("page-root") || document.getElementById("app-root");
      if (target) target.innerHTML = html;
    },

    esc(str) {
      return String(str == null ? "" : str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },

    label(value) {
      return String(value == null ? "" : value).replace(/_/g, " ");
    },

    dt(ts) {
      if (!ts) return "—";
      const d = new Date(ts);
      return d.toLocaleString(undefined, {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      });
    },

    dateInputValue(ts) {
      const d = new Date(ts);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
        `T${p(d.getHours())}:${p(d.getMinutes())}`;
    },

    badge(value) {
      const cls = STATUS_STYLE[value] || "badge";
      return `<span class="${cls}">${this.esc(this.label(value))}</span>`;
    },

    humanize(key) {
      const map = {
        reservation_submitted: "Reservation submitted",
        reservation_approved: "Reservation approved",
        reservation_rejected: "Reservation rejected",
        reservation_scheduled: "Reservation scheduled",
        reservation_in_use: "Reservation in use",
        reservation_completed: "Reservation completed",
        reservation_cancelled: "Reservation cancelled",
        reservation_updated: "Reservation updated",
        reservation_deleted: "Reservation deleted",
        facility_created: "Facility created",
        facility_updated: "Facility updated",
        facility_deleted: "Facility deleted",
        service_request_created: "Service request created",
        service_request_updated: "Service request updated",
        service_request_in_progress: "Service request in progress",
        service_request_resolved: "Service request resolved",
        service_request_deleted: "Service request deleted",
        user_role_changed: "User role changed",
        user_profile_updated: "User profile updated"
      };
      return map[key] || key || "";
    },

    // ---- layout ------------------------------------------------------------
    layout(title, subtitle, actionsHtml, bodyHtml) {
      return `
        <div class="page-head">
          <div>
            <h1>${title}</h1>
            ${subtitle ? `<p>${subtitle}</p>` : ""}
          </div>
          ${actionsHtml ? `<div class="page-actions">${actionsHtml}</div>` : ""}
        </div>
        ${bodyHtml}
      `;
    },

    empty(msg) {
      return `<div class="empty-state">${msg}</div>`;
    },

    // ---- toasts ------------------------------------------------------------
    toast(msg, type) {
      const root = document.getElementById("toast-root");
      if (!root || !msg) return;
      const el = document.createElement("div");
      el.className = "toast toast-" + (type || "info");
      el.textContent = msg;
      root.appendChild(el);
      setTimeout(() => {
        el.classList.add("toast-out");
        setTimeout(() => el.remove(), 400);
      }, 4500);
    },

    // ---- modals ------------------------------------------------------------
    modal(title, bodyHtml, footerHtml) {
      const root = document.getElementById("modal-root");
      root.innerHTML = `
        <div class="modal-backdrop" onclick="if(event.target===this)UI.closeModal()">
          <div class="modal">
            <div class="modal-head">
              <h3>${this.esc(title)}</h3>
              <button class="icon-btn" onclick="UI.closeModal()" aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">${bodyHtml || ""}</div>
            ${footerHtml ? `<div class="modal-foot">${footerHtml}</div>` : ""}
          </div>
        </div>`;
    },

    closeModal() {
      const root = document.getElementById("modal-root");
      if (root) root.innerHTML = "";
    },

    // ---- message card for config errors ------------------------------------
    configCard(extra) {
      return `
        <div class="card config-card">
          <h2>Supabase connection not configured</h2>
          <p>Edit <code>js/config.js</code> and paste your Supabase project URL and anon key.</p>
          <pre>${this.esc(extra || "")}</pre>
        </div>`;
    }
  };
})();