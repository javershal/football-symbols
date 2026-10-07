// Possession Strips front end. Renders site/data JSON; no framework, no build step.
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const ROOT = new URL(document.baseURI).pathname; // e.g. /football-symbols/ — every link is relative to it
const S = {meta: null, legend: null, teams: null, season: null, cache: new Map(), route: null};

function getJSON(path, opts) {
  if (!S.cache.has(path)) {
    S.cache.set(path, fetch('data/' + path, opts).then(r => {
      if (!r.ok) throw new Error(path + ': ' + r.status);
      return r.json();
    }).catch(e => { S.cache.delete(path); throw e; }));
  }
  return S.cache.get(path);
}

// ---------- formatting ----------
const PT = 'America/Los_Angeles';
// Game dates come straight from the schedule's gameday (no timezone math); `kickoff` (UTC) only drives In progress.
const asDate = day => new Date(day + 'T12:00:00Z');
const fmtDay = day => asDate(day).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC'});
const gameDate = g => fmtDay(g.day);
const started = g => Date.now() >= Date.parse(g.kickoff);
const name = t => S.teams.teams[t].name;

const HALVES = ['First half', 'Second half', 'Overtime'];
function stripHTML(team, parts) {
  const lbl = S.legend.label;
  const label = team + ' drives. ' + parts.map((p, i) => HALVES[i] + ': ' + (p.length ? p.map(e => lbl[e]).join(', ') : 'none')).join('. ');
  const pipe = `<span class="pipe" aria-hidden="true">${esc(S.legend.pipe)}</span>`;
  return `<span class="s" role="img" aria-label="${esc(label)}">${parts.map(p => p.join('')).join(pipe)}</span>`;
}
function stamp(t, link = true) {
  const [c1, c2] = S.teams.teams[t].colors;
  const style = `background:${c1};box-shadow:3px 3px 0 ${c2}`;
  return link
    ? `<a class="stamp" href="team/${t}/" style="${style}" aria-label="${esc(S.teams.teams[t].city + ' ' + name(t))}">${t}</a>`
    : `<span class="stamp" style="${style}">${t}</span>`;
}

// Shrink every strip in a [data-fit] group together until the longest fits (prototype's fit()).
const BASE = 20;
function fit(root = document) {
  root.querySelectorAll('[data-fit]').forEach(group => {
    const ss = [...group.querySelectorAll('.strip .s')];
    if (!ss.length) return;
    ss.forEach(s => s.style.fontSize = BASE + 'px');
    const room = s => s.parentElement.clientWidth - 2;
    let f = BASE * Math.min(1, ...ss.map(s => room(s) / s.getBoundingClientRect().width));
    const set = () => ss.forEach(s => s.style.fontSize = f.toFixed(2) + 'px');
    set();
    for (let k = 0; k < 8 && ss.some(s => s.getBoundingClientRect().width > room(s)); k++) { f *= .97; set(); }
  });
}
let fitRaf = 0;
addEventListener('resize', () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(() => fit()); });

// ---------- clipboard, toast ----------
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1600);
}
async function copy(txt, msg) {
  try { await navigator.clipboard.writeText(txt); } catch (_) {
    const t = document.createElement('textarea');
    t.value = txt; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (__) {}
    t.remove();
  }
  toast(msg);
}

// ---------- Scores view ----------
function gameCard(g, i) {
  const head = `${esc(name(g.away))} at ${esc(name(g.home))}`;
  if (!g.final) {
    const live = started(g);
    return `<article class="card"><div class="ch"><span class="t">${head}</span><span class="tag ${live ? 'live' : ''}">${live ? 'In progress' : 'Upcoming'}</span></div>
      <div class="up">${stamp(g.away)}<span class="when">${live ? 'Strips post after the final whistle' : gameDate(g)}</span></div>
      <div class="up">${stamp(g.home)}<span class="when">&nbsp;</span></div></article>`;
  }
  const row = (t, parts, pts, opp) => `<div class="row ${pts > opp ? 'win' : ''}">${stamp(t)}<div class="strip">${stripHTML(t, parts)}</div><span class="pts">${pts}</span></div>`;
  return `<article class="card" data-fit data-game="${esc(g.id)}"><div class="ch"><span class="t">${head}</span><button class="tag copy" data-copy="${i}" aria-label="Copy ${head} to clipboard">Copy</button></div>
    ${row(g.away, g.aStrip, g.aScore, g.hScore)}${row(g.home, g.hStrip, g.hScore, g.aScore)}</article>`;
}

