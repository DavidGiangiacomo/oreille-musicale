import { describe, expect, it } from 'vitest';
import { answerIndexForCode, keyHint } from '../question/keys';
import { configFromParams, seriesPath } from './seriesParams';

describe('adresse d’une série', () => {
  it('fait l’aller-retour entre configuration et adresse', () => {
    const path = seriesPath('desc', ['P8', 'M3'], 10);
    expect(path).toBe('/serie?p=desc&i=P8%2CM3&n=10');
    const config = configFromParams(new URLSearchParams(path.split('?')[1]), 'slow');
    expect(config).toMatchObject({
      presentation: 'desc',
      items: ['M3', 'P8'],
      length: 10,
      tempo: 'slow',
    });
  });

  it('ignore les intervalles inconnus ou en double', () => {
    const config = configFromParams(new URLSearchParams('p=asc&i=M3,xx,M3,P5'), 'normal');
    expect(config?.items).toEqual(['M3', 'P5']);
    expect(config?.length).toBe(20);
  });

  it('refuse une adresse invalide', () => {
    for (const query of [
      '',
      'p=asc',
      'p=up&i=M3',
      'p=asc&i=xx',
      'p=asc&i=M3&n=0',
      'p=asc&i=M3&n=abc',
    ]) {
      expect(configFromParams(new URLSearchParams(query), 'normal')).toBeNull();
    }
  });
});

describe('raccourcis clavier', () => {
  it('reconnaît la rangée des chiffres et le pavé numérique par position', () => {
    expect(answerIndexForCode('Digit1')).toBe(0);
    expect(answerIndexForCode('Digit0')).toBe(9);
    expect(answerIndexForCode('Minus')).toBe(10);
    expect(answerIndexForCode('Equal')).toBe(11);
    expect(answerIndexForCode('Numpad3')).toBe(2);
    expect(answerIndexForCode('KeyA')).toBeNull();
  });

  it('affiche le libellé des touches, selon la disposition quand elle est connue', () => {
    expect(keyHint(0)).toBe('1');
    expect(keyHint(9)).toBe('0');
    expect(keyHint(10)).toBe('-');
    expect(keyHint(10, new Map([['Minus', ')']]))).toBe(')');
    expect(keyHint(12)).toBeNull();
  });
});
