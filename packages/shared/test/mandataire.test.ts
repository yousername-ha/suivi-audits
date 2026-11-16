/* Mandataire sortant de l'établissement (ADR 0101, lot P1) : forme de l'adresse (nom ou adresse IP, IPv6 entre crochets,
   adresses privées admises, port obligatoire de 1 à 65535, ni identifiant, ni chemin, ni paramètre, ni fragment), identifiant
   et mot de passe, usage du mandataire par chaque flux du registre, ligne de pare-feu. Données fictives. */
import { describe, expect, it } from 'vitest';
import {
  analyserAdresseMandataire,
  estIpv4,
  estIpv6,
  FLUX_EXTERNES,
  FLUX_MODULES,
  fluxExterne,
  fluxParUsageMandataire,
  fluxSelonMandataire,
  MandataireMotDePasseBody,
  PARE_FEU_MANDATAIRE,
  passeParMandataire,
  ReglageMandataire,
  REGLAGE_MANDATAIRE_DEFAUT,
  USAGE_MANDATAIRE,
} from '../src/index.js';

const reglage = (adresse: string, x: Record<string, unknown> = {}) =>
  ReglageMandataire.safeParse({ actif: true, adresse, identifiant: '', autoriteCertification: '', ...x });

describe('adresse du mandataire', () => {
  it('admet un nom, une adresse IPv4 (privée comprise) ou IPv6 entre crochets, avec un port', () => {
    expect(analyserAdresseMandataire('http://mandataire.exemple.test:3128')).toEqual({
      hote: 'mandataire.exemple.test',
      port: 3128,
    });
    expect(analyserAdresseMandataire('http://proxy:8080')).toEqual({ hote: 'proxy', port: 8080 });
    expect(analyserAdresseMandataire('http://10.0.0.8:8080')).toEqual({ hote: '10.0.0.8', port: 8080 });
    expect(analyserAdresseMandataire('http://192.168.1.1:1')).toEqual({ hote: '192.168.1.1', port: 1 });
    expect(analyserAdresseMandataire('http://172.16.0.1:65535')).toEqual({ hote: '172.16.0.1', port: 65535 });
    expect(analyserAdresseMandataire('http://[2001:db8::8]:3128')).toEqual({ hote: '2001:db8::8', port: 3128 });
    expect(analyserAdresseMandataire('http://[::1]:3128')).toEqual({ hote: '::1', port: 3128 });
    expect(analyserAdresseMandataire('http://[fd00:1:2:3:4:5:6:7]:3128')).toEqual({
      hote: 'fd00:1:2:3:4:5:6:7',
      port: 3128,
    });
    expect(analyserAdresseMandataire('  http://proxy.exemple.test:3128  ')).toEqual({
      hote: 'proxy.exemple.test',
      port: 3128,
    });
    for (const a of ['http://mandataire.exemple.test:3128', 'http://10.0.0.8:8080', 'http://[2001:db8::8]:3128'])
      expect(reglage(a).success, a).toBe(true);
  });

  it('refuse un port manquant ou hors bornes', () => {
    for (const a of [
      'http://mandataire.exemple.test',
      'http://mandataire.exemple.test:',
      'http://mandataire.exemple.test:0',
      'http://mandataire.exemple.test:65536',
      'http://mandataire.exemple.test:99999',
      'http://mandataire.exemple.test:03128',
      'http://mandataire.exemple.test:-1',
      'http://mandataire.exemple.test:abc',
      'http://10.0.0.8',
      'http://[2001:db8::8]',
      'http://[2001:db8::8]:',
    ]) {
      const r = analyserAdresseMandataire(a);
      expect('erreur' in r, a).toBe(true);
      expect(reglage(a).success, a).toBe(false);
    }
    expect(analyserAdresseMandataire('http://mandataire.exemple.test')).toEqual({
      erreur: 'Port obligatoire : http://hôte:port.',
    });
  });

  it('refuse un identifiant dans l’adresse, un chemin, un paramètre, un fragment, un autre schéma', () => {
    const cas: [string, RegExp][] = [
      ['http://compte:secret@mandataire.exemple.test:3128', /identifiant/],
      ['http://compte@mandataire.exemple.test:3128', /identifiant/],
      ['http://mandataire.exemple.test:3128/', /chemin/],
      ['http://mandataire.exemple.test:3128/proxy', /chemin/],
      ['http://mandataire.exemple.test:3128?x=1', /paramètre/],
      ['http://mandataire.exemple.test:3128#x', /fragment/],
      ['https://mandataire.exemple.test:3128', /https:\/\/ non pris en charge/],
      ['HTTPS://mandataire.exemple.test:3128', /https:\/\/ non pris en charge/],
      ['socks5://mandataire.exemple.test:1080', /http:\/\/hôte:port/],
      ['mandataire.exemple.test:3128', /http:\/\/hôte:port/],
      ['ftp://mandataire.exemple.test:21', /http:\/\/hôte:port/],
    ];
    for (const [a, motif] of cas) {
      const r = analyserAdresseMandataire(a);
      expect('erreur' in r && r.erreur, a).toMatch(motif);
    }
  });

  it('refuse un hôte invalide : IPv4 mal formée, IPv6 sans crochets ou mal formée, nom invalide', () => {
    for (const a of [
      'http://999.1.1.1:3128',
      'http://10.0.0:3128',
      'http://10.0.0.08:3128',
      'http://1.2.3.4.5:3128',
      'http://2001:db8::1:3128',
      'http://[2001:db8:::1]:3128',
      'http://[2001:db8::1::2]:3128',
      'http://[gggg::1]:3128',
      'http://[1:2:3:4:5:6:7:8:9]:3128',
      'http://[2001:db8::1%eth0]:3128',
      'http://mandataire_interne:3128',
      'http://-mandataire:3128',
      'http://mandataire..exemple:3128',
      'http://man dataire:3128',
      'http://:3128',
      `http://${'a'.repeat(64)}.exemple:3128`,
    ])
      expect('erreur' in analyserAdresseMandataire(a), a).toBe(true);
  });

  it('IPv4 et IPv6 : formes admises', () => {
    expect(estIpv4('0.0.0.0')).toBe(true);
    expect(estIpv4('255.255.255.255')).toBe(true);
    expect(estIpv4('256.0.0.1')).toBe(false);
    expect(estIpv6('::')).toBe(true);
    expect(estIpv6('2001:db8:0:0:0:0:0:1')).toBe(true);
    expect(estIpv6('::ffff:10.0.0.1')).toBe(true);
    expect(estIpv6('2001:db8:0:0:0:0:0')).toBe(false);
    expect(estIpv6('1:2:3:4:5:6:7::8:9')).toBe(false);
  });
});

