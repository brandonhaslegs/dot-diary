🔴🟠🟡🟢🔵🟣
# Dot Diary

Dot Diary is a minimalist web app for tracking your life with colored dots.

![year view](https://github.com/user-attachments/assets/91d3a2e6-3804-4246-a564-d7e6765420b4)

## Features

- Marketing landing page and in-app login flow
- Desktop year view and mobile month view
- Onboarding flow for first-time setup
- Custom dot types with color changes
- Add/remove dots per day
- Drag dots to reposition and persist their placement
- Short note per day (normalized to a concise format)
- Dot type management (rename/delete/permanently delete)
- Suggested dot types with hide/show toggle
- Start weeks on Monday toggle (month view)
- Light/dark mode
- Keyboard shortcuts + keyboard hint toggle
- Data export/import (JSON)
- Email magic-link auth and cloud sync across devices

<img width="839" height="1020" alt="image" src="https://github.com/user-attachments/assets/942966c2-4f09-479f-a206-121a0888377d" />

## Tech

- Vanilla HTML, CSS, and JavaScript
- LocalStorage persistence
- Supabase Auth + data sync

## Run locally

Because this is a static app, you can open `index.html` directly or run a local server:

```bash
cd "/Users/brandonhaslegs/Code/Dot Diary"
python3 -m http.server 8788
```

Then visit:

`http://127.0.0.1:8788`

## Sync simulation test

Run the local two-device sync simulator:

```bash
cd "/Users/brandonhaslegs/Code/Dot Diary"
node --test tests/sync-simulator.test.mjs
```
