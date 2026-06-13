/**
 * Photo-import dialog for ONE side's team.
 *
 * Opened from a team box's "Photo" button with `side` set to that box. You drop
 * a screenshot/photo; the chosen engine reads that side's panels (your blue / the
 * enemy's red) and you assemble the final team in a review before it's applied:
 *   - confident matches preload as a removable draft,
 *   - weaker "best guesses" are one tap to add,
 *   - and a name search adds any Pokémon manually (also the fallback when nothing
 *     is detected).
 *
 * The free on-device engine is the default; "More precise" switches to Claude
 * vision (needs an API key). The engine choice and key are remembered.
 */
import { useRef, useState } from 'react';
import { LocalRecognizer, ClaudeRecognizer } from '../recognition';
import type { RecognitionResult, CropRect } from '../recognition';
import { spriteUrl, resolveSpeciesName, getSpeciesBaseStats } from '../champions';
import { Combobox, DATALIST } from './widgets';
import { CropBox } from './CropBox';

type Side = 'player' | 'enemy';

interface Props {
  /** Which team box opened the dialog; null = closed. */
  side: Side | null;
  onClose: () => void;
  onImport: (side: Side, species: string[]) => void;
}

const MAX_TEAM = 6;

export function ImportDialog({ side, onClose, onImport }: Props) {
  const [image, setImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [precise, setPrecise] = useState(() => localStorage.getItem('champions-calc/recognizer') === 'claude');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('champions-calc/anthropicKey') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [manual, setManual] = useState('');
  const [cropping, setCropping] = useState(false);
  const [cropBox, setCropBox] = useState<CropRect | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!side) return null;

  const isPlayer = side === 'player';
  const sideLabel = isPlayer ? 'your team' : 'the enemy team';
  // Manual crop is an on-device, enemy-only helper (Claude doesn't need it).
  const canCrop = !isPlayer && !precise;

  const reset = () => { setResult(null); setDraft([]); setManual(''); setCropping(false); setCropBox(null); };

  const acceptImage = (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    reset();
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Open the manual cropper, pre-filled with the auto-detected column if we can
  // find one (otherwise CropBox falls back to a sensible default box).
  const openCrop = async () => {
    if (!image) return;
    setError(null);
    try { setCropBox(await new LocalRecognizer().detectEnemyBox(image)); }
    catch { setCropBox(null); }
    setCropping(true);
  };

  const confirmCrop = async (rect: CropRect) => {
    if (!image) return;
    setBusy(true);
    setError(null);
    try {
      const res = await new LocalRecognizer().recognizeCrop(image, rect);
      setResult(res);
      setDraft(res.enemy.map((d) => d.species));
      setCropping(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const detect = async () => {
    if (!image) return;
    setBusy(true);
    setError(null);
    try {
      const recognizer = precise ? new ClaudeRecognizer(apiKey) : new LocalRecognizer();
      const res = await recognizer.recognize(image, side);
      setResult(res);
      setDraft((isPlayer ? res.player : res.enemy).map((d) => d.species));
      // If on-device couldn't confidently place anything, jump straight to the
      // manual cropper (pre-filled) so the user can fix the locate themselves.
      if (canCrop && res.enemy.length === 0) await openCrop();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const addSpecies = (name: string) =>
    setDraft((d) => (d.includes(name) || d.length >= MAX_TEAM ? d : [...d, name]));
  const removeAt = (i: number) => setDraft((d) => d.filter((_, j) => j !== i));
  const addManual = () => {
    const name = resolveSpeciesName(manual.trim());
    if (name && getSpeciesBaseStats(name)) { addSpecies(name); setManual(''); }
  };

  const apply = () => { onImport(side, draft); onClose(); };

  const guesses = (result?.uncertain ?? []).filter((g) => !draft.includes(g.species));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Import {sideLabel} from a photo</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {cropping && previewUrl ? (
          <CropBox src={previewUrl} initialRect={cropBox} onConfirm={confirmCrop} onCancel={() => setCropping(false)} busy={busy} />
        ) : result ? (
          <div className="detect-review">
            <p className="detect-engine">
              Detected with the {result.engine === 'claude' ? 'Claude' : 'on-device'} engine — review, then apply.
            </p>

            <div className="detect-group">
              <h3>{isPlayer ? 'Your team' : 'Enemy team'}{draft.length > 0 ? ` (${draft.length})` : ''}</h3>
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
            <div className="detect-links">
              {canCrop && <button className="link-btn" onClick={openCrop}>Crop the panels myself</button>}
              <button className="link-btn" onClick={reset}>Use a different image</button>
            </div>
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
                <p>Drop a {isPlayer ? 'blue (your) ' : 'red (enemy) '}Team Preview screenshot here, paste it, or <span className="link">click to browse</span>.</p>
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

        {!cropping && (
          <div className="modal-actions">
            {result ? (
              <>
                <button onClick={reset}>Back</button>
                <button className="primary" onClick={apply} disabled={draft.length === 0}>Apply to calculator</button>
              </>
            ) : (
              <>
                <button onClick={onClose}>Cancel</button>
                {canCrop && image && <button onClick={openCrop} disabled={busy}>Crop manually</button>}
                <button className="primary" onClick={detect} disabled={!image || busy}>
                  {busy ? 'Detecting…' : 'Detect'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
