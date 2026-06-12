/**
 * Team Preview photo-recognition contracts.
 *
 * Two engines will implement {@link TeamPreviewRecognizer}: a free on-device
 * one (the default) and a "more precise" Claude vision one you can switch to
 * when the local result looks wrong. Keeping both behind one interface means
 * the rest of the app — and the import flow — doesn't care which is active.
 */
import type { Side } from '../champions/types';

/** One Pokémon detected in a Team Preview screenshot/photo. */
export interface DetectedPokemon {
  /** 'player' = blue panel (yours), 'enemy' = red panel (theirs). */
  side: Side;
  /** Best-guess species name (matched to an `@smogon/calc` species). */
  species: string;
  /** Detector confidence, 0–1, so the UI can flag shaky guesses. */
  confidence: number;
  /** Optional bounding box in the source image (for an overlay / debugging). */
  box?: { x: number; y: number; w: number; h: number };
}

export interface RecognitionResult {
  player: DetectedPokemon[];
  enemy: DetectedPokemon[];
  /**
   * Enemy slots the engine matched too weakly to auto-fill, but whose best
   * guess is still worth offering — the UI shows these as one-click "add"
   * chips rather than filling them silently.
   */
  uncertain?: DetectedPokemon[];
  /** Which engine produced this result. */
  engine: 'local' | 'claude';
  /** Non-fatal notes to surface to the user (e.g. "2 mons were low-confidence"). */
  notes?: string[];
}

/** A pluggable recognizer. Both the local and Claude engines implement this. */
export interface TeamPreviewRecognizer {
  readonly id: 'local' | 'claude';
  readonly label: string;
  /** Analyze an image and return the detected teams. */
  recognize(image: Blob): Promise<RecognitionResult>;
}
