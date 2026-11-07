// Cleans up the Supabase URL from config.js, so small copy-paste slips
// (a trailing slash, "/rest/v1/" on the end) don't break sign-in.
import { SUPABASE_URL } from "./config.js";

function check(raw) {
  const s = String(raw || "").trim();
  if (!s || s.includes("YOUR-")) return { url: "", problem: "missing" };
  let u;
  try { u = new URL(s.startsWith("http") ? s : "https://" + s); } catch { return { url: "", problem: "invalid" }; }
  if (u.hostname.endsWith("supabase.com")) {
    // A dashboard link like supabase.com/dashboard/project/<id>: recover the project id.
    const id = u.pathname.match(/project\/([a-z0-9]{10,})/)?.[1];
    return id ? { url: `https://${id}.supabase.co`, problem: "" } : { url: "", problem: "dashboard" };
  }
  return { url: u.origin, problem: "" };
}

const { url, problem } = check(SUPABASE_URL);
export const BASE_URL = url;
export const urlProblem = problem;
