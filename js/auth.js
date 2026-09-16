// ============================================================================
//  Auth - session management (sign in / sign up / sign out / profile)
// ============================================================================
(function () {
  "use strict";

  const C = window.SUPABASE_CONFIG || {};
  let client = null;

  function getClient() {
    if (client) return client;
    if (
      !C.url || C.url.indexOf("PLEASE_SET") === 0 ||
      !C.anonKey || C.anonKey.indexOf("PLEASE_SET") === 0
    ) {
      const err = new Error("CONFIG_MISSING");
      err.configMissing = true;
      throw err;
    }
    client = window.supabase.createClient(C.url, C.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  }

  window.Auth = {
    state: { ready: false, session: null, profile: null },

    getClient,

    async init() {
      try {
        const c = getClient();
        const { data: { session } } = await c.auth.getSession();
        this.state.session = session;
        if (session) {
          const { data, error } = await c
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();
          if (!error) this.state.profile = data;
        }
      } catch (e) {
        this.state.error = e;
      }
      this.state.ready = true;
      return this.state;
    },

    async signUp(email, password, fullName) {
      const c = getClient();
      return c.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });
    },

    async signIn(email, password) {
      const c = getClient();
      const res = await c.auth.signInWithPassword({ email, password });
      if (!res.error && res.data.session) {
        this.state.session = res.data.session;
        const { data } = await c
          .from("profiles")
          .select("*")
          .eq("id", res.data.session.user.id)
          .maybeSingle();
        this.state.profile = data;
      }
      return res;
    },

    async signOut() {
      const c = getClient();
      await c.auth.signOut();
      this.state.session = null;
      this.state.profile = null;
    }
  };
})();