import { describe, expect, it } from 'vitest';
import { answerAccessibleName } from './items';

describe('nom accessible des réponses', () => {
  it('commence par le texte visible du bouton', () => {
    expect(answerAccessibleName('int', 'M3')).toBe('3M Tierce majeure');
    expect(answerAccessibleName('int', 'TT')).toBe('4+/5− Triton');
    expect(answerAccessibleName('chd', 'm7')).toBe('m7 Mineur 7');
    expect(answerAccessibleName('mod', 'dorian')).toBe('Dorien mineur, 6M');
  });

  it('ne répète pas un libellé court qui abrège le nom', () => {
    expect(answerAccessibleName('inv', 'inv0')).toBe('État fondamental');
    expect(answerAccessibleName('inv', 'inv1')).toBe('1er renversement');
    expect(answerAccessibleName('scl', 'pentmin')).toBe('Pentatonique mineure');
    expect(answerAccessibleName('scl', 'major')).toBe('Gamme majeure');
    expect(answerAccessibleName('chd', 'maj')).toBe('Majeur');
    expect(answerAccessibleName('chd', 'dim')).toBe('Diminué');
    expect(answerAccessibleName('chd', 'dim7')).toBe('7 diminuée');
  });
});