function weekNav(cur) {
  const el = $('#weeks');
  el.hidden = false;
  if (!el.children.length) {
    el.innerHTML = Array.from({length: 18}, (_, i) => i + 1).map(w =>
      `<a href="week/${w}/" data-w="${w}" class="${w > S.meta.latestWeek ? 'future' : ''}">${w}</a>`).join('');
  }
  el.querySelectorAll('a').forEach(a => {
    const on = +a.dataset.w === cur;
    a.classList.toggle('on', on);
    if (on) { a.setAttribute('aria-current', 'page'); a.scrollIntoView({block: 'nearest', inline: 'center'}); }
    else a.removeAttribute('aria-current');
  });
}

async function viewWeek({week}) {
  weekNav(week);
  document.title = `Week ${week} · Possession Strips`;
  const data = await getJSON(`${S.season}/weeks/${week}.json`);
  const games = data.games, fin = games.filter(g => g.final);
  const sub = !games.length ? 'No games scheduled'
    : fin.length === games.length ? `${games.length} games · every possession`
    : fin.length ? `${fin.length} of ${games.length} games final`
    : `${games.length} games · kicks off ${fmtDay(games[0].day)}`;
  const v = $('#view');
  v.innerHTML = `<div class="hero"><h1>Week ${week}</h1><div class="acts">
      <div class="nav"><button class="btn" data-go="${week - 1}" aria-label="Previous week" ${week <= 1 ? 'disabled' : ''}>←</button><button class="btn" data-go="${week + 1}" aria-label="Next week" ${week >= 18 ? 'disabled' : ''}>→</button></div></div></div>
    <p class="sub">${esc(sub)}</p>
    <div class="grid">${games.map(gameCard).join('')}</div>`;
  v.onclick = e => {
    const go = e.target.closest('[data-go]');
    if (go) return navigate(`week/${go.dataset.go}/`);
    const c = e.target.closest('[data-copy]');
    if (c) { const g = games[+c.dataset.copy]; return copy(g.copy, 'Copied — ' + g.copy.split(':')[0]); }
  };
  fit(v);
}

// ---------- ledgers (Standings blocks, Team season) ----------
const recText = t => `${t.w}-${t.l}` + (t.t ? `-${t.t}` : '');
const diffText = t => { const d = t.pf - t.pa; return d > 0 ? '+' + d : d < 0 ? '−' + -d : '0'; };
const shortDay = day => asDate(day).toLocaleDateString('en-US', {month: 'numeric', day: 'numeric', timeZone: 'UTC'});
function ledgerRow(team, r) {
  if (r.bye) return `<div class="lr bye"><span class="wk">${r.week}</span><span class="opp">Bye</span><span class="res"></span><span class="strip"></span></div>`;
  const opp = `<span class="opp"><span aria-hidden="true">${r.home ? 'vs' : '@'}</span><span class="sr">${r.home ? 'versus' : 'at'}</span> <a href="team/${r.opp}/">${r.opp}</a></span>`;
  if (!r.final) {
    const live = started(r);
    return `<div class="lr up"><span class="wk">${r.week}</span>${opp}<span class="res">${live ? '<span class="live">Live</span>' : shortDay(r.day)}</span><span class="strip"></span></div>`;
  }
  return `<div class="lr ${r.result.toLowerCase()}"><span class="wk">${r.week}</span>${opp}<span class="res"><b>${r.result}</b> ${r.pf}-${r.pa}</span><div class="strip">${stripHTML(team, r.strip)}</div></div>`;
}
function ledgerHead() {
  return `<div class="lr lh" aria-hidden="true"><span class="wk">Wk</span><span class="opp">Opp</span><span class="res">Result</span><span class="strip">Drives</span></div>`;
}

