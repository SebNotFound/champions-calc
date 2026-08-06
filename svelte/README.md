# Champions Calc, the Svelte UI

A second, parallel front end for the Champions damage calculator, written in
Svelte 5. It is **not a fork**: it imports the very same framework-free core as
the React app, and the very same stylesheets. Only the component layer differs.

The point of this workspace is to show that the calculator's architecture keeps
its domain logic independent of any UI framework. The same core already drives
the website (React), the Windows overlay (Tauri) and the Android overlay
(WebView), and now a Svelte UI as well.

## What is shared, and what is not

| | Where it lives | Reused here? |
|---|---|---|
| Champions stat model, Megas, `@smogon/calc` bridge | `../src/champions` | yes, via `@core` |
| Recognition engine | `../src/recognition` | yes, via `@recognition` |
| Stylesheets (`index.css`, `App.css`) | `../src` | yes, via `@styles` |
| Sprites (Champions-original Megas) | `../public` | yes (`publicDir`) |
| Components | `../src/ui` (React) / `src/lib` (Svelte) | no, rewritten |

The reuse is literal, not approximate: a production build here emits the **same
CSS file hash** and the **same shared data chunk hash** as the React build.

The one exception is `src/lib/field.ts` (weather/terrain/screens helpers). That
logic is framework-free, but in the React app it lives inside `FieldControls.tsx`
next to its components, so it can't be imported from here. Lifting it into the
core would remove the duplication.

Bare imports inside `../src` (`@pkmn/dex`, `@smogon/calc`, …) resolve against the
**root** `node_modules`, because that's where those files live — so this
workspace only installs Svelte and Vite of its own.

## Running it

```bash
npm install      # once, in this folder
npm run dev      # http://localhost:5174
npm run build    # svelte-check + vite build
npm run check    # type-check only
```

## Gotchas worth knowing

- **Never name a variable `state`.** Svelte reads `$state` as an auto-subscription
  to a store called `state`, so the `$state` rune silently stops resolving and you
  get a cascade of "untyped function call" errors. This app uses `appState`.
- **TypeScript is pinned to 5.x.** `svelte-check` 4.x crashes against TypeScript 7
  (`Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')`).
- Annotate rune-backed variables (`let x: T = $state(...)`) rather than passing
  type arguments (`$state<T>(...)`).

## Status

Ported so far: the header (weather/terrain, theme), the team lists, the attacker
editor (species/Mega, nature, item, ability, status, Stat Points, moves) and the
enemy targets with live damage, KO chances and the shared damage bars.

Still to port from the React app: arena mode, the import dialogs (pokepaste, photo
/ Team Preview recognition, team report), the hover matchup preview, per-side
conditions (screens, Helping Hand), boosts, and drag-to-reorder.
