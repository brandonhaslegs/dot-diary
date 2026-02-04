🔴🟠🟡🟢🔵🟣
# Dot Diary

Dot Diary is a minimalist web app for tracking daily habits/events with colored dots.

![year view](https://github.com/user-attachments/assets/91d3a2e6-3804-4246-a564-d7e6765420b4)

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

<img width="839" height="1020" alt="image" src="https://github.com/user-attachments/assets/942966c2-4f09-479f-a206-121a0888377d" />

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