// ---------- Standings view ----------
const slug = s => s.toLowerCase().replace(/\s+/g, '-');
async function viewStandings() {
  document.title = 'Standings · Possession Strips';
  const st = await getJSON(`${S.season}/standings.json`);
  const block = t => `<section class="card tb" data-fit aria-label="${esc(S.teams.teams[t.team].city + ' ' + name(t.team))}">
      <div class="tbh">${stamp(t.team)}<a class="tn" href="team/${t.team}/">${esc(name(t.team))}</a>
        <span class="rec">${recText(t)}</span><span class="diff" title="Point differential">${diffText(t)}</span></div>
      ${ledgerHead()}${t.games.map(r => ledgerRow(t.team, r)).join('')}</section>`;
  const v = $('#view');
  v.innerHTML = `<div class="hero"><h1>Standings</h1></div>
    <p class="sub">Through Week ${S.meta.latestWeek} · by record, then point differential</p>
    <nav class="jump" aria-label="Jump to division">${st.divisions.map(d => `<button data-jump="${slug(d.name)}">${esc(d.name)}</button>`).join('')}</nav>
    ${st.divisions.map(d => `<section class="division" id="${slug(d.name)}"><h2>${esc(d.name)}</h2>
      <div class="blocks">${d.teams.map(block).join('')}</div></section>`).join('')}`;
  v.onclick = e => {
    const j = e.target.closest('[data-jump]');
    if (j) document.getElementById(j.dataset.jump).scrollIntoView({behavior: 'smooth', block: 'start'});
  };
  fit(v);
}

// ---------- Team view ----------
async function viewTeam({team}) {
  if (!team) return viewTeamIndex();
  const info = S.teams.teams[team];
  document.title = `${info.city} ${info.name} · Possession Strips`;
  const d = await getJSON(`${S.season}/teams/${team}.json`);
  const mode = S.teamMode || 'matchups';
  const matchup = r => {
    if (r.bye) return `<div class="byecard">Week ${r.week} · Bye</div>`;
    const head = `Week ${r.week} · ${r.home ? 'vs' : 'at'} ${esc(name(r.opp))}`;
    if (!r.final) {
      const live = started(r);
      return `<article class="card"><div class="ch"><span class="t">${head}</span><span class="tag ${live ? 'live' : ''}">${live ? 'In progress' : 'Upcoming'}</span></div>
        <div class="up">${stamp(team, false)}<span class="when">${live ? 'Strips post after the final whistle' : gameDate(r)}</span></div>
        <div class="up">${stamp(r.opp)}<span class="when">&nbsp;</span></div></article>`;
    }
    const row = (t, parts, pts, opp, link) => `<div class="row ${pts > opp ? 'win' : ''}">${stamp(t, link)}<div class="strip">${stripHTML(t, parts)}</div><span class="pts">${pts}</span></div>`;
    return `<article class="card" data-fit><div class="ch"><span class="t">${head}</span><span class="tag res-${r.result.toLowerCase()}">${r.result}</span>
        <button class="tag copy" data-copy="${r.week}" aria-label="Copy week ${r.week} game to clipboard">Copy</button></div>
      ${row(team, r.strip, r.pf, r.pa, false)}${row(r.opp, r.oppStrip, r.pa, r.pf, true)}</article>`;
  };
  const body = mode === 'drives'
    ? `<section class="card tb solo" data-fit aria-label="${esc(info.name)} drives by game">${ledgerHead()}${d.games.map(r => ledgerRow(team, r)).join('')}</section>`
    : `<div class="grid">${d.games.map(matchup).join('')}</div>`;
  const v = $('#view');
  v.innerHTML = `<div class="hero team-hero"><div><div class="th-stamp">${stamp(team, false)}<span class="rec big">${recText(d)}</span></div><h1>${esc(info.name)}</h1></div></div>
    <p class="sub">${esc(info.city)} · ${esc(d.division)} · PF ${d.pf} · PA ${d.pa} · ${diffText(d)}</p>
    <div class="seg" role="group" aria-label="Show">
      <button data-mode="matchups" aria-pressed="${mode === 'matchups'}">Vs opponent</button>
      <button data-mode="drives" aria-pressed="${mode === 'drives'}">Our drives</button></div>
    ${body}`;
  v.onclick = e => {
    const m = e.target.closest('[data-mode]');
    if (m) { S.teamMode = m.dataset.mode; return viewTeam({team}); }
    const c = e.target.closest('[data-copy]');
    if (c) { const r = d.games.find(g => g.week === +c.dataset.copy); return copy(r.copy, 'Copied — ' + r.copy.split(':')[0]); }
  };
  fit(v);
}
async function viewTeamIndex() {
  document.title = 'Teams · Possession Strips';
  $('#view').innerHTML = `<div class="hero"><h1>Teams</h1></div><p class="sub">Pick a team to see its season, drive by drive.</p>
    <div class="tidx">${Object.entries(S.teams.divisions).map(([dv, ts]) => `<section><h2>${esc(dv)}</h2>
      <ul>${ts.map(t => `<li><a href="team/${t}/">${stamp(t, false)}<span>${esc(name(t))}</span></a></li>`).join('')}</ul></section>`).join('')}</div>`;
}

