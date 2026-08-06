import type { DamageSummary } from '@core';

/** A single move's damage result (a damage summary tagged with its move name). */
export type MoveResult = DamageSummary & { move: string };
