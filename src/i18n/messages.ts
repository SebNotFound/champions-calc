import type { MessageParams } from './types';
import { EN_MESSAGES, type MessageKey } from './ui.en';

export type MessageCatalog = Readonly<Partial<Record<MessageKey, string>>>;

export function getMessage(
  catalog: MessageCatalog | undefined,
  key: MessageKey,
  params: MessageParams = {},
): string {
  const template = catalog?.[key] ?? EN_MESSAGES[key];

  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : token,
  );
}

