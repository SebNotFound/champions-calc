/**
 * Import a team from a pokepaste / Showdown export into a saved slot.
 *
 * Paste the team text directly (most reliable), or paste a pokepaste URL and
 * we'll try to fetch it. EVs are converted to Champions Stat Points on import
 * (see champions/showdown.ts).
 */
import { useState } from 'react';
import { parseShowdownTeam } from '../champions';
import type { ChampionsSet } from '../champions';

interface Props {
  open: boolean;
  /** Which side we're importing into, for the heading. */
  side: 'player' | 'enemy';
  onClose: () => void;
  onImport: (sets: ChampionsSet[]) => void;
}

export function PokepasteDialog({ open, side, onClose, onImport }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const doImport = async () => {
    setError(null);
    let raw = text.trim();
    if (!raw) {
      setError('Paste a team first.');
      return;
    }

    // If they pasted a pokepaste URL, try to fetch the raw text (best effort).
    if (/^https?:\/\/pokepast\.es\//i.test(raw)) {
      setBusy(true);
      try {
        const res = await fetch(raw.replace(/\/+$/, '') + '/raw');
        if (!res.ok) throw new Error(String(res.status));
        raw = await res.text();
      } catch {
        setBusy(false);
        setError('Could not fetch that URL (the site may block it). Open the pokepaste, copy the text, and paste it here instead.');
        return;
      }
      setBusy(false);
    }

    const sets = parseShowdownTeam(raw);
    if (!sets.length) {
      setError('No Pokémon found — paste a Showdown / pokepaste team.');
      return;
    }
    onImport(sets.slice(0, 6));
    setText('');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Import {side === 'player' ? 'your' : 'enemy'} team</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="modal-hint">
          Paste a Showdown export or a <code>pokepast.es</code> URL. This replaces the current slot.
          EVs are converted to Stat Points automatically.
        </p>
        <textarea
          className="paste-area"
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Garchomp @ Life Orb\nAbility: Rough Skin\nEVs: 252 Atk / 4 SpD / 252 Spe\nJolly Nature\n- Earthquake\n- ...\n\n…or https://pokepast.es/xxxxxxxx'}
          spellCheck={false}
        />
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={doImport} disabled={busy}>
            {busy ? 'Fetching…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
