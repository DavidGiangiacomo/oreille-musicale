import { describe, expect, it } from 'vitest';
import { intervalCompetenceId, parseIntervalCompetence } from './competence';

describe('identifiants de compétence', () => {
  it('écrit et relit une compétence d’intervalle', () => {
    expect(intervalCompetenceId('m3', 'asc')).toBe('int:m3:asc');
    expect(parseIntervalCompetence('int:TT:harm')).toEqual({ item: 'TT', presentation: 'harm' });
  });

  it('refuse un identifiant mal formé', () => {
    for (const id of ['int:m3', 'int:x9:asc', 'int:m3:up', 'chd:m7:block', 'int:m3:asc:extra']) {
      expect(parseIntervalCompetence(id)).toBeNull();
    }
  });
});
