import { sb, isConfigured, $, showSetupNotice } from "./sb.js";
import { cardHTML, PRESETS } from "./card.js";

// A sample card so visitors see what they'll make.
$("sample").innerHTML = cardHTML({
  details: {
    name1: "Hakim", name2: "Nadia", headline: "Together with their families",
    message: "We would be honoured to have you with us as we begin our life together.",
    date: "2027-03-13", start: "11:00", end: "16:00", venue: "The Glasshouse", address: "Singapore", dress: "Smart traditional",
  },
  style: PRESETS.find((p) => p.id === "peranakan").style,
}, "Auntie Rosnah & family");

if (!isConfigured) showSetupNotice();

// Already signed in? Offer the way back in.
sb.auth.getSession().then(({ data: { session } }) => { if (session) $("goApp").hidden = false; });

// Google sign-in: needs the Google provider turned on in Supabase (README step 6, option A).
$("google").addEventListener("click", async () => {
  const btn = $("google"), note = $("signinNote");
  btn.disabled = true; note.textContent = "Opening Google…";
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: new URL("app.html", location.href).href },
  });
  if (error) {
    btn.disabled = false;
    note.textContent = /not enabled|unsupported provider/i.test(error.message)
      ? "Google sign-in isn't switched on for this site yet. Use your email instead."
      : `Couldn't open Google sign-in: ${error.message}`;
  }
});

$("signin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("email").value.trim();
  const btn = $("sendLink"), note = $("signinNote");
  btn.disabled = true; note.textContent = "Sending…";
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: new URL("app.html", location.href).href },
  });
  btn.disabled = false;
  note.textContent = error
    ? `Couldn't send the link: ${error.message}`
    : `Check ${email} for your sign-in link. It can take a minute, and may land in spam.`;
});
