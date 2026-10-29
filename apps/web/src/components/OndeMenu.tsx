/* Onde en fond de panneau (décorative, aria-hidden) : grille en perspective, onde sonore sur l'horizon, particules.
   Géométrie : onde-menu.ts. Le canevas suit la taille de son parent positionné ; 30 images/s au plus ; rien si moins de
   mouvement est demandé, sous un automate de test ou à l'impression. Option `connexion` (écran de connexion seulement) :
   horizon mesuré entre le titre et la première carte, onde signée en dégradé ; sans elle, rendu par défaut inchangé. */
import { transparence } from '@suivi/ui';
import { useEffect, useRef } from 'react';
import { imageDue, type Teinte } from '../connexion/fond-geometrie';
import {
  grillePerspective,
  ondeHorizon,
  ondeSignee,
  ondeVisible,
  PALETTE_CONNEXION,
  PALETTE_ONDE,
  particules,
  type DispositionConnexion,
  type Point,
} from './onde-menu';

const automate = () => typeof navigator !== 'undefined' && navigator.webdriver === true;

export function OndeMenu({ connexion }: { connexion?: DispositionConnexion }) {
  const cadre = useRef<HTMLDivElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  // Lue à chaque image : un changement de disposition ne relance pas l'animation.
  const disposition = useRef(connexion);
  useEffect(() => {
    disposition.current = connexion;
  }, [connexion]);

  useEffect(() => {
    const div = cadre.current;
    const cv = toile.current;
    const ctx = cv?.getContext('2d');
    if (!div || !cv || !ctx || typeof window.matchMedia !== 'function') return;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)');
    const impression = window.matchMedia('print');
    const styles = getComputedStyle(document.documentElement);
    const lues = new Map<string, string>();
    const lire = (v: string) => {
      if (!lues.has(v)) lues.set(v, styles.getPropertyValue(v).trim());
      return lues.get(v)!;
    };
    const coul = ([v, a]: Teinte, f = 1) => transparence(lire(v), a * f);
    let l = 0;
    let h = 0;

    const ajuster = () => {
      const d = window.devicePixelRatio || 1;
      l = div.clientWidth;
      h = div.clientHeight;
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

      const d = disposition.current;
      const { rangees, fuyantes } = grillePerspective(t, l, h, d?.horizon);
      ctx.lineWidth = 1;
      for (const r of [...fuyantes, ...rangees]) {
        ctx.strokeStyle = coul(PALETTE_ONDE.grille, r.opacite);
        tracer(r.points);
        ctx.stroke();
      }

      if (d) dessinerSignee(t, d);
      else dessinerCretes(t);

      for (const p of particules(t, l, h)) {
        ctx.fillStyle = coul(PALETTE_ONDE.particule, p.opacite);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    /** Rendu par défaut : crêtes au-dessus de l'horizon, traits fins en dessous. */
    const dessinerCretes = (t: number) => {
      const { cretes, traits } = ondeHorizon(t, l, h);
      ctx.strokeStyle = coul(PALETTE_ONDE.trait);
      ctx.beginPath();
      for (const s of traits) {
        ctx.moveTo(s.x, s.y1);
        ctx.lineTo(s.x, s.y2);
      }
      ctx.stroke();
      ctx.save();
      ctx.shadowColor = coul(PALETTE_ONDE.crete);
      ctx.shadowBlur = 14;
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = coul(PALETTE_ONDE.lueur);
      tracer(cretes);
      ctx.stroke();
      ctx.restore();
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = coul(PALETTE_ONDE.crete);
      tracer(cretes);
      ctx.stroke();
    };

    /** Écran de connexion : surface et traits signés, ligne centrale, onde lumineuse en dégradé. */
    const dessinerSignee = (t: number, d: DispositionConnexion) => {
      const P = PALETTE_CONNEXION;
      const { y0, signal, traits } = ondeSignee(t, l, h, d);
      const degrade = (opacite: number) => {
        const g = ctx.createLinearGradient(0, 0, l, 0);
        g.addColorStop(0, transparence(lire(P.bord), opacite));
        g.addColorStop(0.5, transparence(lire(P.centre), opacite));
        g.addColorStop(1, transparence(lire(P.bord), opacite));
        return g;
      };

      ctx.fillStyle = degrade(P.surface);
      tracer(signal);
      ctx.lineTo(l, y0);
      ctx.lineTo(0, y0);
      ctx.closePath();
      ctx.fill();

      ctx.lineWidth = 1;
      ctx.strokeStyle = degrade(P.traits);
      ctx.beginPath();
      for (const s of traits) {
        ctx.moveTo(s.x, s.y1);
        ctx.lineTo(s.x, s.y2);
      }
      ctx.stroke();

      ctx.strokeStyle = degrade(P.ligne);
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(l, y0);
      ctx.stroke();

      ctx.save();
      ctx.shadowColor = transparence(lire(P.centre), P.onde);
      ctx.shadowBlur = P.flou;
      ctx.lineWidth = P.epaisseur;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = degrade(P.onde);
      tracer(signal);
      ctx.stroke();
      ctx.restore();
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
      ctx.clearRect(0, 0, l, h);
      if (ondeVisible({ webdriver: automate(), impression: impression.matches, mouvementReduit: reduit.matches }))
        image = requestAnimationFrame(boucle);
    };

    ajuster();
    demarrer();
    const taille = new ResizeObserver(ajuster);
    taille.observe(div);
    reduit.addEventListener('change', demarrer);
    impression.addEventListener('change', demarrer);
    return () => {
      cancelAnimationFrame(image);
      taille.disconnect();
      reduit.removeEventListener('change', demarrer);
      impression.removeEventListener('change', demarrer);
    };
  }, []);

  if (automate()) return null;
  return (
    <div ref={cadre} className="onde-menu" aria-hidden="true">
      <canvas ref={toile} className="onde-menu__toile" />
    </div>
  );
}
