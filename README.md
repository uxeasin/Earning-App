# Visa Agency Panel

A simple web app for one person running a visa-processing service. It tracks clients, their applicants (files), documents, appointment dates and payments. **Booking itself is done by hand on the official IVAC website.** This app only organises the work around it.

## Features
- Dashboard: total / pending / booked / paid, counted in sets (clients) and files (applicants)
- Visa category breakdown (tourist, medical, student, business, other)
- Money summary: service fees, IVAC fees, received, due
- Per-applicant document checklist (passport, form, photo, supporting documents)
- Search and filters by status and visa type
- Backup (download JSON) and Restore

## Run it
No install or build needed. Open `index.html` in a browser, or host the folder on GitHub Pages / Netlify.

## Data
Everything is stored in the browser (localStorage) on the device you use. It is **not** synced between devices. Clearing browser data deletes it, so use **Backup** regularly and keep the file somewhere safe; it contains passport numbers.
