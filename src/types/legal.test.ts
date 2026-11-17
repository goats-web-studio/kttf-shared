import { describe, expect, it } from 'vitest';

import { LEGAL_DOCUMENTS, LEGAL_PATHS, PRIVACY_POLICY_VERSION } from './legal.js';

describe('юридические документы', () => {
  it('редакция — дата ГГГГ-ММ-ДД', () => {
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('у каждого документа есть адрес', () => {
    expect(Object.keys(LEGAL_PATHS).sort()).toEqual([...LEGAL_DOCUMENTS].sort());
  });
});
