/**
 * Stable <datalist> ids. The big species/move/item lists are rendered ONCE near
 * the app root (see SharedDatalists.svelte) and every Combobox just points at
 * them, so the ~1000-entry lists aren't duplicated per field.
 */
export const DATALIST = {
  species: 'dl-species',
  moves: 'dl-moves',
  items: 'dl-items',
  abilities: 'dl-abilities',
} as const;