describe('réglage du mandataire', () => {
  it('inactif par défaut, sans adresse ; activer exige une adresse', () => {
    expect(REGLAGE_MANDATAIRE_DEFAUT).toEqual({
      actif: false,
      adresse: '',
      identifiant: '',
      autoriteCertification: '',
    });
    expect(ReglageMandataire.safeParse(REGLAGE_MANDATAIRE_DEFAUT).success).toBe(true);
    expect(reglage('').success).toBe(false);
    expect(reglage('', { actif: false }).success).toBe(true);
  });
  it('identifiant sans deux-points ni caractère de contrôle ; autorité PEM ; aucun champ inattendu', () => {
    expect(reglage('http://proxy:3128', { identifiant: 'compte-veille' }).success).toBe(true);
    expect(reglage('http://proxy:3128', { identifiant: 'a:b' }).success).toBe(false);
    expect(reglage('http://proxy:3128', { identifiant: 'a\r\nb' }).success).toBe(false);
    expect(reglage('http://proxy:3128', { autoriteCertification: 'pas un certificat' }).success).toBe(false);
    expect(
      reglage('http://proxy:3128', {
        autoriteCertification: '-----BEGIN CERTIFICATE-----\nMIIfictif\n-----END CERTIFICATE-----',
      }).success,
    ).toBe(true);
    // Le mot de passe n'est jamais dans le réglage : il s'enregistre à part.
    expect(reglage('http://proxy:3128', { motDePasse: 'x' }).success).toBe(false);
  });
  it('mot de passe : obligatoire, borné, sans caractère de contrôle', () => {
    expect(MandataireMotDePasseBody.safeParse({ password: 'Mdp-fictif:42' }).success).toBe(true);
    expect(MandataireMotDePasseBody.safeParse({ password: '' }).success).toBe(false);
    expect(MandataireMotDePasseBody.safeParse({ password: 'a\nb' }).success).toBe(false);
    expect(MandataireMotDePasseBody.safeParse({ password: 'x'.repeat(501) }).success).toBe(false);
    expect(MandataireMotDePasseBody.safeParse({ password: 'x', extra: 1 }).success).toBe(false);
  });
});

describe('flux et mandataire', () => {
  it('lot P1 : la veille l’utilise ; Tenable et le courriel en accès direct ; les autres pas encore pris en charge', () => {
    expect(Object.keys(USAGE_MANDATAIRE).sort()).toEqual([...FLUX_MODULES].sort());
    const g = fluxParUsageMandataire();
    expect(g.utilise.map((f) => f.id)).toEqual(['veille-vulnerabilites']);
    expect(g.direct.map((f) => f.id)).toEqual(['courriel', 'tenable']);
    expect(g.non_pris_en_charge.map((f) => f.id)).toEqual(['assistant', 'acme', 'antivirus', 'mises-a-jour']);
  });
  it('mandataire actif : la ligne de pare-feu de la veille devient la sortie vers le mandataire, destinations inchangées', () => {
    const veille = fluxExterne('veille-vulnerabilites');
    expect(fluxSelonMandataire(veille, false)).toBe(veille);
    const par = fluxSelonMandataire(veille, true);
    expect(par.pareFeu).toEqual([PARE_FEU_MANDATAIRE]);
    expect(PARE_FEU_MANDATAIRE).toMatch(/vers le mandataire.*port réglé/);
    expect(par.destinations).toEqual(veille.destinations);
    expect(passeParMandataire('veille-vulnerabilites', true)).toBe(true);
    expect(passeParMandataire('veille-vulnerabilites', false)).toBe(false);
    // Les autres flux ne changent pas : aucun n'est présenté comme passant par le mandataire.
    for (const f of FLUX_EXTERNES.filter((x) => x.id !== 'veille-vulnerabilites')) {
      expect(fluxSelonMandataire(f, true), f.id).toBe(f);
      expect(passeParMandataire(f.id, true), f.id).toBe(false);
    }
  });
});
