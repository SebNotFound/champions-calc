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
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Pokemon } from '@smogon/calc';
import { MatchupPreview } from './ui/MatchupPreview';
import { ArenaCard, type Battler } from './ui/ArenaCard';
import { PokemonEditor } from './ui/PokemonEditor';
import { DefenderCard } from './ui/DefenderCard';
import { IncomingPanel } from './ui/IncomingPanel';
import { TeamColumn } from './ui/TeamColumn';
import { ArenaRoster } from './ui/ArenaRoster';
import { WeatherTerrain, SideConditions, defaultFieldState, toField, toIncomingField } from './ui/FieldControls';
import type { FieldState } from './ui/FieldControls';
import { SharedDatalists } from './ui/widgets';
import { ImportDialog } from './ui/ImportDialog';
import {
  TauriWindowControls, useTauriOverlayChrome, useOverlayEvent,
  AndroidOverlayControls, useAndroidOverlayChrome, isAndroidOverlay,
} from './ui/tauri';
import { TeamReportDialog } from './ui/TeamReportDialog';
import { BrandLogo } from './ui/BrandLogo';
import { PokepasteDialog } from './ui/PokepasteDialog';
import {
  buildPokemon, defaultSet, autofillSet,
  loadState, saveState, seedState, emptyTeam, MAX_TEAMS, MAX_TEAM_SIZE,
} from './champions';
import type { ChampionsSet, Team, SavedState } from './champions';
import './App.css';

type TeamKey = 'playerTeams' | 'enemyTeams';

const PREVIEW_W = 304;
/**
 * Place the hover preview next to the hovered row. In the normal layout it pops
 * toward the centre (player on the right, enemy on the left). In arena mode the
 * teams sit on the two sides, so it pops OUTWARD instead (your team to the left,
 * the enemy to the right), which keeps it off the rest of the roster and makes
 * it easier to run down the list. We overlap the row by 1px so there's no dead
 * gap to cross on the way to the card.
 */
function previewStyle(rect: DOMRect, placement: 'left' | 'right'): CSSProperties {
  const top = Math.max(12, Math.min(rect.top - 4, window.innerHeight - 300));
  const base: CSSProperties = { position: 'fixed', top, width: PREVIEW_W, zIndex: 60 };
  return placement === 'left'
    ? { ...base, right: window.innerWidth - rect.left - 1 }
    : { ...base, left: rect.right - 1 };
}

/** The first two members of a team, pre-built as battlers for the arena cards. */
function toBattlers(members: ChampionsSet[]): Battler[] {
  return members.slice(0, 2).map((s) => {
    let mon: Pokemon | null = null;
    try { mon = buildPokemon(s); } catch { mon = null; }
    return {
      name: s.megaForme ?? s.species,
      species: s.megaForme ?? s.species,
      mon,
      moves: Array.from(new Set((s.moves ?? []).map((m) => m.trim()).filter(Boolean))),
    };
  });
}

