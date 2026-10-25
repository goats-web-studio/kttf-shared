/**
 * Разметка текста — ADR-076: новости и акции клубов и тренеров, записи
 * игроков, сообщения форума.
 *
 * Текст по-прежнему хранится строкой, без HTML: вставить скрипт нельзя, а
 * старые тексты остаются валидными. Поверх строки — маленький язык, который
 * понимают и редактор, и показ:
 *
 * - `**жирный**`, `_курсив_`;
 * - строки `- пункт` и `1. пункт` — списки;
 * - `[подпись](https://адрес)` — ссылка с подписью; голый `https://…` —
 *   ссылка как есть. Другие схемы (`javascript:` и т. п.) остаются текстом;
 * - `@[Имя](player:id)`, `@[Клуб](club:id)`, `@[Тренер](coach:slug)`,
 *   `@[Товар](product:slug)`, `@[Турнир](tournament:id)` — отметка.
 *
 * Разбор один на сервер и клиент: сервер режет из него текст для карточек
 * ленты, клиент рисует.
 */

export const MENTION_KINDS = ['player', 'club', 'coach', 'product', 'tournament'] as const;
export type MentionKind = (typeof MENTION_KINDS)[number];

export type Inline =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'bold'; readonly children: readonly Inline[] }
  | { readonly kind: 'italic'; readonly children: readonly Inline[] }
  | { readonly kind: 'link'; readonly href: string; readonly label: string }
  | {
      readonly kind: 'mention';
      readonly target: MentionKind;
      readonly ref: string;
      readonly label: string;
    };

export type Block =
  | { readonly kind: 'paragraph'; readonly lines: readonly (readonly Inline[])[] }
  | { readonly kind: 'bullets'; readonly items: readonly (readonly Inline[])[] }
  | { readonly kind: 'numbers'; readonly items: readonly (readonly Inline[])[] };

const SAFE_URL = /^https?:\/\/[^\s<>"«»]+$/;
const BARE_URL = /https?:\/\/[^\s<>"«»)\]]+/;
const TRAILING = /[.,;:!?]+$/;
const REF = /^[A-Za-z0-9_-]{1,80}$/;

/** Отметка в тексте — так её вставляет редактор. Скобки в подписи убираются. */
export function mentionToken(target: MentionKind, ref: string, label: string): string {
  return `@[${label.replace(/[[\]()]/g, '').trim()}](${target}:${ref})`;
}

/** Ссылка с подписью — так её вставляет редактор. */
export function linkToken(label: string, href: string): string {
  return `[${label.replace(/[[\]]/g, '').trim() || href}](${href})`;
}

function isMentionKind(value: string): value is MentionKind {
  return (MENTION_KINDS as readonly string[]).includes(value);
}

/**
 * Строка — в куски. Жадности нет: ищется ближайшая из конструкций слева
 * направо, незакрытое остаётся текстом.
 */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  let plain = '';

  const flush = () => {
    if (plain !== '') out.push({ kind: 'text', value: plain });
    plain = '';
  };

  while (rest.length > 0) {
    // Отметка: @[подпись](вид:ссылка)
    const mention = /^@\[([^\]\n]{1,120})\]\(([a-z]+):([^)\s]{1,80})\)/.exec(rest);
    if (mention !== null) {
      const [whole, label = '', target = '', ref = ''] = mention;
      if (isMentionKind(target) && REF.test(ref)) {
        flush();
        out.push({ kind: 'mention', target, ref, label });
        rest = rest.slice(whole.length);
        continue;
      }
    }

    // Ссылка с подписью: [подпись](https://…)
    const link = /^\[([^\]\n]{1,200})\]\(([^)\s]{1,2000})\)/.exec(rest);
    if (link !== null) {
      const [whole, label = '', href = ''] = link;
      if (SAFE_URL.test(href)) {
        flush();
        out.push({ kind: 'link', href, label });
        rest = rest.slice(whole.length);
        continue;
      }
    }

    // Голый адрес
    const bare = /^https?:\/\//.test(rest) ? BARE_URL.exec(rest) : null;
    if (bare !== null && bare.index === 0) {
      const href = bare[0].replace(TRAILING, '');
      flush();
      out.push({ kind: 'link', href, label: href });
      rest = rest.slice(href.length);
      continue;
    }

    // **жирный**
    if (rest.startsWith('**')) {
      const end = rest.indexOf('**', 2);
      if (end > 2) {
        flush();
        out.push({ kind: 'bold', children: parseInline(rest.slice(2, end)) });
        rest = rest.slice(end + 2);
        continue;
      }
    }

    // _курсив_ — только на границе слова: snake_case остаётся текстом.
    if (rest.startsWith('_') && (plain === '' || /[\s(«"]$/.test(plain))) {
      const end = rest.indexOf('_', 1);
      if (
        end > 1 &&
        !/\s/.test(rest.charAt(end - 1)) &&
        !/[\p{L}\p{N}]/u.test(rest.charAt(end + 1))
      ) {
        flush();
        out.push({ kind: 'italic', children: parseInline(rest.slice(1, end)) });
        rest = rest.slice(end + 1);
        continue;
      }
    }

    plain += rest.charAt(0);
    rest = rest.slice(1);
  }

  flush();
  return out;
}

const BULLET = /^\s*[-•]\s+/;
const NUMBER = /^\s*\d{1,3}[.)]\s+/;