// ---------- routing: path routes (week/N/, standings/, team/ABBR/), #/… hashes accepted ----------
function parseRoute() {
  let p = location.pathname.startsWith(ROOT) ? location.pathname.slice(ROOT.length) : '';
  const h = location.hash.match(/^#\/?(.+)$/);
  if (h) p = h[1];
  const r = routeOf(p);
  const canon = ROOT + pathOf(r);
  if (h || (p && canon !== location.pathname)) history.replaceState(null, '', canon); // e.g. #/team/la -> team/LAR/
  return r;
}
function routeOf(p) {
  const [a, b] = p.split('/').filter(Boolean);
  if (a === 'week' && +b >= 1 && +b <= 18) return {view: 'week', week: +b};
  if (a === 'standings') return {view: 'standings'};
  if (a === 'team') {
    const t = b && (S.teams.aliases[b.toUpperCase()] || b.toUpperCase());
    return {view: 'team', team: S.teams.teams[t] ? t : null};
  }
  return {view: 'week', week: S.meta.latestWeek, home: true};
}
function pathOf(r) {
  if (r.view === 'week') return r.home ? '' : `week/${r.week}/`;
  if (r.view === 'team') return r.team ? `team/${r.team}/` : 'team/';
  return 'standings/';
}
const VIEWS = {week: viewWeek, standings: viewStandings, team: viewTeam};
async function render() {
  const r = S.route = parseRoute();
  document.querySelectorAll('.tabs a').forEach(a => {
    const on = a.dataset.tab === r.view;
    a.classList.toggle('on', on);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  if (r.view !== 'week') $('#weeks').hidden = true;
  try { await VIEWS[r.view](r); } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<p class="sub err">Couldn't load this page's data. Try reloading.</p>`;
  }
}
function navigate(href) {
  const url = new URL(href, document.baseURI);
  if (url.pathname + url.search !== location.pathname + location.search) history.pushState(null, '', url);
  render().then(() => window.scrollTo({top: 0}));
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
  const url = new URL(a.href);
  if (url.origin !== location.origin || !url.pathname.startsWith(ROOT) || /\.\w+$/.test(url.pathname)) return;
  e.preventDefault();
  navigate(url.href);
});
addEventListener('popstate', render);
addEventListener('hashchange', render);

// ---------- boot ----------
(async function boot() {
  try {
    [S.meta, S.legend, S.teams] = await Promise.all([
      getJSON('meta.json', {cache: 'no-cache'}), getJSON('legend.json'), getJSON('teams.json')]);
  } catch (e) {
    $('#view').innerHTML = `<p class="sub err">Couldn't load data. Try reloading.</p>`;
    return;
  }
  S.season = S.meta.season;
  S.legend.label = Object.fromEntries(S.legend.outcomes.map(o => [o.emoji, o.label.replace(/^[A-Z](?=[a-z ])/, c => c.toLowerCase())]));
  $('#legend').innerHTML = S.legend.outcomes.map(o => `<div><span>${o.emoji}</span>${esc(o.label)}</div>`).join('');
  const u = new Date(S.meta.updated);
  $('#updated').textContent = 'Updated ' + u.toLocaleString('en-US', {month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: PT}) + ' PT.';
  await render();
  if (document.fonts) document.fonts.ready.then(() => fit());
})();
