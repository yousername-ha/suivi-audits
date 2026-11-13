/* Frise de maquette : périodes réelles des actions et occurrences existantes du jeu fictif.
   Aucun score, échéance ou occurrence générée ; aucune lecture/écriture de l'application. */
(() => {
  'use strict';
  const DAY = 86400000;
  const stamp = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? Date.parse(d + 'T00:00:00Z') : NaN;
  const iso = (n) => new Date(n).toISOString().slice(0, 10);
  const monday = (n) => n - ((new Date(n).getUTCDay() + 6) % 7) * DAY;
  const dayLabel = (n) => new Date(n).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const monthLabel = (n) => new Date(n).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const validationTone = (v) => v === 'OK' ? 'teal' : v === 'KO' ? 'red' : v === 'NA' ? 'muted' : 'amber';
  let current;

  function render(items, api) {
    current = { ...api, items };
    const { state, data, E, icon, date, isLate, isClosed, statuses, detail, chip } = api;
    const recurrent = state.page === 'recurrences';
    const scale = recurrent ? window.STUDIO_SCALE.resolve(items, api) : null;
    const today = stamp(data.date), days = scale?.days || state.timelineDays || 42;
    const start = scale?.start ?? state.timelineStart ?? monday(today - Math.floor(days / 2) * DAY), end = start + days * DAY - DAY;
    const position = (n) => (n - start) / (days * DAY) * 100;
    const pct = (n) => Math.min(100, Math.max(0, position(n)));
    const hasToday = today >= start && today <= end;
    const dated = [], undated = [], invalid = [];
    for (const o of items) {
      const dates = [o.start, o.due].filter(Boolean), a = stamp(o.start), b = stamp(o.due);
      if (!dates.length) { undated.push(o); continue; }
      if (dates.some((d) => !Number.isFinite(stamp(d))) || (Number.isFinite(a) && Number.isFinite(b) && a > b)) { invalid.push(o); continue; }
      if (recurrent && !Number.isFinite(b)) { undated.push(o); continue; }
      dated.push({ o, a: Number.isFinite(a) ? a : b, b: Number.isFinite(b) ? b : a });
    }
    const visible = dated.filter(({ a, b }) => b >= start && a <= end), outside = dated.filter(({ a, b }) => b < start || a > end);
    const monthCells = [];
    for (let cursor = start; cursor <= end;) {
      const d = new Date(cursor), next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1), stop = Math.min(end + DAY, next);
      monthCells.push(`<span style="width:${(stop - cursor) / (days * DAY) * 100}%">${monthLabel(cursor)}</span>`);
      cursor = stop;
    }
    const weeks = scale ? window.STUDIO_SCALE.tickMarkup(scale,E) : Array.from({ length: Math.ceil(days / 7) }, (_, i) => `<span>${dayLabel(start + i * 7 * DAY)}</span>`).join('');
    const weekends = scale ? '' : Array.from({ length: days }, (_, i) => ({ n: start + i * DAY, i })).filter(({ n }) => [0, 6].includes(new Date(n).getUTCDay())).map(({ i }) => `<i class="frise-weekend" style="left:${i / days * 100}%;width:${100 / days}%"></i>`).join('');
    const grid = scale ? window.STUDIO_SCALE.grid(scale,today) : `<div class="frise-grid" aria-hidden="true" style="--week-size:${7 / days * 100}%">${weekends}${hasToday ? `<i class="frise-now-line" style="left:${position(today)}%"></i>` : ''}</div>`;
    const selected = (list) => list.some(({ o }) => o.id === state.expanded);
    const inlineDetail = (list) => {
      const match = list.find(({ o }) => o.id === state.expanded);
      return match ? `<div class="frise-inline-detail" id="detail-${match.o.id}">${detail(match.o)}</div>` : '';
    };
    const identity = (o, options = {}) => {
      const color = options.color || (isLate(o) ? 'red' : statuses[o.status]?.[1] || 'blue');
      const footer = options.footer || `${chip(...statuses[o.status])}${isLate(o) ? `<small class="frise-alert">${icon('warning')}${Math.round((today-stamp(o.due))/DAY)} j de retard</small>` : `<small class="count-note">Éch. ${dayLabel(stamp(o.due) || stamp(o.start))}</small>`}`;
      return `<button class="frise-identity" data-tone="${color}" data-frise-read="${options.first || o.id}" aria-label="Lire ${options.cycle ? 'la série ' : ''}${E(o.name)}"><span class="identity-seal" data-cycle="${!!options.cycle}">${icon(options.cycle ? 'cycle' : isLate(o) ? 'warning' : statuses[o.status]?.[2] || 'list')}</span><span class="identity-text"><span class="identity-code">${E(options.code || o.id)}<span> / ${E(o.ref)}</span></span><strong>${E(o.name)}</strong><span class="frise-sub">${icon(options.cycle ? 'cycle' : 'user')}${options.cycle ? E(o.rhythm)+' · ' : ''}${E(o.owner || 'Non attribuée')}</span><span class="identity-footer">${footer}</span></span></button>`;
    };
    let content, groupCount = 0;
    if (recurrent) {
      const groups = new Map();
      for (const entry of visible) { const key = entry.o.seriesId || entry.o.id; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(entry); }
      groupCount = groups.size;
      content = [...groups.entries()].map(([id, list]) => {
        list.sort((a, b) => a.b - b.b);
        const sample = list[0].o, pending = list.filter(({ o }) => !o.validation).length, late = list.filter(({ o }) => isLate(o)).length, ko = list.filter(({ o }) => o.validation === 'KO').length;
        const first = list.find(({ o }) => !isClosed(o)) || list[0];
        const rowColor = late || ko ? 'red' : pending ? 'blue' : list.every(({o})=>o.validation==='NA') ? 'muted' : 'teal';
        const footer = `<span class="count-note">${list.length} occurrence${list.length>1?'s':''}</span>${pending ? chip(`${pending} en attente`,'amber','clock') : ''}${late ? `<small class="frise-alert">${icon('warning')}${late} en retard</small>` : ko ? `<small class="frise-alert">${icon('warning')}${ko} résultat KO</small>` : `<small class="frise-positive">${icon('check')}Aucun retard</small>`}`;
        return `<article class="frise-row" data-tone="${rowColor}" data-series="${E(id)}" data-expanded="${selected(list)}"><div class="frise-row-grid">${identity(sample,{color:rowColor,cycle:true,first:first.o.id,code:id,footer})}<div class="frise-lane" data-tone="blue" data-occurrences="true">${grid}<div class="frise-occ-guide" aria-hidden="true" style="left:${pct(list[0].b)}%;width:${pct(list.at(-1).b) - pct(list[0].b)}%"></div>${list.map(({ o, b }) => {
          const validation = o.validation || 'En attente', color = validationTone(o.validation), late = isLate(o);
          const label = `${o.id} — ${o.name}, échéance le ${date(o.due)}, ${validation}${late ? ', en retard' : ''}`;
          return `<button class="frise-dot ${late ? 'is-late' : ''} ${state.expanded === o.id ? 'is-selected' : ''}" data-frise-read="${o.id}" data-mark="${o.id}" data-tone="${color}" data-position="${pct(b)}" data-due="${o.due}" style="left:clamp(23px,${pct(b)}%,calc(100% - 23px))" aria-label="${E(label)}" aria-expanded="${state.expanded === o.id}" title="${E(label)}"><i class="node-stem" aria-hidden="true"></i><span class="node-diamond">${icon(o.validation === 'OK' ? 'check' : o.validation === 'KO' ? 'close' : o.validation === 'NA' ? 'blocked' : 'clock')}</span><small>${dayLabel(b)}</small><em>${late ? 'En retard' : o.validation || 'À valider'}</em></button>`;
        }).join('')}</div></div>${inlineDetail(list)}</article>`;
      }).join('');
    } else {
      content = visible.map(({ o, a, b }) => {
        const [label, color, glyph] = statuses[o.status], late = isLate(o), left = pct(a), width = Math.max(1.1, pct(b + DAY) - left), clipped = a < start || b > end;
        const description = `${o.name}, ${label}, du ${date(iso(a))} au ${date(iso(b))}${late ? ', en retard' : ''}, ${o.owner || 'responsable non attribué'}`;
        return `<article class="frise-row" data-tone="${late?'red':color}" data-id="${o.id}" data-expanded="${state.expanded === o.id}"><div class="frise-row-grid">${identity(o)}<div class="frise-lane" data-tone="${color}">${grid}<span class="frise-action-guide" aria-hidden="true" data-tone="${color}" style="width:${left}%"></span><button class="frise-bar ${late ? 'is-late' : ''} ${state.expanded === o.id ? 'is-selected' : ''}" data-frise-read="${o.id}" data-mark="${o.id}" data-tone="${color}" data-start="${iso(a)}" data-end="${iso(b)}" data-short="${width < 24}" style="left:${left}%;width:${width}%" aria-label="${E(description)}" aria-expanded="${state.expanded === o.id}" title="${E(description)}"><i class="bar-start"></i><span><b>${a < start ? '‹ ' : ''}${dayLabel(a)}</b><i>→</i><b>${dayLabel(b)}${b > end ? ' ›' : ''}</b></span><i class="bar-end">${icon(glyph)}</i><small class="ribbon-due">${dayLabel(b)}</small></button>${clipped ? '<span class="sr-only">Période partiellement hors du cadre affiché.</span>' : ''}</div></div>${inlineDetail([{ o }])}</article>`;
      }).join('');
    }
    const detached = items.find(o => o.id === state.expanded && !visible.some(p => p.o.id === o.id));
    const missing = (list, label, explain) => !list.length ? '' : `<section class="frise-extras"><header><strong>${label} <b>${list.length}</b></strong><span>${explain}</span></header><div>${list.map((o) => `<button class="button small" data-detached-read="${o.id}">${E(o.name)}</button>`).join('')}</div></section>`;
    return `<section class="studio-timeline" aria-label="Timeline ${recurrent ? 'des occurrences récurrentes' : 'des actions'}" data-days="${days}" ${scale ? `data-scale="${scale.unit}" data-scale-choice="${scale.chosen}"` : ''} data-start="${iso(start)}" data-end="${iso(end)}"><header class="frise-tools"><div class="frise-range"><span class="eyebrow">${recurrent ? "Récurrences" : "Plan d’actions"} / Timeline</span><strong>${recurrent ? "Le rythme de vos contrôles" : "L’horizon de vos actions"}</strong><p>${scale ? E(scale.fullRange) : `${dayLabel(start)} — ${dayLabel(end)} ${new Date(end).getUTCFullYear()}`}</p></div><div class="frise-navigation">${scale ? window.STUDIO_SCALE.choices(scale) : `<div class="frise-zoom" aria-label="Échelle de la Timeline">${[[14,'2 semaines'],[42,'6 semaines'],[91,'3 mois']].map(([length,label])=>`<button data-zoom="${length}" aria-pressed="${days === length}">${label}</button>`).join('')}</div>`}<button class="button small" data-period="prev" aria-label="Période précédente">‹</button><button class="button small" data-period="today">Aujourd’hui</button><button class="button small" data-period="next" aria-label="Période suivante">›</button><button class="button quiet small" data-period="all">Tout afficher</button></div></header>${scale ? window.STUDIO_SCALE.context(scale,api) : ''}<div class="frise-legend">${recurrent ? [['amber','clock','En attente'],['teal','check','Validée OK'],['red','close','Validée KO'],['muted','blocked','Validée NA']].map(([color,glyph,label])=>`<span data-tone="${color}"><i class="legend-square">${icon(glyph)}</i>${label}</span>`).join('') : Object.values(statuses).filter(([label])=>label!=='Annulée').map(([label,color,glyph])=>`<span data-tone="${color}"><i class="legend-bar">${icon(glyph)}</i>${label}</span>`).join('')}<span class="legend-late">${icon('warning')}Contour rouge : en retard</span><span class="legend-today"><i></i>Aujourd’hui</span></div><div class="frise-board"><div class="frise-axis frise-row-grid"><aside class="frise-control-tower" aria-label="Repères de la période"><span class="tower-count">${icon(recurrent?'cycle':'gantt')}<b>${visible.length}</b></span><div class="tower-text"><span class="eyebrow">Dans cet horizon</span><strong>${recurrent?'Occurrences':'Actions datées'}</strong><small>${recurrent?`${groupCount} séries représentées`:`${new Set(visible.map(({o})=>o.plan)).size} plans représentés`}<br>${visible.filter(({o})=>isLate(o)).length} en retard · ${visible.filter(({o})=>isClosed(o)).length} ${recurrent?'validées':'terminées'}</small></div></aside><div class="frise-axis-dates" style="--now-position:${position(today)}%"><div class="frise-months">${scale ? window.STUDIO_SCALE.bandMarkup(scale,E) : monthCells.join('')}</div><div class="frise-now-sky"><i class="frise-now-rail" aria-hidden="true"></i>${hasToday?`<button class="frise-orb" data-period="today" aria-label="Recentrer la Timeline sur le ${date(data.date)}"><i class="orb-rim" aria-hidden="true"></i>${icon('clock')}<strong>${new Date(today).getUTCDate()}</strong><small>${new Date(today).toLocaleDateString('fr-FR',{month:'long',timeZone:'UTC'})}</small><span class="orb-caption">Aujourd’hui</span></button>`:'<span class="frise-now-outside">Aujourd’hui est hors de cette période</span>'}</div><div class="frise-weeks ${scale?'scale-ticks':''}" style="grid-template-columns:repeat(${Math.ceil(days / 7)},minmax(0,1fr))">${weeks}</div></div></div>${content || `<p class="empty">${E(scale?.emptyMessage || 'Aucun élément dans cette période. Les autres éléments restent accessibles ci-dessous.')}</p>`}</div><footer class="frise-caption"><span>${icon(recurrent ? 'cycle' : 'gantt')}${recurrent ? `${visible.length} occurrences · un repère par échéance, regroupées par série` : `${visible.length} actions datées · les barres représentent les périodes prévues`}</span><span>Sélectionnez ${recurrent ? 'un repère' : 'une ligne'} pour déplier sa fiche.</span></footer>${missing(outside.map(({o})=>o),'Hors période','Déplacez la période ou sélectionnez un élément.')}${missing(undated,'Sans échéance exploitable','Aucune date n’est ajoutée pour les placer.')}${missing(invalid,'Dates à corriger','Une date est illisible ou le début dépasse l’échéance.')}${detached ? `<section class="frise-detached" id="detail-${detached.id}">${detail(detached)}</section>` : ''}</section>`;
  }

  function layout() {
    document.querySelectorAll('.frise-lane[data-occurrences]').forEach((lane) => {
      const left = lane.getBoundingClientRect().left, levels = [];
      const marks = [...lane.querySelectorAll('.frise-dot')].sort((a,b)=>Number(a.dataset.position)-Number(b.dataset.position));
      for (const mark of marks) {
        const box = mark.getBoundingClientRect(), x = box.left - left;
        let level = levels.findIndex((right) => right + 5 <= x);
        if (level < 0) level = levels.length;
        levels[level] = x + box.width;
        mark.style.top = `${22 + level * 74}px`;
        const stem = mark.querySelector('.node-stem');
        stem.style.top = `${13 - level * 74}px`; stem.style.height = `${level * 74}px`;
      }
      lane.style.minHeight = `${Math.max(107, levels.length * 74 + 18)}px`;
    });
  }
  function navigate(action, value) {
    if (!current) return;
    if (current.state.page === 'recurrences') { window.STUDIO_SCALE.navigate(current,action,value); return; }
    const { state, data } = current, today = stamp(data.date), days = state.timelineDays || 42;
    const start = state.timelineStart ?? monday(today - Math.floor(days / 2) * DAY);
    if (action === 'zoom') { state.timelineDays = Number(value); state.timelineStart = monday(today - Math.floor(Number(value) / 2) * DAY); }
    else if (value === 'today') state.timelineStart = monday(today - Math.floor(days / 2) * DAY);
    else if (value === 'all') {
      const source = state.page === 'actions' ? data.actions : data.occurrences;
      const dates = source.flatMap(o=>[stamp(o.start),stamp(o.due)]).filter(Number.isFinite);
      const min = Math.min(today,...dates), max = Math.max(today,...dates);
      state.timelineStart = monday(min - 3 * DAY); state.timelineDays = Math.max(14,Math.ceil((max + 4 * DAY - state.timelineStart)/DAY/7)*7);
    } else state.timelineStart = start + (value === 'prev' ? -days : days) * DAY;
  }
  window.STUDIO_TIMELINE = { render, layout, navigate };
  let lastWidth;
  new ResizeObserver((entries)=>{const width=entries[0].contentRect.width;if(width!==lastWidth){lastWidth=width;requestAnimationFrame(layout);}}).observe(document.documentElement);
})();
