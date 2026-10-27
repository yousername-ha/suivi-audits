/* Version annoncée par le démon ClamAV : lue par la commande clamd VERSION, nulle si l'antivirus est désactivé ou injoignable. */
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { clamavVersion } from '../src/files.js';

const serveurs: net.Server[] = [];
afterEach(() => {
  for (const s of serveurs.splice(0)) s.close();
});
const config = (env: Record<string, string>) =>
  loadConfig({ DB_HOST: 'x', DB_PASSWORD: 'x', DOC_MASTER_KEY: Buffer.alloc(32, 1).toString('base64'), ...env });
const demon = (reponse: string | null) =>
  new Promise<number>((resolve) => {
    const s = net.createServer((c) => {
      if (reponse === null) return; // muet : on laisse expirer
      c.on('data', (d) => {
        if (d.toString().startsWith('zVERSION')) c.end(reponse + '\0');
        else c.destroy();
      });
    });
    serveurs.push(s);
    s.listen(0, '127.0.0.1', () => resolve((s.address() as net.AddressInfo).port));
  });

describe('version de ClamAV', () => {
  it('lit la version annoncée par le démon', async () => {
    const port = await demon('ClamAV 1.4.2/27800/Tue Oct 27 08:00:00 2026');
    expect(await clamavVersion(config({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(port) }))).toBe(
      'ClamAV 1.4.2/27800/Tue Oct 27 08:00:00 2026',
    );
  });
  it('renvoie null sans antivirus configuré', async () => {
    expect(await clamavVersion(config({}))).toBeNull();
  });
  it('renvoie null si le démon est injoignable ou muet', async () => {
    const mort = await demon('x');
    serveurs.pop()!.close();
    expect(await clamavVersion(config({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(mort) }))).toBeNull();
    const muet = await demon(null);
    expect(await clamavVersion(config({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(muet) }), 300)).toBeNull();
  });
});
