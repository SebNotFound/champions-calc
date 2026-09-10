export type Locale = 'en' | 'ja';

export type MessageParams = Readonly<Record<string, string | number>>;

export type GameNameCategory =
  | 'species'
  | 'move'
  | 'ability'
  | 'item'
  | 'nature'
  | 'type';

export type JapaneseNameCatalog = Readonly<
  Partial<Record<GameNameCategory, Readonly<Record<string, string>>>>
>;

export interface JapaneseFallbackEntry {
  source: string;
  reason: string;
}

export type JapaneseFallbackCatalog = Readonly<
  Partial<Record<GameNameCategory, Readonly<Record<string, JapaneseFallbackEntry>>>>
>;

export interface LocalizedOption {
  value: string;
  label: string;
  aliases: readonly string[];
}