/** Текст — в абзацы и списки. Пустая строка разделяет абзацы. */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: Inline[][] = [];
  // Приведение — чтобы сужение не решило, что список всегда пуст: его
  // меняет вложенная функция, которую анализ потока не видит.
  let list = null as { kind: 'bullets' | 'numbers'; items: Inline[][] } | null;

  const closeParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', lines: paragraph });
    paragraph = [];
  };
  const closeList = () => {
    if (list !== null) blocks.push({ kind: list.kind, items: list.items });
    list = null;
  };

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const bullet = BULLET.exec(line);
    const number = bullet === null ? NUMBER.exec(line) : null;
    const marker = bullet ?? number;

    if (marker !== null) {
      const kind = bullet === null ? 'numbers' : 'bullets';
      closeParagraph();
      if (list?.kind !== kind) {
        closeList();
        list = { kind, items: [] };
      }
      list.items.push(parseInline(line.slice(marker[0].length)));
      continue;
    }

    closeList();

    if (line.trim() === '') {
      closeParagraph();
      continue;
    }

    paragraph.push(parseInline(line));
  }

  closeParagraph();
  closeList();
  return blocks;
}

function inlineText(parts: readonly Inline[]): string {
  return parts
    .map((part) => {
      switch (part.kind) {
        case 'text':
          return part.value;
        case 'bold':
        case 'italic':
          return inlineText(part.children);
        case 'link':
          return part.label;
        case 'mention':
          return part.label;
      }
    })
    .join('');
}

/**
 * Текст без разметки — для карточек ленты, цитат и поиска: подписи вместо
 * ссылок и отметок, маркеры списков — тире.
 */
export function markupToPlain(text: string): string {
  return parseBlocks(text)
    .map((block) =>
      block.kind === 'paragraph'
        ? block.lines.map(inlineText).join('\n')
        : block.items
            .map((item, index) =>
              block.kind === 'bullets'
                ? `— ${inlineText(item)}`
                : `${String(index + 1)}. ${inlineText(item)}`,
            )
            .join('\n'),
    )
    .join('\n\n');
}

/** Кого отметили — для уведомлений и связей. Повторы схлопываются. */
export function mentionsOf(text: string): { target: MentionKind; ref: string }[] {
  const seen = new Map<string, { target: MentionKind; ref: string }>();
  const walk = (parts: readonly Inline[]) => {
    for (const part of parts) {
      if (part.kind === 'mention') seen.set(`${part.target}:${part.ref}`, part);
      if (part.kind === 'bold' || part.kind === 'italic') walk(part.children);
    }
  };

  for (const block of parseBlocks(text)) {
    for (const line of block.kind === 'paragraph' ? block.lines : block.items) walk(line);
  }

  return [...seen.values()].map(({ target, ref }) => ({ target, ref }));
}
