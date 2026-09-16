// ============================================================================
//  DB - thin data-access wrappers over Supabase (RLS protects the backend)
// ============================================================================
(function () {
  "use strict";

  const client = () => window.Auth.getClient();

  const reservationSelect =
    "*, facility:facilities(id, name, status, location), " +
    "requester:profiles(id, full_name, email)";

  window.DB = {
    role: () => (window.Auth.state.profile ? window.Auth.state.profile.role : null),
    uid: () => (window.Auth.state.session ? window.Auth.state.session.user.id : null),

    // ---- reads -------------------------------------------------------------
    async facilities() {
      const { data, error } = await client()
        .from("facilities").select("*").order("name");
      return { data, error };
    },

    async myReservations() {
      const { data, error } = await client()
        .from("reservations").select(reservationSelect)
        .eq("requester_id", this.uid())
        .order("created_at", { ascending: false });
      return { data, error };
    },

    async allReservations() {
      const { data, error } = await client()
        .from("reservations").select(reservationSelect)
        .order("created_at", { ascending: false });
      return { data, error };
    },

    async serviceRequests() {
      const { data, error } = await client()
        .from("service_requests")
        .select("*, facility:facilities(id, name), reporter:profiles(id, full_name, email)")
        .order("created_at", { ascending: false });
      return { data, error };
    },

    async auditLogs(limit) {
      const { data, error } = await client()
        .from("audit_logs")
        .select("*, user:profiles(id, email, full_name)")
        .order("created_at", { ascending: false })
        .limit(limit || 300);
      return { data, error };
    },

    async profiles() {
      const { data, error } = await client()
        .from("profiles").select("*").order("email");
      return { data, error };
    },

    // ---- RPC wrappers (role + business rules enforced in the database) -----
    rpc: (name, args) => client().rpc(name, args || {}),
  };
})();