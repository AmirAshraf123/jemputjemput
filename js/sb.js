// Shared Supabase client and small page helpers.
import { SUPABASE_ANON_KEY } from "./config.js";
import { BASE_URL, urlProblem } from "./base-url.js";

export const isConfigured = !urlProblem && !SUPABASE_ANON_KEY.includes("YOUR-") && SUPABASE_ANON_KEY.trim().length > 20;

export const sb = window.supabase.createClient(
  isConfigured ? BASE_URL : "https://example.supabase.co",
  isConfigured ? SUPABASE_ANON_KEY.trim() : "missing-key"
);

/** Returns the signed-in user, or sends the visitor to the sign-in page. */
export async function requireUser() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.replace("index.html"); return null; }
  return session.user;
}

export async function signOut() {
  await sb.auth.signOut();
  location.replace("index.html");
}

export const $ = (id) => document.getElementById(id);

export function toast(msg) {
  let t = $("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2800);
}

export function showSetupNotice() {
  const n = document.createElement("div");
  n.className = "banner";
  const msg = {
    invalid: "The Supabase URL in <code>js/config.js</code> isn't a web address. It should look like <code>https://abcdefghijkl.supabase.co</code>.",
    dashboard: "<code>js/config.js</code> has a Supabase dashboard link instead of the Project URL. Copy the URL from Project Settings → Data API. It looks like <code>https://abcdefghijkl.supabase.co</code>.",
  }[urlProblem] || "Add your Supabase Project URL and anon key to <code>js/config.js</code>, then reload. See docs/SETUP.md for where to find them.";
  n.innerHTML = "<b>Almost there.</b> " + msg;
  document.querySelector("main")?.prepend(n);
}
