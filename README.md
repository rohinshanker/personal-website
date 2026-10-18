# rohin.shanker.me

Source for [rohin.shanker.me](https://rohin.shanker.me/): a personal website
styled as a Windows 98 desktop, with draggable app windows, four games with
verified leaderboards, a calendar, a Clash Royale stats app and a few
surprises.

## Build your own desktop

The reusable parts of this site (window manager, dock, calendar, carousels,
98.css, the Windows icon library, and downloadable games and apps) are
published as a separate starter kit:

**[rohinshanker/win98-site-kit](https://github.com/rohinshanker/win98-site-kit)**

```bash
npx github:rohinshanker/win98-site-kit init my-desktop
cd my-desktop
npx github:rohinshanker/win98-site-kit add snake minesweeper solitaire sudoku
npx github:rohinshanker/win98-site-kit serve
```

The kit has no backend; the leaderboards, verified game sessions and
Administrator tools stay here.

## Working in this repository

Read `docs/notes/tickets/INDEX.md` before significant work and the runbooks
in `docs/validation/`. The quality gates are described in
`docs/validation/site-quality-gates.md`.
