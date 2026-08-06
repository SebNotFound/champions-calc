# Porting the calculator from React to Svelte

These are my notes from rebuilding the Champions damage calculator's UI in Svelte
5, while keeping the original React app untouched and live. I wrote them so the
next person (or future me) can see how the two frameworks map onto each other,
and why the port was mostly mechanical.

## The one idea that made this easy

Before writing a single Svelte component I asked one question: how much of the app
is actually React?

The answer was "almost none of it". The damage math, the Champions stat model,
the Mega data, the `@smogon/calc` bridge and the recognizer are all plain
TypeScript with no React import anywhere. They live in `src/champions` and
`src/recognition`. React only shows up in `src/ui`.

So the port was never "rewrite the calculator". It was "write a new set of
components against a core that already exists". The Svelte workspace imports that
core directly with a Vite alias (`@core`), and even imports the same CSS files, so
the two UIs look identical without copying any styles.

If your own project mixes business logic and UI in the same files, do that split
first. It is what turns a scary rewrite into an afternoon of translation.

## React to Svelte, line by line

Once the core is shared, porting a component is just translating idioms. This is
the cheat sheet I ended up using constantly.

### State

```tsx
// React
const [count, setCount] = useState(0);
setCount(count + 1);
```

```svelte
<!-- Svelte 5 -->
let count = $state(0);
count += 1;
```

Svelte's `$state` is deeply reactive, so I can push into an array or assign a
field and the UI updates. No setter, no immutable copy. In the React app I rebuild
the team array on every edit; in Svelte I mutate it in place.

### Derived values

```tsx
const field = useMemo(() => toField(fieldState), [fieldState]);
```

```svelte
const field = $derived(toField(fieldState));
```

No dependency array. Svelte tracks what `$derived` reads and recomputes when those
change. For a block of logic I use `$derived.by(() => { ... })`.

### Side effects

```tsx
useEffect(() => { saveState(state); }, [state]);
```

```svelte
$effect(() => { saveState(appState); });
```

Same story: no dependency array, and returning a function still works as cleanup
(I use that for the async learnset fetch).

### Props

```tsx
function PokemonEditor({ set, onChange, role }: Props) { ... }
```

```svelte
let { set, onChange, role }: Props = $props();
```

I kept the callback-prop style (`onChange`, `onRemove`) rather than Svelte's event
dispatchers, because it maps one to one onto the React components and reads the
same in both codebases.

### Template syntax

JSX expressions become Svelte template blocks.

```tsx
{items.map((x) => <Row key={x.id} x={x} />)}
{open && <Menu />}
value ? <A /> : <B />
```

```svelte
{#each items as x (x.id)}<Row {x} />{/each}
{#if open}<Menu />{/if}
{#if value}<A />{:else}<B />{/if}
```

Attributes: `className` becomes `class`, `onClick` becomes `onclick`, and
`{x}` is shorthand for `x={x}`.

### Events

```tsx
<select onChange={(e) => patch({ nature: e.target.value })}>
```

```svelte
<select onchange={(e) => patch({ nature: e.currentTarget.value })}>
```

Lowercase event names, and I read `e.currentTarget` so the type is the element I
attached to.

## Wiring it up

The whole reuse trick lives in `vite.config.ts`:

```ts
resolve: {
  alias: {
    '@core': '../src/champions',
    '@recognition': '../src/recognition',
    '@styles': '../src',
  },
},
```

Two more details make it work:

- `publicDir` points at the root `../public`, so the bundled Mega sprites resolve.
- The bare imports inside the shared core (`@pkmn/dex`, `@smogon/calc`) resolve
  against the root `node_modules`, because that is where those files physically
  are. So this workspace only installs Svelte and Vite of its own.

The proof that the reuse is literal and not a copy: a production build here emits
the same CSS file hash and the same shared data chunk hash as the React build.

## Two traps that cost me time

I want these written down because both produced errors that did not point at the
real cause.

1. **Do not name a state variable `state`.** Svelte treats `$state` as an
   auto-subscription to a store called `state`, so the moment I wrote
   `let state = $state(...)` the rune stopped resolving and I got a cascade of
   "untyped function calls may not accept type arguments". Renaming it to
   `appState` fixed everything at once. Lesson: `$name` is reserved syntax, so
   avoid variables whose name collides with a rune.

2. **Pin TypeScript to 5.x.** A fresh `npm install` pulled in TypeScript 7, and
   `svelte-check` 4 crashes against it with
   `Cannot read properties of undefined (reading 'useCaseSensitiveFileNames')`.
   Installing `typescript@^5.9` made the checker run.

Smaller habit: annotate the variable rather than the rune, so
`let x: T = $state(...)` instead of `$state<T>(...)`. The second form trips the
type checker in a few spots.

## Where the port stands

Done: the header (weather, terrain, theme), the team lists, the attacker editor
(species and Mega, nature, item, ability, status, Stat Points, moves) and the
enemy targets with live damage, KO chances and the shared damage bars.

Still to bring over from React: arena mode, the import dialogs (pokepaste, the
photo and Team Preview recognition, the team report), the hover matchup preview,
the per-side conditions (screens and Helping Hand), boosts, and drag to reorder.
