<script lang="ts">
  /**
   * Champions Damage Calculator, the Svelte UI.
   *
   * A parallel front end to the React app, not a fork: every import below with an
   * `@core` path is the *same* module the React app and the two overlays use, and
   * the styles are the same stylesheets. Only this component layer is Svelte.
   */
  import {
    loadState, saveState, seedState, defaultSet, buildPokemon,
    CHAMPIONS_FORMAT, MAX_TEAM_SIZE,
  } from '@core';
  import type { ChampionsSet, SavedState } from '@core';
  import type { Pokemon } from '@smogon/calc';
  import SharedDatalists from './lib/SharedDatalists.svelte';
  import PokemonEditor from './lib/PokemonEditor.svelte';
  import DefenderCard from './lib/DefenderCard.svelte';
  import WeatherTerrain from './lib/WeatherTerrain.svelte';
  import Sprite from './lib/Sprite.svelte';
  import { defaultFieldState, toField, type FieldState } from './lib/field';

  // NB: never call this `state`. Svelte would read `$state` as an auto-subscription
  // to a store named `state` rather than as the rune.
  let appState: SavedState = $state(loadState() ?? seedState());
  let attackerIdx = $state(0);
  let fieldState: FieldState = $state(defaultFieldState());
  let theme: 'light' | 'dark' = $state(
    (localStorage.getItem('champions-calc/theme') as 'light' | 'dark' | null) ?? 'dark',
  );

  // Mirror every change to localStorage so saved teams survive a refresh.
  $effect(() => { saveState(appState); });
  // Apply + remember the theme.
  $effect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('champions-calc/theme', theme);
  });

  const playerTeam = $derived(appState.playerTeams[appState.playerTeamIdx]);
  const enemyTeam = $derived(appState.enemyTeams[appState.enemyTeamIdx]);
  const safeAttackerIdx = $derived(Math.min(attackerIdx, playerTeam.members.length - 1));
  const attacker = $derived(playerTeam.members[safeAttackerIdx] ?? defaultSet('Garchomp'));

  const attackerMon = $derived.by<Pokemon | null>(() => {
    try { return buildPokemon(attacker); } catch { return null; }
  });
  const attackerMoves = $derived(
    Array.from(new Set((attacker.moves ?? []).map((m) => m.trim()).filter(Boolean))),
  );
  const field = $derived(toField(fieldState));

  // Svelte's deep $state means we mutate in place instead of rebuilding the tree.
  const updateAttacker = (next: ChampionsSet) => {
    playerTeam.members[safeAttackerIdx] = next;
  };
  const updateEnemyMember = (i: number, next: ChampionsSet) => {
    enemyTeam.members[i] = next;
  };
  const removeEnemyMember = (i: number) => {
    enemyTeam.members.splice(i, 1);
  };
  const addEnemyMember = () => {
    if (enemyTeam.members.length < MAX_TEAM_SIZE) enemyTeam.members.push(defaultSet('Amoonguss'));
  };
</script>

<div class="app">
  <SharedDatalists />

  <header class="app-header">
    <div class="brand">
      <div class="brand-exo" title="EXO">
        <img class="brand-ex" src="/ex.png" alt="EXO" />
      </div>
      <div class="brand-text">
        <h1 class="wordmark">CHAMPIONS<span>CALC</span></h1>
        <span class="reg-badge">
          {CHAMPIONS_FORMAT.regulation} · Lv{CHAMPIONS_FORMAT.level} · {CHAMPIONS_FORMAT.gameType} · Svelte
        </span>
      </div>
    </div>

    <WeatherTerrain value={fieldState} onChange={(next) => (fieldState = next)} />

    <div class="header-right">
      <button
        class="theme-toggle"
        onclick={() => (theme = theme === 'dark' ? 'light' : 'dark')}
        title="Toggle dark mode"
        aria-label="Toggle dark mode"
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </div>
  </header>

  <main class="calc-layout">
    <div class="side-stack">
      <div class="team-col team-col--ally">
        <h2 class="col-title">My Team</h2>
        <div class="member-list">
          {#each playerTeam.members as m, i (i)}
            <button
              class="member{i === safeAttackerIdx ? ' active' : ''}"
              onclick={() => (attackerIdx = i)}
              title="Load {m.megaForme ?? m.species} into the attacker editor"
            >
              <Sprite class="member-sprite" species={m.megaForme ?? m.species} />
              <span class="member-name">{m.megaForme ?? m.species}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <section class="center-col">
      <div class="battle-row">
        <div class="attacker-col">
          <PokemonEditor
            set={attacker}
            onChange={updateAttacker}
            role="attacker"
            title="Attacker"
          />
        </div>

        {#each enemyTeam.members.slice(0, 2) as d, i (i)}
          <DefenderCard
            set={d}
            onChange={(next) => updateEnemyMember(i, next)}
            onRemove={() => removeEnemyMember(i)}
            index={i}
            attacker={attackerMon}
            {attackerMoves}
            {field}
          />
        {/each}

        {#if enemyTeam.members.length === 0}
          <p class="results-hint">No targets. Add one below.</p>
        {/if}
      </div>

      {#if enemyTeam.members.length > 2}
        <div class="bench-block">
          <h2 class="col-title">More targets</h2>
          <div class="defenders-grid">
            {#each enemyTeam.members.slice(2) as d, i (i + 2)}
              <DefenderCard
                set={d}
                onChange={(next) => updateEnemyMember(i + 2, next)}
                onRemove={() => removeEnemyMember(i + 2)}
                index={i + 2}
                attacker={attackerMon}
                {attackerMoves}
                {field}
              />
            {/each}
          </div>
        </div>
      {/if}
    </section>

    <div class="side-stack">
      <div class="team-col team-col--foe">
        <h2 class="col-title">Enemy Team</h2>
        <div class="member-list">
          {#each enemyTeam.members as m, i (i)}
            <span class="member">
              <Sprite class="member-sprite" species={m.megaForme ?? m.species} />
              <span class="member-name">{m.megaForme ?? m.species}</span>
            </span>
          {/each}
          <button
            class="member-add"
            onclick={addEnemyMember}
            disabled={enemyTeam.members.length >= MAX_TEAM_SIZE}
          >+ Add target</button>
        </div>
      </div>
    </div>
  </main>

  <footer class="app-footer">
    <div class="footer-text">
      <p>
        The Svelte UI. Same Champions core (66 SP stat model, <code>@smogon/calc</code>)
        and the same stylesheets as the React app; only the components differ.
      </p>
    </div>
  </footer>
</div>
