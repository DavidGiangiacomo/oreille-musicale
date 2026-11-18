import { describe, expect, it } from 'vitest';
import { intervalEvents, renditionDuration } from './rendition';

describe('intervalEvents', () => {
  it('joue un intervalle mélodique note après note', () => {
    expect(intervalEvents(62, 66, 'asc')).toEqual([
      { midi: 62, start: 0, duration: 0.9, velocity: 0.7 },
      { midi: 66, start: 1, duration: 0.9, velocity: 0.7 },
    ]);
    expect(intervalEvents(66, 62, 'desc').map((e) => e.midi)).toEqual([66, 62]);
  });

  it('joue un intervalle harmonique en notes simultanées', () => {
    const events = intervalEvents(60, 67, 'harm');
    expect(events.map((e) => e.start)).toEqual([0, 0]);
    expect(events.map((e) => e.duration)).toEqual([1.8, 1.8]);
  });

  it('adapte les durées au tempo', () => {
    expect(renditionDuration(intervalEvents(60, 64, 'asc', 'normal'))).toBeCloseTo(1.9);
    expect(renditionDuration(intervalEvents(60, 64, 'asc', 'slow'))).toBeCloseTo(2.66);
    expect(renditionDuration(intervalEvents(60, 64, 'harm', 'fast'))).toBeCloseTo(1.26);
  });

  it('donne une durée nulle à une réalisation vide', () => {
    expect(renditionDuration([])).toBe(0);
  });
});
