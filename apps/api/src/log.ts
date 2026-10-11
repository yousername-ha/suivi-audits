/* Journaux JSON (pino) sur la sortie standard, collectables par le SIEM via le pilote de logs Docker.
   Les secrets (cookies, jetons, mots de passe) sont masqués. */
import { pino, type Logger } from 'pino';

export const REDACT = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.current',
  '*.next',
  '*.token',
  '*.code',
  '*.privateKey',
  'req.body.privateKey',
  '*.secret',
];

export function createLogger(level = process.env.LOG_LEVEL || 'info'): Logger {
  return pino({
    level,
    base: { app: 'suivi-audits' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT, censor: '[masqué]' },
    formatters: { level: (label) => ({ level: label }) },
  });
}

export const log = createLogger();
