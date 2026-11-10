# Jemput setup guide

A website where anyone can sign up, design a wedding invitation, add their guests, send each household a personal link on WhatsApp, and see replies arrive live.

It's plain HTML, CSS and JavaScript, so there's nothing to build or compile. The backend is [Supabase](https://supabase.com), which provides the database, sign-in by email and photo storage. Its free plan is plenty to start.

All file paths below are relative to the top of the project folder.

> **Hosting from GitHub:** if this folder is in a GitHub repository, you can link it to Netlify instead of dragging the folder each time. In Netlify, go to **Add new site → Import an existing project → GitHub**, pick the repository, leave the build command empty, and set the publish directory to `.`. Every change you push then goes live automatically.

## What's in the folder

| File | What it is |
|---|---|
| `index.html` | Home page and sign-in |
| `app.html` | "Your invitations" dashboard |
| `edit.html` | The editor: Design tab and Guests tab |
| `invite.html` | What a guest sees when they open their link |
| `js/config.js` | **You must edit this**: your Supabase details |
| `js/site.js` | Your contact email for the privacy policy |
| `privacy.html` | Privacy policy (Google asks for this before publishing Google sign-in) |
| `js/card.js` | How cards look: templates, fonts, borders, photos. Add new templates here |
| `js/edit.js`, `js/dashboard.js`, `js/invite.js`, `js/landing.js` | The code for each page |
| `js/sb.js` | Connects to Supabase and a few shared helpers |
| `css/base.css`, `css/card.css` | Site styles and card styles |
| `img/` | The Jemput logo (`logo.svg`, `logo-120.png`, `logo-512.png`) and browser and phone icons |
| `supabase/schema.sql` | Sets up the database, security rules and photo storage (for a new setup) |
| `supabase/002_group_links.sql` | One-time update for setups made before group links existed |
| `.github/workflows/keep-awake.yml` | Optional: keeps a free Supabase project from pausing (step 6C) |

## Setup (about 15 minutes)

### 1. Create a Supabase project
1. Sign up at [supabase.com](https://supabase.com) and click **New project**. Pick the Singapore region so it's fast for your guests.
2. Wait a minute or two for it to finish setting up.

### 2. Create the database
1. In your project, open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql`, copy everything, paste it in, and click **Run**. You should see "Success".

This creates the tables, makes sure each person can only see their own invitations, sets up the photo storage, and adds the two functions guests use to view their invitation and reply. Guests never need an account.

> **Already set up Jemput before group links were added?** Run `supabase/002_group_links.sql` the same way, once. It adds group links without touching your existing invitations or guests. Until you do, everything else keeps working and the Guests tab shows a reminder.

### 3. Connect the website to your project
1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Paste them into `js/config.js`.

The anon key is designed to be public. The security rules from step 2 are what protect the data.

### 4. Try it on your computer
The pages use JavaScript modules, so they need to be served rather than opened by double-clicking. Either:
- with Node.js installed: open a terminal in this folder and run `npx serve .`, then go to http://localhost:3000
- or, in VS Code: install the **Live Server** extension, right-click `index.html` → **Open with Live Server**

Then tell Supabase it's allowed to send sign-in links back to your computer: **Authentication → URL Configuration → Redirect URLs** → add `http://localhost:3000/**` (or Live Server's address, usually `http://127.0.0.1:5500/**`).

Sign in with your email, create an invitation, add yourself as a guest, and open your own link from the Guests tab to test a reply.

### 5. Put it online
The easiest way is **Netlify Drop**: go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag this whole folder onto the page. You'll get an address like `https://jemput-abc123.netlify.app`. Vercel, Cloudflare Pages and GitHub Pages work too, since it's just static files.

Then, back in Supabase → **Authentication → URL Configuration**:
- set **Site URL** to your new address
- add `https://your-address/**` to **Redirect URLs**

If you buy a domain later (say `jemput.sg`), connect it in Netlify and add it to the Supabase redirect URLs as well.

### 6. Before you invite real people to sign up (all free)
Supabase's built-in email sender only sends a handful of sign-in emails per hour and is meant for testing. Guests aren't affected, because they never sign in, but couples are. There are three free fixes. **A** and **B** fix sign-in, and **C** stops a free project from going to sleep. Doing A and C is a good combination.

#### A. Sign in with Google (recommended: no emails at all)
The site already has a **Continue with Google** button. It just needs switching on.

1. Go to [console.cloud.google.com](https://console.cloud.google.com), sign in with any Google account, and create a project (top bar → project picker → **New project**, name it "Jemput").
2. Open **APIs & Services → OAuth consent screen** (on newer screens: **Google Auth Platform → Branding**). Click **Get started**, then:
   - App name: `Jemput`. Support email: yours.
   - Audience: **External**.
   - Contact email: yours. Agree and **Create**.
3. Open **Audience** and click **Publish app**, so anyone can sign in, not just test users. The basic email and name permissions don't need Google's review.
4. Open **Clients** (or **Credentials → Create credentials → OAuth client ID**):
   - Application type: **Web application**. Name: `Jemput web`.
   - **Authorized JavaScript origins**: add your site address, e.g. `https://jemput-abc123.netlify.app`, plus `http://localhost:3000` for testing.
   - **Authorized redirect URIs**: add `https://<your-project-id>.supabase.co/auth/v1/callback`. Supabase shows this exact address in the next step, so you can copy it from there.
   - Click **Create** and keep the **Client ID** and **Client secret** that appear.
5. In Supabase, go to **Authentication → Sign In / Providers → Google**. Turn it on, paste the Client ID and Client secret, and **Save**.
6. Make sure your site address is still in **Authentication → URL Configuration → Redirect URLs** (from step 5).

Test it: on the home page, click **Continue with Google**, pick your account, and you should land on "Your invitations". If you already signed up with email using the same Gmail address, Supabase links the two and you'll see the same invitations.

#### B. Send the email links through your Gmail
Use this if you want to keep email sign-in for people without Google accounts. Emails come from your Gmail address, and Gmail allows a few hundred a day.

1. Turn on **2-Step Verification** for your Google account at [myaccount.google.com/security](https://myaccount.google.com/security). App passwords only work once it's on.
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), type `Supabase` as the name, and click **Create**. Copy the 16-letter password it shows. You won't see it again.
3. In Supabase, go to **Authentication → Emails → SMTP Settings**, turn on **Enable custom SMTP**, and fill in:

   | Field | Value |
   |---|---|
   | Sender email | your Gmail address |
   | Sender name | `Jemput` |
   | Host | `smtp.gmail.com` |
   | Port | `587` |
   | Username | your Gmail address |
   | Password | the 16-letter app password, without spaces |

4. **Save**. Then go to **Authentication → Rate Limits** and raise "emails sent per hour", say to 30.
5. Optional: under **Authentication → Emails → Templates → Magic Link**, change the subject to "Your Jemput sign-in link" so the email looks less generic.

Send yourself a sign-in link to test it. If it fails, the most common cause is pasting the app password with its spaces.

#### C. Keep the free project awake
Free Supabase projects pause after a week with no visitors. While paused, nobody can sign in and **guest links stop working** until you press **Restore project** in the dashboard. A tiny automatic request every few days prevents that. Pick one way:

**With cron-job.org (no GitHub needed)**
1. Sign up free at [cron-job.org](https://cron-job.org) and click **Create cronjob**.
2. Title: `Keep Jemput awake`. URL: `https://<your-project-id>.supabase.co/rest/v1/invitations?select=id&limit=1`
3. Schedule: every day, or every 3 days.
4. Open the **Advanced** tab and add two request headers:
   - `apikey` = your anon key
   - `Authorization` = `Bearer ` followed by your anon key (with a space after "Bearer")
5. Save, then click **Test run**. A response of `200` with `[]` is correct: the security rules hide every invitation from it, but it still counts as activity.

**With GitHub**, if you keep this folder in a GitHub repository:
1. The file `.github/workflows/keep-awake.yml` is already included.
2. In the repository, go to **Settings → Secrets and variables → Actions** and add two secrets: `SUPABASE_URL` (your Project URL) and `SUPABASE_ANON_KEY`.
3. Open the **Actions** tab, pick **Keep Supabase awake**, and click **Run workflow** once to check it turns green.

GitHub switches off scheduled jobs in a repository that has had no commits for 60 days, so cron-job.org is the more hands-off choice.

## How the pieces work

- **Couples** sign in with Google or with a link sent to their email. Each invitation, guest and saved template belongs to the person who made it, and the database refuses anyone else.
- **Each guest** gets a random 32-character code in their link (`invite.html#…`, after the `#` so no server can strip it). That code is the only way to open their invitation, and it only lets them see that one card and change their own reply. They can never see the guest list.
- **Replies** go through `submit_rsvp`, which checks the answer and caps the head-count at the seats you gave them.
- **Photos** are resized in the browser before upload, stored in a folder for each user, and readable by anyone with the link so guests can see them.
- **The Guests tab updates live.** When someone replies, it appears without refreshing.

## Adding a template
Open `js/card.js`, find `PRESETS`, copy one of the entries, give it a new `id` and `name`, and change the colours and fonts. Fonts must be in the `FONTS` list. To add a new Google Font, add it to `FONTS` and to the Google Fonts link at the top of each HTML page.

## Good next steps
- **Link previews:** WhatsApp shows the same "You're invited" preview for every link. Showing the couple's names and photo needs a small server function. Netlify and Vercel both offer these.
- **iPhone HEIC photos** need converting to JPG before upload. A library like `heic2any` could do it in the browser.
- **Multiple events** (akad nikah, tea ceremony, reception) with a separate RSVP for each.
- **Reminders** to guests who haven't replied, as a "copy message" for everyone still waiting.
