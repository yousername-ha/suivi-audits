import { describe, expect, it } from 'vitest';
import {
  formatSetupToken,
  normalizeSetupToken,
  setupTokenInputProblem,
  SETUP_TOKEN_ALPHABET,
  SETUP_TOKEN_BITS,
} from '../src/index.js';

describe('jeton d’installation : format partagé', () => {
  it('alphabet sans caractère ambigu et au moins 90 bits', () => {
    expect(SETUP_TOKEN_ALPHABET).toHaveLength(31);
    expect(SETUP_TOKEN_ALPHABET).not.toMatch(/[01OIL]/);
    expect(SETUP_TOKEN_BITS).toBeGreaterThanOrEqual(90);
  });

  it('normalise minuscules, espaces, tirets et tirets typographiques', () => {
    const ref = 'K7QM2XH9PD4TNRWB8FZC';
    for (const v of [
      'K7QM2-XH9PD-4TNRW-B8FZC',
      'k7qm2-xh9pd-4tnrw-b8fzc',
      'K7QM2 XH9PD 4TNRW B8FZC',
      '  k7qm2xh9pd4tnrwb8fzc  ',
      'K7QM2—XH9PD–4TNRW‐B8FZC',
      'K7QM2\tXH9PD\n4TNRW-B8FZC',
    ]) {
      expect(normalizeSetupToken(v), JSON.stringify(v)).toBe(ref);
    }
    expect(formatSetupToken(ref)).toBe('K7QM2-XH9PD-4TNRW-B8FZC');
  });

  it('refuse les formats invalides', () => {
    for (const v of ['', 'K7QM2-XH9PD-4TNRW', 'K7QM2-XH9PD-4TNRW-B8FZ0', 'O7QM2-XH9PD-4TNRW-B8FZC', 'K7QM2.XH9PD.4TNRW.B8FZC', null, 42, 'x'.repeat(200)]) {
      expect(normalizeSetupToken(v), JSON.stringify(v)).toBeNull();
    }
  });

  it('explique les erreurs de saisie avant envoi', () => {
    expect(setupTokenInputProblem('K7QM0-XH9PD-4TNRW-B8FZC')).toMatch(/0, 1, I, L ni O/);
    expect(setupTokenInputProblem('K7QM2-XH9PD')).toMatch(/20 caractères/);
    expect(setupTokenInputProblem('k7qm2 xh9pd 4tnrw b8fzc')).toBeNull();
  });
});
