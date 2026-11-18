# Jemput

**Invitations with a guest list built in,** for weddings, birthdays, aqiqahs, open houses and more. Hosts design an invitation, send each household a personal link on WhatsApp, and watch RSVPs arrive live. Guests never need an account.

*Jemput* is Malay for "to invite".

Visitors can design a card on the home page before signing up. New invitations start with a two-screen guided setup, and the editor is split into four steps (**Details · Style · Decorate · Reveal**) with a "ready to send" checklist beside the preview.

**[Live site →](https://jemput2.netlify.app)** · [Set it up yourself](docs/SETUP.md)

![Jemput home page with a sample Peranakan-style invitation](docs/screenshots/home.png)

## Why I built it

Canva can design a card, but it doesn't help with the hard part of a wedding in Singapore: chasing replies from a few hundred relatives over WhatsApp, tracking plus-ones and dietary needs, and knowing which side of the family each guest is on. Jemput treats the invitation as the front end of a guest list.

## Features

| | |
|---|---|
| ![Invitation editor with nine templates and a live preview](docs/screenshots/editor.png) | **Design editor**<br>Eight occasions, each with its own wording, and fifteen templates (Songket, Peranakan, Confetti, Festive and more). Sixteen fonts, colour pickers, border patterns, and photos you can place above, below, left or right of the text, or as the background, then drag, zoom and frame. Every part of the card (heading, names, message, date, venue and more) can be dragged into a new order, hidden, and given its own colour and font, with gold, rose-gold or silver foil for the names. **Free design** adds stickers from a hand-drawn library (florals, vines, frames, festive and cultural motifs), your own uploaded artwork and free text boxes that can curve, placed anywhere with snapping guides, layers, pinch-to-resize on phones, and undo. Colour sets can be pulled from your photo, photos can be duotoned or filtered, and petals or sparkles can fall when a guest opens the card. Designs export as a 1080px picture or a print-ready PDF with bleed and crop marks, and can be shared as credited community templates. Add a schedule or extra lines, add a second language (English, Malay, Chinese or Tamil) that guests switch to with a button, with the standard wording and dates translated built-in and a Translate button for the rest, corner ornaments, textured or gradient backgrounds, and square or Stories-shaped cards. A built-in check flags text colours that are hard to read and fixes them in one tap. Save any card as a 1080px picture. On phones the preview stays pinned while you edit. Saved templates can be reused across invitations. Changes save automatically. |
| ![Guest list with RSVP totals and WhatsApp buttons](docs/screenshots/guests.png) | **Guest list**<br>Add households with seats and family side, send each one a pre-written WhatsApp message with their own link, see totals at a glance, and export to CSV for the caterer. New replies appear without refreshing. |
| <img src="docs/screenshots/group-reply.png" alt="Group link reply form asking for name and WhatsApp number" width="260"> | **Group links**<br>One link for a group chat, such as old classmates. Each person enters their name and WhatsApp number and is added to the guest list. Replying again from the same number updates the earlier reply. Replies that match someone already on the list by number or name are flagged as possible duplicates, and a group reply can never overwrite a personal guest's answer. |
| <img src="docs/screenshots/guest-phone.png" alt="Guest's invitation on a phone with an RSVP form" width="260"> | **Guest page**<br>Each guest can open the card from an envelope, with optional background music, and sees the card with their name on it, Maps and calendar buttons, and an RSVP form limited to the seats they were given. No sign-up needed. |

## Tech stack

- **Front end:** plain HTML, CSS and JavaScript modules. No framework and no build step.
- **Back end:** [Supabase](https://supabase.com) for the Postgres database, row-level security, email and Google sign-in, file storage and realtime updates.
- **Hosting:** Netlify, as static files.
- **Accessibility:** a warm cream palette where every text and control colour meets WCAG AA contrast in light and dark mode, 16px base text, 44px tap targets and visible focus rings. Every page passes an axe-core audit (WCAG 2.2 AA) in light and dark mode on desktop and phone, works by keyboard alone, reflows without sideways scrolling at 400% zoom, and marks selections in Windows high-contrast mode. The guest page follows the card's language, including the reply form.

## How it works

```mermaid
flowchart LR
  Host["Couple (signed in)"] -->|"edit invitation, manage guests"| DB[("Supabase Postgres<br>row-level security")]
  Host -->|"upload photos"| ST[("Supabase Storage")]
  Host -->|"WhatsApp link with secret code"| Guest["Guest (no account)"]
  Guest -->|"get_invite(code)<br>submit_rsvp(code, …)"| DB
  Group["Group chat member"] -->|"submit_group_rsvp(group code, name, number, …)"| DB
  DB -->|"realtime"| Host
```

- **Couples only ever see their own data.** Every table has a row-level security policy tying rows to `auth.uid()`, so the database itself refuses other users. It doesn't depend on the front end behaving.
- **Guests get a capability link, not an account.** Each guest row has a random 128-bit code. Guests can't query tables at all. They can only call two `SECURITY DEFINER` functions, which take the code and return or update that one guest's row. The reply function checks the answer and caps the head-count at the seats offered.
- **Group links** go through a third function that matches replies by normalised phone number (+65 added to 8-digit numbers), updates an existing group reply instead of duplicating it, and flags rather than merges anything that matches a personal guest. The guest's phone remembers its reply locally, so reopening the link shows the answer rather than a blank form.
- **Photos** are resized in the browser before upload, stored under `<user-id>/<invitation-id>/`, and protected by storage policies on that folder.
- **The card renderer** (`js/card.js`) is shared by the editor, the dashboard and the guest page, so every view matches. All user text is HTML-escaped, and all stored styles are re-validated before rendering.

## Problems worth mentioning

- **Positioning a photo in any frame shape.** Moving the photo with `object-position` only works along the axis where the photo overflows the frame, so up/down did nothing for a wide photo in a tall arch. I switched to CSS container query units: the image is sized from the frame (`max(100cqw, 100cqh × aspect)`) and translated by a percentage of it. That gives zoom below 100%, free dragging in both directions, and a "fit frame to photo" button.
- **Links that broke on real hosting.** Some static hosts rewrite `edit.html?id=…` to `/edit` and drop the query string. Invitation IDs and guest codes now live in the URL fragment (`#…`), which is never sent to the server, and older `?id=` links still work.
- **Forgiving setup.** People paste their Supabase URL with a trailing slash, `/rest/v1/`, or a dashboard link instead. `js/base-url.js` normalises all of these, so a copy-paste slip doesn't stop sign-in.
- **Two languages without a longer card.** Stacking a translation under every line doubled the card's length. The card now shows one language at a time with a switch for guests, and opens in the guest's phone language when it matches. The standard wording for each occasion has hand-written translations, dates use the browser's own `Intl` formatting for each language, and anything else goes through a free translation API. Each saved translation remembers the wording it was made from, so the editor can flag it when the original changes.
- **A design layer that survives every screen.** Stickers and text boxes are stored as positions and widths in percent of the card, with font sizes in container query units (`cqw`), so the same design looks right in the editor, on a phone, in the 1080px export and in the 300 dpi PDF. Stickers are one-colour SVGs used as CSS masks, which is what lets any of them take a flat colour or a foil gradient.
- **Safety without paid services.** Spam on group links is stopped inside Postgres: the reply function reads the caller's IP address from the request headers Supabase passes through, and allows 8 replies per 10 minutes per connection and 60 per link. Shared templates are hidden after three different people report them, and a trigger stops owners from clearing that flag. People can delete their own account, which removes their files from storage and then cascades through every table.
- **Check-in on the day.** Each guest who accepts gets an entry pass, a QR code of their own link. The host's phone scans it using the browser's built-in `BarcodeDetector` where there is one, or the `jsQR` library where there isn't.
- **Works without signal.** A service worker keeps the site's files, fonts and photos, and the guest page keeps the last invitation it opened, so a guest at a venue with no reception can still see the card and the address.
- **Free-tier realities.** A scheduled ping (`.github/workflows/keep-awake.yml`) stops the free database from pausing, which would otherwise break guest links in the middle of RSVP season.

## Project structure

```
index.html      landing page and sign-in
app.html        dashboard: your invitations
edit.html       editor: Design and Guests tabs
invite.html     the page a guest opens
privacy.html    privacy policy
js/card.js      templates, fonts and card rendering (shared)
js/edit.js      editor logic
js/invite.js    guest page and RSVP
supabase/schema.sql   tables, security policies, guest functions, storage
js/stickers.js  the sticker library (original one-colour SVG drawings)
js/freedesign.js  free design: selection handles, snapping, pinch, layers
supabase/002_group_links.sql … 005_public_templates.sql   updates for older installs
```

## Run it yourself

It takes about 15 minutes with free Supabase and Netlify accounts. See **[docs/SETUP.md](docs/SETUP.md)**.

## What's next

- Per-invitation WhatsApp link previews showing the couple's names and photo, using a small server function.
- Separate RSVPs for multiple events, such as the akad nikah, tea ceremony and reception.
- A one-tap reminder message to everyone who hasn't replied.

## Licence

MIT. See [LICENSE](LICENSE).