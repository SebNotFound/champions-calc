/**
 * Champions Damage Calculator — root view.
 *
 * Layout: [ My Team ] [ Attacker editor ] [ Enemy targets ].
 *  • "My Team" lists your active team's Pokémon; click one to load it into the
 *    attacker editor (edits save back to that member).
 *  • Each side keeps up to 10 saved teams (localStorage), switchable instantly,
 *    importable from a pokepaste.
 *  • The enemy team's Pokémon are the calc targets; every attacker move is
 *    scored against each, live.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Pokemon } from '@smogon/calc';
import { PokemonEditor } from './ui/PokemonEditor';
import { DefenderCard } from './ui/DefenderCard';
import { IncomingPanel } from './ui/IncomingPanel';
import { TeamColumn } from './ui/TeamColumn';
import { FieldControls, defaultFieldState, toField, toIncomingField } from './ui/FieldControls';
import type { FieldState } from './ui/FieldControls';
import { SharedDatalists } from './ui/widgets';
import { ImportDialog } from './ui/ImportDialog';
import { PokepasteDialog } from './ui/PokepasteDialog';
import {
  buildPokemon, defaultSet, autofillSet, CHAMPIONS_FORMAT,
  loadState, saveState, seedState, emptyTeam, MAX_TEAMS, MAX_TEAM_SIZE,
} from './champions';
import type { ChampionsSet, Team, SavedState } from './champions';
import './App.css';

type TeamKey = 'playerTeams' | 'enemyTeams';

export default function App() {
  const [state, setState] = useState<SavedState>(() => loadState() ?? seedState());
  const [attackerIdx, setAttackerIdx] = useState(0);
  const [fieldState, setFieldState] = useState<FieldState>(defaultFieldState);
  const [photoSide, setPhotoSide] = useState<null | 'player' | 'enemy'>(null);
  const [pasteSide, setPasteSide] = useState<null | 'player' | 'enemy'>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('champions-calc/theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Mirror every change to localStorage so saved teams survive a refresh.
  useEffect(() => saveState(state), [state]);
  // Apply + remember the theme.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('champions-calc/theme', theme);
  }, [theme]);

  const { playerTeams, enemyTeams, playerTeamIdx, enemyTeamIdx } = state;
  const playerTeam = playerTeams[playerTeamIdx];
  const enemyTeam = enemyTeams[enemyTeamIdx];
  const safeAttackerIdx = Math.min(attackerIdx, playerTeam.members.length - 1);
  const attacker = playerTeam.members[safeAttackerIdx] ?? defaultSet('Garchomp');

  // ---- generic immutable updates ----
  const updateTeamList = (which: TeamKey, idx: number, fn: (t: Team) => Team) =>
    setState((s) => ({ ...s, [which]: s[which].map((t, i) => (i === idx ? fn(t) : t)) }));
  const updateMembers = (which: TeamKey, idx: number, fn: (m: ChampionsSet[]) => ChampionsSet[]) =>
    updateTeamList(which, idx, (t) => ({ ...t, members: fn(t.members) }));

  // ---- attacker (selected member of the active player team) ----
  const updateAttacker = (next: ChampionsSet) =>
    updateMembers('playerTeams', playerTeamIdx, (ms) => ms.map((m, i) => (i === safeAttackerIdx ? next : m)));

  const addPlayerMember = () => {
    if (playerTeam.members.length >= MAX_TEAM_SIZE) return;
    setAttackerIdx(playerTeam.members.length);
    updateMembers('playerTeams', playerTeamIdx, (ms) => [...ms, defaultSet('Snorlax')]);
  };
  const removePlayerMember = (i: number) => {
    if (playerTeam.members.length <= 1) return;
    updateMembers('playerTeams', playerTeamIdx, (ms) => ms.filter((_, j) => j !== i));
    setAttackerIdx((idx) => Math.max(0, Math.min(idx, playerTeam.members.length - 2)));
  };

  // ---- enemy members (the targets) ----
  const updateEnemyMember = (i: number, next: ChampionsSet) =>
    updateMembers('enemyTeams', enemyTeamIdx, (ms) => ms.map((m, j) => (j === i ? next : m)));
  const addEnemyMember = () => {
    if (enemyTeam.members.length < MAX_TEAM_SIZE)
      updateMembers('enemyTeams', enemyTeamIdx, (ms) => [...ms, defaultSet('Amoonguss')]);
  };
  const removeEnemyMember = (i: number) =>
    updateMembers('enemyTeams', enemyTeamIdx, (ms) => ms.filter((_, j) => j !== i));
  // Drag-and-drop: swap two enemy targets (front line = first two), so dropping
  // one onto another exchanges their slots without shuffling everything else.
  const swapEnemyMembers = (from: number, to: number) =>
    updateMembers('enemyTeams', enemyTeamIdx, (ms) => {
      if (from === to || from < 0 || to < 0 || from >= ms.length || to >= ms.length) return ms;
      const next = [...ms];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });

  // ---- team slots ----
  const selectPlayerTeam = (i: number) => { setState((s) => ({ ...s, playerTeamIdx: i })); setAttackerIdx(0); };
  const selectEnemyTeam = (i: number) => setState((s) => ({ ...s, enemyTeamIdx: i }));
  const addPlayerTeam = () => setState((s) => s.playerTeams.length >= MAX_TEAMS ? s
    : { ...s, playerTeams: [...s.playerTeams, emptyTeam(`Team ${s.playerTeams.length + 1}`)], playerTeamIdx: s.playerTeams.length });
  const addEnemyTeam = () => setState((s) => s.enemyTeams.length >= MAX_TEAMS ? s
    : { ...s, enemyTeams: [...s.enemyTeams, emptyTeam(`Enemy ${s.enemyTeams.length + 1}`)], enemyTeamIdx: s.enemyTeams.length });
  const renamePlayerTeam = (name: string) => updateTeamList('playerTeams', playerTeamIdx, (t) => ({ ...t, name }));
  const renameEnemyTeam = (name: string) => updateTeamList('enemyTeams', enemyTeamIdx, (t) => ({ ...t, name }));
  const deletePlayerTeam = () => setState((s) => s.playerTeams.length <= 1 ? s
    : { ...s, playerTeams: s.playerTeams.filter((_, i) => i !== s.playerTeamIdx), playerTeamIdx: Math.max(0, s.playerTeamIdx - 1) });
  const deleteEnemyTeam = () => setState((s) => s.enemyTeams.length <= 1 ? s
    : { ...s, enemyTeams: s.enemyTeams.filter((_, i) => i !== s.enemyTeamIdx), enemyTeamIdx: Math.max(0, s.enemyTeamIdx - 1) });

  // ---- pokepaste import (replaces the active slot on the chosen side) ----
  const importPokepaste = (sets: ChampionsSet[]) => {
    if (pasteSide === 'player') { updateMembers('playerTeams', playerTeamIdx, () => sets); setAttackerIdx(0); }
    else if (pasteSide === 'enemy') { updateMembers('enemyTeams', enemyTeamIdx, () => sets); }
    setPasteSide(null);
  };

  // ---- Photo import: fills one side from the reviewed species list ----
  // Detected Pokémon arrive with their most-used Champions set (same fill as
  // picking a species by hand), so they're battle-ready, not blank.
  const handlePhotoImport = (side: 'player' | 'enemy', species: string[]) => {
    const sets = species.slice(0, 6).map((s) => autofillSet(s));
    if (!sets.length) return;
    if (side === 'player') {
      updateMembers('playerTeams', playerTeamIdx, () => sets);
      setAttackerIdx(0);
    } else {
      updateMembers('enemyTeams', enemyTeamIdx, () => sets);
    }
  };

  const attackerMon = useMemo<Pokemon | null>(() => {
    try { return buildPokemon(attacker); } catch { return null; }
  }, [attacker]);
  const attackerMoves = useMemo(
    () => Array.from(new Set((attacker.moves ?? []).map((m) => m.trim()).filter(Boolean))),
    [attacker.moves],
  );
  const field = useMemo(() => toField(fieldState), [fieldState]);          // outgoing: you → them
  const incomingField = useMemo(() => toIncomingField(fieldState), [fieldState]); // incoming: them → you

  // Reset every battle condition: field (weather/terrain/screens/Helping Hand)
  // plus each active Pokémon's status and stat boosts.
  const handleResetConditions = () => {
    setFieldState(defaultFieldState);
    const clear = (m: ChampionsSet): ChampionsSet => ({ ...m, status: undefined, boosts: {} });
    updateMembers('playerTeams', playerTeamIdx, (ms) => ms.map(clear));
    updateMembers('enemyTeams', enemyTeamIdx, (ms) => ms.map(clear));
  };

  return (
    <div className="app">
      <SharedDatalists />

      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">◓</div>
          <div className="brand-text">
            <h1>Champions Calc</h1>
            <span className="reg-badge">
              {CHAMPIONS_FORMAT.regulation} · Lv{CHAMPIONS_FORMAT.level} {CHAMPIONS_FORMAT.gameType}
            </span>
          </div>
        </div>
        <button
          className="theme-toggle"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          title="Toggle dark mode"
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      <FieldControls value={fieldState} onChange={setFieldState} onReset={handleResetConditions} />

      <main className="calc-layout">
        <TeamColumn
          title="My Team"
          teams={playerTeams}
          activeIdx={playerTeamIdx}
          selectedMemberIdx={safeAttackerIdx}
          onSelectMember={setAttackerIdx}
          onSelectTeam={selectPlayerTeam}
          onAddTeam={addPlayerTeam}
          onRenameTeam={renamePlayerTeam}
          onDeleteTeam={deletePlayerTeam}
          onImportText={() => setPasteSide('player')}
          onImportPhoto={() => setPhotoSide('player')}
          onAddMember={addPlayerMember}
          onRemoveMember={removePlayerMember}
        />

        <section className="center-col">
          {/* Top line: your attacker vs the two active enemies. */}
          <div className="battle-row">
            <div className="attacker-col">
              <PokemonEditor
                key={`p-${playerTeamIdx}-${safeAttackerIdx}`}
                set={attacker}
                onChange={updateAttacker}
                role="attacker"
                title="Attacker"
              />
              <IncomingPanel
                attacker={attackerMon}
                attackerName={attackerMon?.name ?? attacker.species}
                enemies={enemyTeam.members.slice(0, 2)}
                field={incomingField}
              />
            </div>
            {enemyTeam.members.slice(0, 2).map((d, i) => (
              <DefenderCard
                key={`e-${enemyTeamIdx}-${i}`}
                index={i}
                set={d}
                onChange={(next) => updateEnemyMember(i, next)}
                onRemove={() => removeEnemyMember(i)}
                onSwap={swapEnemyMembers}
                attacker={attackerMon}
                attackerMoves={attackerMoves}
                field={field}
              />
            ))}
            {enemyTeam.members.length === 0 && (
              <p className="results-hint">No targets — add one in the Enemy Team box →</p>
            )}
          </div>

          {/* The rest of the enemy team underneath. */}
          {enemyTeam.members.length > 2 && (
            <div className="bench-block">
              <h2 className="col-title">More targets</h2>
              <div className="defenders-grid">
                {enemyTeam.members.slice(2).map((d, i) => {
                  const idx = i + 2;
                  return (
                    <DefenderCard
                      key={`e-${enemyTeamIdx}-${idx}`}
                      index={idx}
                      set={d}
                      onChange={(next) => updateEnemyMember(idx, next)}
                      onRemove={() => removeEnemyMember(idx)}
                      onSwap={swapEnemyMembers}
                      attacker={attackerMon}
                      attackerMoves={attackerMoves}
                      field={field}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <TeamColumn
          title="Enemy Team"
          teams={enemyTeams}
          activeIdx={enemyTeamIdx}
          onSelectTeam={selectEnemyTeam}
          onAddTeam={addEnemyTeam}
          onRenameTeam={renameEnemyTeam}
          onDeleteTeam={deleteEnemyTeam}
          onImportText={() => setPasteSide('enemy')}
          onImportPhoto={() => setPhotoSide('enemy')}
          onAddMember={addEnemyMember}
          onRemoveMember={removeEnemyMember}
          addLabel="+ Add target"
        />
      </main>

      <footer className="app-footer">
        Stats use the Champions Stat Points model (66 SP, 32/stat, perfect IVs).
        Damage by <code>@smogon/calc</code>. Mega &amp; roster data is a work in progress.
      </footer>

      <ImportDialog side={photoSide} onClose={() => setPhotoSide(null)} onImport={handlePhotoImport} />
      <PokepasteDialog
        open={pasteSide !== null}
        side={pasteSide ?? 'player'}
        onClose={() => setPasteSide(null)}
        onImport={importPokepaste}
      />
    </div>
  );
}
