import type { RecognitionResult, TeamPreviewRecognizer } from './types';

/**
 * Free, on-device Team Preview recognizer (the default engine).
 *
 * Planned approach for Phase 2:
 *   1. Split the image into the blue (player) and red (enemy) regions by
 *      sampling background colour — Champions colour-codes the two sides,
 *      which is the easy win the user pointed out.
 *   2. For each Pokémon slot, read the name label via on-device OCR and/or
 *      match the sprite against a reference set, then snap the result to the
 *      closest known species name.
 *
 * Stubbed until Phase 2; the class exists now so the import flow and the
 * engine-selection toggle can be wired against a stable interface.
 */
export class LocalRecognizer implements TeamPreviewRecognizer {
  readonly id = 'local' as const;
  readonly label = 'On-device (free)';

  async recognize(_image: Blob): Promise<RecognitionResult> {
    throw new Error(
      'The free on-device engine isn’t ready yet — it needs a real Team Preview ' +
      'screenshot to calibrate. Turn on “More precise” (Claude) for now.',
    );
  }
}
