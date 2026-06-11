/**
 * Team Preview import dialog.
 *
 * You drop a screenshot or phone photo of the Team Preview; the chosen engine
 * detects which Pokémon are yours (blue) vs the opponent's (red) and hands back
 * a {@link RecognitionResult} that the app uses to pre-fill the calculator.
 *
 * The free on-device engine is the default; the "More precise" switch turns on
 * the Claude vision engine (which needs an API key). Claude vision works today;
 * the free engine is pending a real Team Preview sample to calibrate it. The
 * chosen engine and API key are remembered in the browser.
 */
import { useRef, useState } from 'react';
import { LocalRecognizer, ClaudeRecognizer } from '../recognition';
import type { RecognitionResult } from '../recognition';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const acceptImage = (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    setImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const detect = async () => {
    if (!image) return;
    setBusy(true);
    setError(null);
    try {
      const recognizer = precise ? new ClaudeRecognizer(apiKey) : new LocalRecognizer();
      const result = await recognizer.recognize(image);
      onImport(result);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Import from Team Preview</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

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

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={detect} disabled={!image || busy}>
            {busy ? 'Detecting…' : 'Detect'}
          </button>
        </div>
      </div>
    </div>
  );
}
