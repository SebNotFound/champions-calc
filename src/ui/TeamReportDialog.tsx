/**
 * Team-report import (your own team) from the in-game team view.
 *
 * Drop the two tabs — "Stats" and "Moves & More" — and Claude reads both and
 * merges them into full sets (species, nature, item, ability, moves, Stat
 * Points). One screenshot works too; two gives the complete set. Claude-only,
 * since it's detailed text OCR.
 */
import { useRef, useState } from 'react';
import { recognizeTeamReport } from '../recognition';
import { spriteUrl } from '../champions';
import type { ChampionsSet, StatTable } from '../champions';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (sets: ChampionsSet[]) => void;
}

interface Pick { blob: Blob; url: string; }

export function TeamReportDialog({ open, onClose, onImport }: Props) {
  const [stats, setStats] = useState<Pick | null>(null);
  const [moves, setMoves] = useState<Pick | null>(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('champions-calc/anthropicKey') ?? '');
  const [busy, setBusy] = useState(false);
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
    const images = [stats?.blob, moves?.blob].filter(Boolean) as Blob[];
    if (!images.length) { setError('Add at least one screenshot.'); return; }
    setBusy(true);
    setError(null);
    try {
      setResult(await recognizeTeamReport(images, apiKey));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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
            <button className="link-btn" onClick={() => setResult(null)}>Use different screenshots</button>
          </div>
        ) : (
          <>
            <p className="modal-hint">
              Open your team’s view in-game, then screenshot the <strong>Stats</strong> tab and the
              <strong> Moves &amp; More</strong> tab. Drop both here (one works too).
            </p>
            <div className="report-zones">
              <ReportZone label="Stats tab" pick={stats} onPick={choose(setStats)} />
              <ReportZone label="Moves &amp; More tab" pick={moves} onPick={choose(setMoves)} />
            </div>
            <input
              className="api-key"
              type="password"
              placeholder="Anthropic API key (kept in your browser)"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); localStorage.setItem('champions-calc/anthropicKey', e.target.value); }}
            />
            <p className="modal-hint">Uses Claude vision — costs a cent or two per read.</p>
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
                {busy ? 'Reading…' : 'Read team'}
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
