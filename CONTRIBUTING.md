# Contributing

Thanks for wanting to help. This is a small, free fan tool, so the process is light.

## How to send a change

1. Fork the repo and clone your fork.
2. Make a branch for your change.
3. Build and test locally (see below) so you know it runs.
4. Open a pull request against `main`. I review and merge from there, so direct pushes to
   `main` are off, and that is on purpose: it means every change gets a look first.

If you are planning something large, open an issue first and we can talk it through before you
put in the hours. Saves us both from a big PR that goes a direction I cannot take.

## Running it locally

You need Node 20 or newer.

```bash
npm install
npm run dev      # start the dev server, usually http://localhost:5173
npm test         # run the test suite
npm run build    # production build into dist
```

Please make sure `npm test` and `npm run build` both pass before you open a PR.

## How the code is laid out

The project is split so the maths never depends on React:

- `src/champions/` is the pure calculation layer (stats, the `@smogon/calc` bridge, custom
  abilities). No React in here. This is where damage logic lives, and it is the easiest place
  to add tests.
- `src/ui/` is the React layer (the editors, the cards, the arena).
- `src/recognition/` is the team import (text parsing, on device sprite matching, OCR).

The file headers explain the why of each part, so start there when you are finding your way
around. Comments are written the way you would explain a thing to another person, not a restate
of the line, so please keep that style and avoid long dashes in prose.

## Good first things to pick up

- Filling in more of the roster and the mega formes.
- Niche items and abilities the engine does not cover yet.
- The photo import. The on device reading of a Team Preview is still the rough part,
  especially the enemy team and low resolution shots, so any robustness there helps a lot.

## License of contributions

By opening a pull request you agree that your contribution is licensed under the same
AGPL-3.0-or-later as the rest of the project. Please do not paste in code you do not have the
right to share.
