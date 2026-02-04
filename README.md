# Dot Diary

Dot Diary is a minimalist web app for tracking daily habits/events with colored dots.

## Features

- Desktop year view and mobile month view
- Custom dot types with colors
- Add/remove dots per day
- Drag dots to reposition and persist their placement
- Short handwritten-style note per day (max 5 words)
- Settings modal with:
  - Dot type management (rename/delete/permanent delete)
  - Start weeks on Monday toggle (month view)
  - Light/dark mode
  - Data export/import (JSON)

## Tech

- Vanilla HTML, CSS, and JavaScript
- Local storage for persistence

## Run locally

Because this is a static app, you can open `index.html` directly or run a local server:

```bash
cd "/Users/brandonhaslegs/Code/Dot Diary"
python3 -m http.server 8788
```

Then visit:

`http://127.0.0.1:8788`

## Data ownership

You can export all app data from Settings and import it later on another device.

