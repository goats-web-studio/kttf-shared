import { describe, expect, it } from 'vitest';

import {
  linkToken,
  markupToPlain,
  mentionsOf,
  mentionToken,
  parseBlocks,
  parseInline,
} from './markup.js';

const ID = '00000000-0000-4000-8000-000000000001';

describe('разметка текста — ADR-076', () => {
  it('жирный и курсив, курсив только на границе слова', () => {
    expect(parseInline('**Важно** и _срочно_')).toEqual([
      { kind: 'bold', children: [{ kind: 'text', value: 'Важно' }] },
      { kind: 'text', value: ' и ' },
      { kind: 'italic', children: [{ kind: 'text', value: 'срочно' }] },
    ]);
    expect(parseInline('snake_case_name')).toEqual([{ kind: 'text', value: 'snake_case_name' }]);
  });

  it('ссылка с подписью и голый адрес; чужая схема — текстом', () => {
    expect(parseInline('[Сайт](https://kttf.kz) и https://kttf.kz/a.')).toEqual([
      { kind: 'link', href: 'https://kttf.kz', label: 'Сайт' },
      { kind: 'text', value: ' и ' },
      { kind: 'link', href: 'https://kttf.kz/a', label: 'https://kttf.kz/a' },
      { kind: 'text', value: '.' },
    ]);
    expect(parseInline('[жми](javascript:alert(1))')[0]).toMatchObject({ kind: 'text' });
  });

  it('отметка игрока, клуба, товара; неизвестный вид — текстом', () => {
    expect(parseInline(mentionToken('player', ID, 'Ким Артём'))).toEqual([
      { kind: 'mention', target: 'player', ref: ID, label: 'Ким Артём' },
    ]);
    expect(parseInline('@[x](user:1)')[0]).toMatchObject({ kind: 'text' });
  });

  it('списки и абзацы', () => {
    expect(
      parseBlocks('Набор:\n- дети\n- взрослые\n\n1. запись\n2. оплата').map((b) => b.kind),
    ).toEqual(['paragraph', 'bullets', 'numbers']);
  });

  it('текст без разметки — подписи вместо ссылок и отметок', () => {
    const text = `**Итоги**: ${mentionToken('club', ID, 'KTTF Тест')}\n- ${linkToken('фото', 'https://x.kz')}`;

    expect(markupToPlain(text)).toBe('Итоги: KTTF Тест\n\n— фото');
  });

  it('кого отметили — без повторов', () => {
    const one = mentionToken('player', ID, 'Ким');

    expect(mentionsOf(`${one} и ещё ${one}`)).toEqual([{ target: 'player', ref: ID }]);
  });
});
