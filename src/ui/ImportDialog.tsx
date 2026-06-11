/**
 * Team Preview import dialog.
 *
 * You drop a screenshot or phone photo of the Team Preview; the chosen engine
 * detects which Pokémon are yours (blue) vs the opponent's (red) and hands back
 * a {@link RecognitionResult}. Before anything overwrites your team you get a
 * review step showing what was matched (with confidence) and any notes, so a
 * shaky guess never silently replaces a slot.
 *
 * The free on-device engine is the default and reads the enemy side; the "More
 * precise" switch turns on the Claude vision engine (which needs an API key and
 * also reads your own side). The chosen engine and API key are remembered in
 * the browser.
 */
import { useRef, useState } from 'react';
import { LocalRecognizer, ClaudeRecognizer } from '../recognition';
import type { DetectedPokemon, RecognitionResult } from '../recognition';
import { spriteUrl } from '../champions';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (result: RecognitionResult) => void;
}

export function ImportDialog({ open, onClose, onImport }: Props) {
  const [image, setImage] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [precise, setPrecise] = useState(() => localStorage.getItem('champions-calc/recognizer') === 'claude');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('champions-calc/anthropicKey') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const acceptImage = (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const detect = async () => {
    if (!image) return;
    setBusy(true);
    setError(null);
    try {
      const recognizer = precise ? new ClaudeRecognizer(apiKey) : new LocalRecognizer();
      setResult(await recognizer.recognize(image));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (result) onImport(result);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Import from Team Preview</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {result ? (
          <Review result={result} onBack={() => setResult(null)} />
        ) : (
          <>
            <div
              className="dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                acceptImage(e.dataTransfer.files?.[0]);
              }}
              onPaste={(e) => acceptImage(e.clipboardData.files?.[0])}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Team Preview" className="dropzone-preview" />
              ) : (
                <p>Drag &amp; drop a screenshot here, paste it, or <span className="link">click to browse</span>.</p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => acceptImage(e.target.files?.[0])}
              />
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
                onChange={(e) => {
                  setApiKey(e.target.value);
                  localStorage.setItem('champions-calc/anthropicKey', e.target.value);
                }}
              />
            )}
          </>
        )}

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          {result ? (
            <>
              <button onClick={() => setResult(null)}>Back</button>
              <button className="primary" onClick={apply}>Apply to calculator</button>
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

/** Post-detection review: what was matched, how confident, and any notes. */
function Review({ result, onBack }: { result: RecognitionResult; onBack: () => void }) {
  const empty = !result.player.length && !result.enemy.length;
  return (
    <div className="detect-review">
      <p className="detect-engine">
        Detected with the {result.engine === 'claude' ? 'Claude' : 'on-device'} engine — review before applying.
      </p>
      {result.enemy.length > 0 && <DetectGroup title="Opponent (red)" mons={result.enemy} />}
      {result.player.length > 0 && <DetectGroup title="You (blue)" mons={result.player} />}
      {empty && <p className="detect-note">Nothing could be matched. Drop a clearer shot, or try “More precise”.</p>}
      {result.notes?.map((n, i) => (
        <p key={i} className="detect-note">{n}</p>
      ))}
      <button className="link-btn" onClick={onBack}>Use a different image</button>
    </div>
  );
}

function DetectGroup({ title, mons }: { title: string; mons: DetectedPokemon[] }) {
  return (
    <div className="detect-group">
      <h3>{title}</h3>
      <div className="detect-chips">
        {mons.map((d, i) => {
          const pct = Math.round(d.confidence * 100);
          const shaky = d.confidence < 0.65;
          return (
            <span key={i} className={`detect-chip${shaky ? ' shaky' : ''}`} title={shaky ? 'Low confidence — double-check this one' : undefined}>
              <img src={spriteUrl(d.species)} alt="" />
              {d.species}
              <em>{pct}%</em>
            </span>
          );
        })}
      </div>
    </div>
  );
}
