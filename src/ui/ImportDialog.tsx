/**
 * Team Preview import dialog.
 *
 * You drop a screenshot or phone photo of the Team Preview; the chosen engine
 * detects the opponent's Pokémon (red panels). Detection then opens a review
 * where you assemble the final enemy team before anything is applied:
 *   - confident matches are pre-loaded (remove any that are wrong),
 *   - weaker "best guesses" are one click away from being added,
 *   - and you can search any Pokémon by name to add it manually — which is also
 *     the fallback when a photo isn't recognised at all.
 *
 * The free on-device engine is the default; "More precise" switches to the
 * Claude vision engine (needs an API key, and also reads your own blue side).
 * The chosen engine and API key are remembered in the browser.
 */
import { useRef, useState } from 'react';
import { LocalRecognizer, ClaudeRecognizer } from '../recognition';
import type { DetectedPokemon, RecognitionResult } from '../recognition';
import { spriteUrl, resolveSpeciesName, getSpeciesBaseStats } from '../champions';
import { Combobox, DATALIST } from './widgets';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (result: RecognitionResult) => void;
}

const MAX_TEAM = 6;

export function ImportDialog({ open, onClose, onImport }: Props) {
  const [image, setImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [precise, setPrecise] = useState(() => localStorage.getItem('champions-calc/recognizer') === 'claude');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('champions-calc/anthropicKey') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [draft, setDraft] = useState<string[]>([]); // enemy species being assembled
  const [manual, setManual] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => { setResult(null); setDraft([]); setManual(''); };

  const acceptImage = (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    reset();
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const detect = async () => {
    if (!image) return;
    setBusy(true);
    setError(null);
    try {
      const recognizer = precise ? new ClaudeRecognizer(apiKey) : new LocalRecognizer();
      const res = await recognizer.recognize(image);
      setResult(res);
      setDraft(res.enemy.map((d) => d.species));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const addSpecies = (name: string) => {
    setDraft((d) => (d.includes(name) || d.length >= MAX_TEAM ? d : [...d, name]));
  };
  const removeAt = (i: number) => setDraft((d) => d.filter((_, j) => j !== i));

  const addManual = () => {
    const name = resolveSpeciesName(manual.trim());
    if (name && getSpeciesBaseStats(name)) { addSpecies(name); setManual(''); }
  };

  const apply = () => {
    if (result) {
      const enemy: DetectedPokemon[] = draft.map((species) => ({ side: 'enemy', species, confidence: 1 }));
      onImport({ ...result, enemy });
    }
    onClose();
  };

  const guesses = (result?.uncertain ?? []).filter((g) => !draft.includes(g.species));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Import from Team Preview</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {result ? (
          <div className="detect-review">
            <p className="detect-engine">
              Detected with the {result.engine === 'claude' ? 'Claude' : 'on-device'} engine — review, then apply.
            </p>

            {result.player.length > 0 && (
              <DetectGroup title="Your team (blue)" mons={result.player} />
            )}

            <div className="detect-group">
              <h3>Opponent team{draft.length > 0 ? ` (${draft.length})` : ''}</h3>
              {draft.length === 0 ? (
                <p className="detect-empty">Nothing added yet — tap a best guess below or search for a Pokémon.</p>
              ) : (
                <div className="detect-chips">
                  {draft.map((species, i) => (
                    <span key={`${species}-${i}`} className="detect-chip">
                      <img src={spriteUrl(species)} alt="" />
                      {species}
                      <button className="chip-x" onClick={() => removeAt(i)} aria-label={`Remove ${species}`}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {guesses.length > 0 && (
              <div className="detect-group">
                <h3>Best guesses — tap to add</h3>
                <div className="detect-chips">
                  {guesses.map((g, i) => (
                    <button
                      key={`${g.species}-${i}`}
                      className="detect-chip clickable"
                      onClick={() => addSpecies(g.species)}
                      disabled={draft.length >= MAX_TEAM}
                      title={`Add ${g.species}`}
                    >
                      <img src={spriteUrl(g.species)} alt="" />
                      {g.species}
                      <em>{Math.round(g.confidence * 100)}%</em>
                      <span className="chip-plus">+</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="detect-group">
              <h3>Add a Pokémon</h3>
              <form className="detect-add" onSubmit={(e) => { e.preventDefault(); addManual(); }}>
                <Combobox
                  value={manual}
                  onChange={setManual}
                  listId={DATALIST.species}
                  placeholder="Search by name…"
                  aria-label="Add a Pokémon by name"
                />
                <button type="submit" disabled={!manual.trim() || draft.length >= MAX_TEAM}>Add</button>
              </form>
            </div>

            {result.notes?.map((n, i) => <p key={i} className="detect-note">{n}</p>)}
            <button className="link-btn" onClick={reset}>Use a different image</button>
          </div>
        ) : (
          <>
            <div
              className="dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); acceptImage(e.dataTransfer.files?.[0]); }}
              onPaste={(e) => acceptImage(e.clipboardData.files?.[0])}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Team Preview" className="dropzone-preview" />
              ) : (
                <p>Drag &amp; drop a screenshot here, paste it, or <span className="link">click to browse</span>.</p>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => acceptImage(e.target.files?.[0])} />
            </div>

            <label className="precise-toggle">
              <input
                type="checkbox"
                checked={precise}
                onChange={(e) => {
                  setPrecise(e.target.checked);
                  localStorage.setItem('champions-calc/recognizer', e.target.checked ? 'claude' : 'local');
                }}
              />
              More precise (Claude vision) — uses an API key, costs a cent or two per image
            </label>

            {precise && (
              <input
                className="api-key"
                type="password"
                placeholder="Anthropic API key (kept in your browser)"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); localStorage.setItem('champions-calc/anthropicKey', e.target.value); }}
              />
            )}
          </>
        )}

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          {result ? (
            <>
              <button onClick={reset}>Back</button>
              <button className="primary" onClick={apply} disabled={draft.length === 0 && !result.player.length}>
                Apply to calculator
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose}>Cancel</button>
              <button className="primary" onClick={detect} disabled={!image || busy}>
                {busy ? 'Detecting…' : 'Detect'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Read-only group of detected mons (used for the player side from Claude). */
function DetectGroup({ title, mons }: { title: string; mons: DetectedPokemon[] }) {
  return (
    <div className="detect-group">
      <h3>{title}</h3>
      <div className="detect-chips">
        {mons.map((d, i) => (
          <span key={`${d.species}-${i}`} className="detect-chip">
            <img src={spriteUrl(d.species)} alt="" />
            {d.species}
          </span>
        ))}
      </div>
    </div>
  );
}
