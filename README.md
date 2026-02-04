🔴🟠🟡🟢🔵🟣
# Dot Diary

Dot Diary is a minimalist web app for tracking daily habits/events with colored dots.

<img width="1455" height="1106" alt="image" src="https://github.com/user-attachments/assets/0bdc9376-ebbf-4683-8c2a-c95f11359a3a" />

## Features

- Desktop year view and mobile month view
- Custom dot types with colors
- Add/remove dots per day
- Drag dots to reposition and persist their placement
- Short handwritten-style note per day
- Settings modal with:
  - Dot type management (rename/delete/permanent delete)
  - Start weeks on Monday toggle (for month view)
  - Light/dark mode
  - Data export/import (JSON)

<img width="1017" height="1019" alt="image" src="https://github.com/user-attachments/assets/95c4f618-56cc-4c93-bd99-c87006bb39dc" />

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
