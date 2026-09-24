# Visa Agency Helper (Microsoft Edge / Chrome extension)

A small Manifest V3 extension that helps you **prepare** a visa applicant before you book. It is a companion to the Visa Agency Panel.

**It does not connect to the IVAC appointment site or any other website.** It has no content scripts, does not read or fill any page, and does no automation. It only shows a checklist and opens a link you set.

## What it does
- Document checklist that changes with the visa type (tourist, medical, student, business, other)
- Progress bar and a "ready" note when every document is ticked
- A notes box for the current applicant
- A button that opens your panel (set the link in the options page)

All data stays in the browser (`chrome.storage.local`). No passwords, no OTP, no automation.

## Install (Edge or Chrome)
1. Open `edge://extensions` (or `chrome://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose this `extension` folder.
4. Click the puzzle-piece icon and pin **Visa Agency Helper**.
5. Open the options page once to paste your panel link.

## Files
- `manifest.json` — extension definition (only the `storage` permission)
- `popup.html/.css/.js` — the checklist popup
- `options.html/.js` — set your panel link
- `icons/` — toolbar icons
