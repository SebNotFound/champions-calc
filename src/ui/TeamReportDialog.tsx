/**
 * Team-report import (your own team) from the in-game team view.
 *
 * Drop the two tabs — "Stats" and "Moves & More" — and the chosen engine reads
 * both into full sets (species, nature, item, ability, moves, Stat Points).
 *
 *  - "Free (on-device)": tesseract.js OCR + fuzzy-matching to the Pokémon's
 *    legal vocabulary + stat-math spread solving. No key, no cost; reads the
 *    odd busy item imperfectly (fix it in the review).
 *  - "Precise (Claude)": Claude vision; needs an API key and a cent or two.
 *
 * One screenshot works; two gives the complete set.
 */
import { useRef, useState } from 'react';
import { recognizeTeamReport, recognizeTeamReportLocal } from '../recognition';
import { spriteUrl } from '../champions';
import type { ChampionsSet, StatTable } from '../champions';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (sets: ChampionsSet[]) => void;
}

interface Pick { blob: Blob; url: string; }
type Mode = 'free' | 'claude';

export function TeamReportDialog({ open, onClose, onImport }: Props) {
  const [mode, setMode] = useState<Mode>('free');
  const [stats, setStats] = useState<Pick | null>(null);
  const [moves, setMoves] = useState<Pick | null>(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('champions-calc/anthropicKey') ?? '');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChampionsSet[] | null>(null);

  if (!open) return null;

  const choose = (set: (p: Pick) => void) => (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    set({ blob: file, url: URL.createObjectURL(file) });
  };

  const read = async () => {
    if (!stats && !moves) { setError('Add at least one screenshot.'); return; }
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      if (mode === 'free') {
        const sets = await recognizeTeamReportLocal(
          { stats: stats?.blob, moves: moves?.blob },
          (done, total) => setProgress(`Reading… ${Math.round((done / total) * 100)}%`),
        );
        setResult(sets);
      } else {
        const images = [stats?.blob, moves?.blob].filter(Boolean) as Blob[];
        setResult(await recognizeTeamReport(images, apiKey));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const apply = () => { if (result) onImport(result); onClose(); };
  const spTotal = (sp: StatTable) => Object.values(sp).reduce((a, b) => a + b, 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Import your team from its report</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {result ? (
          <div className="detect-review">
            <p className="detect-engine">Read {result.length} Pokémon — review, then apply.</p>
            <div className="report-sets">
              {result.map((s, i) => (
                <div key={i} className="report-set">
                  <img src={spriteUrl(s.megaForme ?? s.species)} alt="" />
                  <div className="report-set-text">
                    <strong>{s.species}</strong>
                    <span>{s.nature}{s.item ? ` · ${s.item}` : ''} · {spTotal(s.statPoints)} SP</span>
                    <span className="report-set-moves">{s.moves.filter(Boolean).join(', ') || 'no moves read'}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="detect-note">Double-check anything that looks off — busy item icons can trip the free reader.</p>
            <button className="link-btn" onClick={() => setResult(null)}>Use different screenshots</button>
          </div>
        ) : (
          <>
            <div className="report-mode">
              <button className={mode === 'free' ? 'active' : ''} onClick={() => setMode('free')}>Free · on-device</button>
              <button className={mode === 'claude' ? 'active' : ''} onClick={() => setMode('claude')}>Precise · Claude</button>
            </div>
            <p className="modal-hint">
              Open your team’s view in-game, then screenshot the <strong>Stats</strong> tab and the
              <strong> Moves &amp; More</strong> tab. Drop both here (one works too).
            </p>
            <div className="report-zones">
              <ReportZone label="Stats tab" pick={stats} onPick={choose(setStats)} />
              <ReportZone label="Moves &amp; More tab" pick={moves} onPick={choose(setMoves)} />
            </div>
            {mode === 'claude' ? (
              <>
                <input
                  className="api-key"
                  type="password"
                  placeholder="Anthropic API key (kept in your browser)"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); localStorage.setItem('champions-calc/anthropicKey', e.target.value); }}
                />
                <p className="modal-hint">Uses Claude vision — costs a cent or two per read.</p>
              </>
            ) : (
              <p className="modal-hint">Reads entirely in your browser — no key, no cost. First run downloads a ~3&nbsp;MB OCR model (then cached).</p>
            )}
          </>
        )}

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          {result ? (
            <>
              <button onClick={() => setResult(null)}>Back</button>
              <button className="primary" onClick={apply}>Apply to My Team</button>
            </>
          ) : (
            <>
              <button onClick={onClose}>Cancel</button>
              <button className="primary" onClick={read} disabled={busy || (!stats && !moves)}>
                {busy ? (progress ?? 'Reading…') : 'Read team'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportZone({ label, pick, onPick }: { label: string; pick: Pick | null; onPick: (f: File | null | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className="report-zone"
      onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files?.[0]); }}
      onPaste={(e) => onPick(e.clipboardData.files?.[0])}
    >
      <span className="report-zone-label">{label}</span>
      {pick ? (
        <img src={pick.url} alt={label} className="report-zone-preview" />
      ) : (
        <p className="report-zone-hint">Drop / paste / click</p>
      )}
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} />
    </div>
  );
}
