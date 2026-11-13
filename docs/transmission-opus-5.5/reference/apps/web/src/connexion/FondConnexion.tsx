/* Fond animé de l'écran de connexion, derrière le panneau (décoratif, aria-hidden). Géométrie : fond-geometrie.ts.
   Teintes lues sur les variables de la charte ; 30 images/s au plus, image fixe si moins de mouvement est demandé,
   rien sous un automate de test (captures stables) ni à l'impression. */
import { useComputedColorScheme } from '@mantine/core';
import { transparence } from '@suivi/ui';
import { useEffect, useRef } from 'react';
import {
  barres,
  courbePrincipale,
  courbesPointillees,
  halos,
  imageDue,
  INSTANT_FIXE,
  lignesGrille,
  modeAnimation,
  noeuds,
  PALETTES,
  type Point,
  type Teinte,
} from './fond-geometrie';

const automate = () => typeof navigator !== 'undefined' && navigator.webdriver === true;

export function FondConnexion() {
  const toile = useRef<HTMLCanvasElement>(null);
  const schema = useComputedColorScheme('light');

  useEffect(() => {
    const cv = toile.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx || typeof window.matchMedia !== 'function') return;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)');
    const impression = window.matchMedia('print');
    const styles = getComputedStyle(document.documentElement);
    const lues = new Map<string, string>();
    const lire = (v: string) => {
      if (!lues.has(v)) lues.set(v, styles.getPropertyValue(v).trim());
      return lues.get(v)!;
    };
    const palette = PALETTES[schema === 'dark' ? 'sombre' : 'clair'];
    const fond = lire('--suivi-fond-page');
    const coul = ([v, a]: Teinte, f = 1) => transparence(lire(v), a * f);
    let l = 0;
    let h = 0;

    const ajuster = () => {
      const d = window.devicePixelRatio || 1;
      l = window.innerWidth;
      h = window.innerHeight;
      cv.width = Math.round(l * d);
      cv.height = Math.round(h * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    const tracer = (p: Point[]) => {
      ctx.beginPath();
      p.forEach((q, j) => (j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    };

    const dessiner = (t: number) => {
      ctx.clearRect(0, 0, l, h);

      ctx.lineWidth = 1;
      ctx.strokeStyle = coul(palette.grille);
      ctx.beginPath();
      for (const s of lignesGrille(t, l, h)) {
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      }
      ctx.stroke();

      for (const b of barres(t, l, h)) {
        const g = ctx.createLinearGradient(0, b.y, 0, h);
        g.addColorStop(0, coul(palette.barre, 0));
        g.addColorStop(1, coul(palette.barre));
        ctx.fillStyle = g;
        ctx.fillRect(b.x, b.y, b.l, b.h);
      }

      for (const o of halos(t, l, h)) {
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, coul(palette.halo));
        g.addColorStop(0.7, coul(palette.halo, 0.43));
        g.addColorStop(1, coul(palette.halo, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.setLineDash([5, 7]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = coul(palette.pointille);
      for (const p of courbesPointillees(t, l, h)) {
        tracer(p);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const p = courbePrincipale(t, l, h);
      ctx.save();
      ctx.shadowColor = coul(palette.ombre);
      ctx.shadowBlur = 24;
      ctx.lineWidth = 16;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = coul(palette.lueur);
      tracer(p);
      ctx.stroke();
      ctx.restore();
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = coul(palette.ligne);
      tracer(p);
      ctx.stroke();

      ctx.font = `600 10px ${lire('--mantine-font-family') || 'sans-serif'}`;
      for (const n of noeuds(t, p)) {
        if (!n.cercle) {
          ctx.fillStyle = coul(palette.point);
          ctx.beginPath();
          ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        if (n.onde) {
          ctx.strokeStyle = coul(palette.onde, n.onde.opacite);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.onde.r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = fond;
        ctx.strokeStyle = coul(palette.anneau);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = coul(palette.centre);
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        if (n.libelle) {
          ctx.fillStyle = coul(palette.texte);
          ctx.fillText(n.libelle, n.x + 14, n.y + 22);
        }
      }
    };

    let image = 0;
    let derniere = -Infinity;
    const debut = performance.now();
    const boucle = (m: number) => {
      image = requestAnimationFrame(boucle);
      if (!imageDue(m, derniere)) return;
      derniere = m;
      dessiner((m - debut) / 1000);
    };
    const demarrer = () => {
      cancelAnimationFrame(image);
      const mode = modeAnimation({
        webdriver: automate(),
        impression: impression.matches,
        mouvementReduit: reduit.matches,
      });
      if (mode === 'aucun') ctx.clearRect(0, 0, l, h);
      else if (mode === 'fixe') dessiner(INSTANT_FIXE);
      else image = requestAnimationFrame(boucle);
    };
    const redimensionner = () => {
      ajuster();
      if (reduit.matches) demarrer();
    };

    ajuster();
    demarrer();
    window.addEventListener('resize', redimensionner);
    reduit.addEventListener('change', demarrer);
    impression.addEventListener('change', demarrer);
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener('resize', redimensionner);
      reduit.removeEventListener('change', demarrer);
      impression.removeEventListener('change', demarrer);
    };
  }, [schema]);

  if (automate()) return null;
  return <canvas ref={toile} className="auth-fond" aria-hidden="true" />;
}