export default function App() {
  const [state, setState] = useState<SavedState>(() => loadState() ?? seedState());
  const [attackerIdx, setAttackerIdx] = useState(0);
  const [fieldState, setFieldState] = useState<FieldState>(defaultFieldState);
  const [photoSide, setPhotoSide] = useState<null | 'player' | 'enemy'>(null);
  // When the import dialog is opened by the overlay "Capture" button, grab the device immediately.
  const [photoAutoCapture, setPhotoAutoCapture] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [pasteSide, setPasteSide] = useState<null | 'player' | 'enemy'>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('champions-calc/theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light'; // the Pokedex redesign is light-first; toggle for the Night HUD
  });
  // Arena mode: same calc, a mirrored "VS" disposition. Off by default, remembered.
  const [arena, setArena] = useState<boolean>(() => localStorage.getItem('champions-calc/arena') === '1');

  // Mirror every change to localStorage so saved teams survive a refresh.
  useEffect(() => saveState(state), [state]);
  // Apply + remember the theme.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('champions-calc/theme', theme);
  }, [theme]);
  useEffect(() => { localStorage.setItem('champions-calc/arena', arena ? '1' : '0'); }, [arena]);

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
  // Same drag-to-swap for your own team, so in arena mode you choose your two
  // active battlers (the first two) the same way you do for the enemy.
  const swapPlayerMembers = (from: number, to: number) =>
    updateMembers('playerTeams', playerTeamIdx, (ms) => {
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

  // Arena mode's two active battlers per side (the first two members), pre-built.
  const playerBattlers = useMemo(() => toBattlers(playerTeam.members), [playerTeam.members]);
  const enemyBattlers = useMemo(() => toBattlers(enemyTeam.members), [enemyTeam.members]);

  // ---- hover matchup preview ----
  // Hovering a list member pops a focused damage card next to it. A short close
  // delay (cleared when the cursor moves onto the card) keeps it open so the
  // enemy tabs stay clickable.
  const [hover, setHover] = useState<{ side: 'player' | 'enemy'; index: number; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const onHover = (side: 'player' | 'enemy') => (index: number | null, rect: DOMRect | null) => {
    window.clearTimeout(hoverTimer.current);
    if (index === null || !rect) hoverTimer.current = window.setTimeout(() => setHover(null), 400);
    else setHover({ side, index, rect });
  };
  const keepPreview = () => window.clearTimeout(hoverTimer.current);
  const closePreview = () => { hoverTimer.current = window.setTimeout(() => setHover(null), 400); };

  // Build the preview's attacker + targets from whichever member is hovered.
  const preview = useMemo(() => {
    if (!hover) return null;
    if (hover.side === 'enemy') {
      const tgt = enemyTeam.members[hover.index];
      if (!tgt) return null;
      return { attacker: attackerMon, attackerName: attackerMon?.name ?? attacker.species, moves: attackerMoves, targets: [tgt], rect: hover.rect, side: hover.side };
    }
    const src = playerTeam.members[hover.index];
    if (!src) return null;
    let mon: Pokemon | null = null;
    try { mon = buildPokemon(src); } catch { mon = null; }
    return { attacker: mon, attackerName: src.megaForme ?? src.species, moves: src.moves ?? [], targets: enemyTeam.members.slice(0, 2), rect: hover.rect, side: hover.side };
  }, [hover, enemyTeam.members, playerTeam.members, attackerMon, attacker.species, attackerMoves]);

  // Reset every battle condition: field (weather/terrain/screens/Helping Hand)
  // plus each active Pokémon's status and stat boosts.
  const handleResetConditions = () => {
    setFieldState(defaultFieldState);
    const clear = (m: ChampionsSet): ChampionsSet => ({ ...m, status: undefined, boosts: {} });
    updateMembers('playerTeams', playerTeamIdx, (ms) => ms.map(clear));
    updateMembers('enemyTeams', enemyTeamIdx, (ms) => ms.map(clear));
  };

  // The layout pieces are defined once here, then arranged two ways below (the
  // normal three-column layout, or the mirrored arena layout). Same components,
  // same props, same behaviour, so drag/drop, hover and the calc are identical
  // in both. Only the disposition changes.
  const playerColumn = (
    <TeamColumn
      title="My Team"
      variant="ally"
      teams={playerTeams}
      activeIdx={playerTeamIdx}
      selectedMemberIdx={safeAttackerIdx}
      onSelectMember={setAttackerIdx}
      onSelectTeam={selectPlayerTeam}
      onAddTeam={addPlayerTeam}
      onRenameTeam={renamePlayerTeam}
      onDeleteTeam={deletePlayerTeam}
      onImportText={() => setPasteSide('player')}
      onImportPhoto={() => { setPhotoAutoCapture(false); setPhotoSide('player'); }}
      onImportReport={() => setReportOpen(true)}
      onAddMember={addPlayerMember}
      onRemoveMember={removePlayerMember}
      onMemberReorder={swapPlayerMembers}
      onHoverMember={onHover('player')}
    />
  );
  const playerConditions = (
    <SideConditions
      variant="ally"
      title="Your side"
      screens={fieldState.yours}
      onScreens={(c) => setFieldState((s) => ({ ...s, yours: { ...s.yours, ...c } }))}
      helpingHand={fieldState.helpingHand}
      onHelpingHand={(v) => setFieldState((s) => ({ ...s, helpingHand: v }))}
    />
  );
  const enemyColumn = (
    <TeamColumn
      title="Enemy Team"
      variant="foe"
      teams={enemyTeams}
      activeIdx={enemyTeamIdx}
      onSelectTeam={selectEnemyTeam}
      onAddTeam={addEnemyTeam}
      onRenameTeam={renameEnemyTeam}
      onDeleteTeam={deleteEnemyTeam}
      onImportText={() => setPasteSide('enemy')}
      onImportPhoto={() => { setPhotoAutoCapture(false); setPhotoSide('enemy'); }}
      onCapture={() => { setPhotoAutoCapture(true); setPhotoSide('enemy'); }}
      onAddMember={addEnemyMember}
      onRemoveMember={removeEnemyMember}
      onMemberReorder={swapEnemyMembers}
      addLabel="+ Add target"
      onHoverMember={onHover('enemy')}
    />
  );
  const enemyConditions = (
    <SideConditions
      variant="foe"
      title="Enemy side"
      screens={fieldState.theirs}
      onScreens={(c) => setFieldState((s) => ({ ...s, theirs: { ...s.theirs, ...c } }))}
      helpingHand={fieldState.enemyHelpingHand}
      onHelpingHand={(v) => setFieldState((s) => ({ ...s, enemyHelpingHand: v }))}
    />
  );
  const attackerBlock = (
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
  );
  const renderDefender = (d: ChampionsSet, idx: number) => (
    <DefenderCard
      key={`e-${enemyTeamIdx}-${idx}`}
      index={idx}
      set={d}
      onChange={(next) => updateEnemyMember(idx, next)}
      onSwap={swapEnemyMembers}
      attacker={attackerMon}
      attackerMoves={attackerMoves}
      field={field}
    />
  );

  // The arena cards are rendered the same way in both arena layouts (the desktop
  // two-column board and the phone overlay's paired board), so define them once.
  // `compact` is the Android overlay: there, each card also gets a `roster` so you
  // can switch the active Pokémon with a tap (drag is impractical on a phone).
  const compact = isAndroidOverlay();
  const renderAllyCard = (set: ChampionsSet, i: number) => (
    <ArenaCard
      key={`pa-${playerTeamIdx}-${i}`}
      set={set}
      onChange={(next) => updateMembers('playerTeams', playerTeamIdx, (ms) => ms.map((m, j) => (j === i ? next : m)))}
      index={i}
      onSwap={swapPlayerMembers}
      role="attacker"
      side="ally"
      title={`Your ${i + 1}`}
      attackers={enemyBattlers}
      field={incomingField}
      roster={compact ? playerTeam.members : undefined}
    />
  );
  const renderFoeCard = (set: ChampionsSet, i: number) => (
    <ArenaCard
      key={`ea-${enemyTeamIdx}-${i}`}
      set={set}
      onChange={(next) => updateEnemyMember(i, next)}
      index={i}
      onSwap={swapEnemyMembers}
      role="defender"
      side="foe"
      title={`Target ${i + 1}`}
      attackers={playerBattlers}
      field={field}
      roster={compact ? enemyTeam.members : undefined}
    />
  );

  useTauriOverlayChrome();
  useAndroidOverlayChrome();
  // Global hotkey (Ctrl+Shift+C in the overlay) -> capture the enemy team.
  useOverlayEvent('overlay-capture-enemy', useCallback(() => {
    setPhotoAutoCapture(true);
    setPhotoSide('enemy');
  }, []));

  return (
    <div className={`app${arena ? ' app--arena' : ''}`}>
      <SharedDatalists />

      <header className="app-header" data-tauri-drag-region>
        <div className="brand">
          <div className="brand-mark">
            <div className="brand-exo" title="EXO">
              <img className="brand-ex" src="/ex.png" alt="EXO" />
              <BrandLogo />
            </div>
            <span className="brand-sub">Champions Damage Calculator</span>
          </div>
        </div>

        <div className="view-toggle" role="tablist" aria-label="Layout">
          <button
            role="tab"
            aria-selected={!arena}
            className={`view-tab${!arena ? ' active' : ''}`}
            onClick={() => setArena(false)}
          >
            Classic
          </button>
          <button
            role="tab"
            aria-selected={arena}
            className={`view-tab${arena ? ' active' : ''}`}
            onClick={() => setArena(true)}
          >
            Battle Arena
          </button>
        </div>

        <div className="header-right">
          <button className="reset-btn" onClick={handleResetConditions} title="Clear weather, terrain, screens, statuses and boosts">
            Reset
          </button>
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title="Toggle light / dark"
            aria-label="Toggle light / dark"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <TauriWindowControls />
          <AndroidOverlayControls />
        </div>
      </header>

      {/* Classic: global weather + terrain in their own bar under the header. In
          arena, the battlefield sits in the field bar between the two sides. */}
      {!arena && (
        <div className="battlefield-bar">
          <span className="bf-label">Battlefield</span>
          <WeatherTerrain value={fieldState} onChange={setFieldState} />
          <span className="bf-hint">Side screens shown with each side ↓</span>
        </div>
      )}

      {arena ? (
        /* Arena: a 2v2 battle. A single management bar up top (both rosters and
           both sides' conditions), then the battleground: your two actives on the
           left, the enemy's two on the right, each a wide card with the damage it
           takes and a tab to pick which of the opposing two is hitting it. */
        <>
          {/* Phones in portrait can't fit the wide 2v2 board, so on the WEBSITE we
              gate it behind a turn-sideways prompt. The Android overlay (compact)
              instead gets a paired board built for portrait, so it skips this. */}
          {!compact && (
            <div className="rotate-gate" role="status">
              <div className="rotate-gate-card">
                <svg className="rotate-gate-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="2" width="14" height="20" rx="2.5" />
                  <path className="rotate-gate-arrow" d="M2.5 13.5a9 9 0 0 0 8 7" fill="none" />
                </svg>
                <p className="rotate-gate-title">Turn your device sideways</p>
                <p className="rotate-gate-text">
                  Arena is a wide 2v2 board, so it needs a landscape screen. Rotate your phone to play
                  it here, or switch to Classic mode.
                </p>
                <button className="reset-btn" onClick={() => setArena(false)}>Use Classic mode instead</button>
              </div>
            </div>
          )}

          {compact ? (
            <div className="arena-bar">
              <div className="arena-flag arena-flag--ally"><span>MY TEAM</span></div>
              {playerColumn}
              {playerConditions}
              {enemyConditions}
              {enemyColumn}
              <div className="arena-flag arena-flag--foe"><span>ENEMY TEAM</span></div>
            </div>
          ) : (
            <>
              {/* Management bar: your roster, a VS badge, the enemy roster. */}
              <div className="arena-manage">
                <ArenaRoster
                  side="ally"
                  label="My Team"
                  teams={playerTeams}
                  activeIdx={playerTeamIdx}
                  onSelectTeam={selectPlayerTeam}
                  onAddTeam={addPlayerTeam}
                  onActivate={(i) => swapPlayerMembers(i, i < 2 ? i : 1)}
                  onAddMember={addPlayerMember}
                  onImport={() => setPasteSide('player')}
                />
                <ArenaRoster
                  side="foe"
                  label="Enemy Team"
                  teams={enemyTeams}
                  activeIdx={enemyTeamIdx}
                  onSelectTeam={selectEnemyTeam}
                  onAddTeam={addEnemyTeam}
                  onActivate={(i) => swapEnemyMembers(i, i < 2 ? i : 1)}
                  onAddMember={addEnemyMember}
                  onImport={() => setPasteSide('enemy')}
                />
              </div>
              {/* Field bar: your side | the battlefield | the enemy side. */}
              <div className="arena-field">
                {playerConditions}
                <div className="arena-field-center">
                  <span className="bf-label">Battlefield</span>
                  <WeatherTerrain value={fieldState} onChange={setFieldState} />
                </div>
                {enemyConditions}
              </div>
            </>
          )}

          {compact ? (
            /* Phone overlay: a paired 2-column board — your #1 vs enemy #1 on the
               first row, your #2 vs enemy #2 below (scroll for the second row). */
            <main className="arena-ground arena-ground--paired">
              {[0, 1].map((i) => (
                <Fragment key={`pair-${i}`}>
                  {playerTeam.members[i]
                    ? renderAllyCard(playerTeam.members[i], i)
                    : <p className="results-hint">Ajoute un Pokémon à ton équipe.</p>}
                  {enemyTeam.members[i]
                    ? renderFoeCard(enemyTeam.members[i], i)
                    : <p className="results-hint">Ajoute une cible ennemie.</p>}
                </Fragment>
              ))}
            </main>
          ) : (
            <main className="arena-ground">
              <div className="arena-col arena-col--ally">
                {playerTeam.members.length === 0
                  ? <p className="results-hint">Add a Pokémon to your team above.</p>
                  : playerTeam.members.slice(0, 2).map((set, i) => renderAllyCard(set, i))}
              </div>

              <div className="arena-vs"><span>VS</span></div>

              <div className="arena-col arena-col--foe">
                {enemyTeam.members.length === 0
                  ? <p className="results-hint">Add a target to the enemy team above.</p>
                  : enemyTeam.members.slice(0, 2).map((set, i) => renderFoeCard(set, i))}
              </div>
            </main>
          )}
        </>
      ) : (
        <main className="calc-layout">
          <div className="side-stack">{playerColumn}{playerConditions}</div>

          <section className="center-col">
            {/* Top line: your attacker vs the two active enemies. */}
            <div className="battle-row">
              {attackerBlock}
              {enemyTeam.members.slice(0, 2).map((d, i) => renderDefender(d, i))}
              {enemyTeam.members.length === 0 && (
                <p className="results-hint">No targets — add one in the Enemy Team box →</p>
              )}
            </div>

            {/* The rest of the enemy team underneath. */}
            {enemyTeam.members.length > 2 && (
              <div className="bench-block">
                <h2 className="col-title">More targets</h2>
                <div className="defenders-grid">
                  {enemyTeam.members.slice(2).map((d, i) => renderDefender(d, i + 2))}
                </div>
              </div>
            )}
          </section>

          <div className="side-stack">{enemyColumn}{enemyConditions}</div>
        </main>
      )}

      <footer className="app-footer">
        <BrandLogo className="footer-logo" />
        <div className="footer-text">
          <p>
            Stats use the Champions Stat Points model (66 SP, 32/stat, perfect IVs).
            Damage by <code>@smogon/calc</code>. Mega &amp; roster data is a work in progress.
            Type icons by{' '}
            <a href="https://github.com/partywhale/pokemon-type-icons" target="_blank" rel="noopener noreferrer">partywhale</a>{' '}
            (MIT).
          </p>
          <p className="footer-credit">
            {/* The previous look, built from the design-stadium branch and served
                as static files under /classic (see public/classic). */}
            Preferred the old look? <a href="/classic/">Use the classic design</a>.
            {' '}Made by <a href="https://github.com/SebNotFound" target="_blank" rel="noopener noreferrer">SebNotFound</a>.
            If you want to help me,{' '}
            <a className="kofi-link" href="https://ko-fi.com/sebnotfound" target="_blank" rel="noopener noreferrer">buy me a Ko-fi ☕</a>
          </p>
        </div>
      </footer>

      {preview && preview.targets.length > 0 && (
        <MatchupPreview
          key={`${preview.side}-${hover?.index ?? 0}`}
          attacker={preview.attacker}
          attackerName={preview.attackerName}
          moves={preview.moves}
          targets={preview.targets}
          field={field}
          reverseField={incomingField}
          style={previewStyle(
            preview.rect,
            // Arena: the roster is two columns, so the left column pops left and
            // the right column pops right (even index = left column, odd = right).
            // Normal layout: pop toward the centre (your side right, enemy left).
            arena
              ? ((hover?.index ?? 0) % 2 === 0 ? 'left' : 'right')
              : (preview.side === 'player' ? 'right' : 'left'),
          )}
          onMouseEnter={keepPreview}
          onMouseLeave={closePreview}
        />
      )}

      <ImportDialog
        side={photoSide}
        autoCapture={photoAutoCapture}
        onClose={() => { setPhotoSide(null); setPhotoAutoCapture(false); }}
        onImport={handlePhotoImport}
      />
      <TeamReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onImport={(sets) => {
          updateMembers('playerTeams', playerTeamIdx, () => sets);
          setAttackerIdx(0);
        }}
      />
      <PokepasteDialog
        open={pasteSide !== null}
        side={pasteSide ?? 'player'}
        onClose={() => setPasteSide(null)}
        onImport={importPokepaste}
      />
    </div>
  );
}
