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
  return `<article class="card linked" data-fit data-game="${esc(g.id)}"><div class="ch"><a class="t" href="game/${esc(g.id)}/">${head}</a><button class="tag copy" data-copy="${i}" aria-label="Copy ${head} to clipboard">Copy</button></div>
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
  return `<div class="lr ${r.result.toLowerCase()}"><span class="wk">${r.week}</span>${opp}<a class="res" href="game/${esc(r.id)}/"><b>${r.result}</b> ${r.pf}-${r.pa}</a><div class="strip">${stripHTML(team, r.strip)}</div></div>`;
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
    return `<article class="card linked" data-fit><div class="ch"><a class="t" href="game/${esc(r.id)}/">${head}</a><span class="tag res-${r.result.toLowerCase()}">${r.result}</span>
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

// ---------- Game view: drive picker + drive summary chart ----------
// Play kinds -> family for colour and the run/pass split. Positions are yardline_100 from the offense's view.
const FAMILY = {run: 'run', kneel: 'run', pass: 'pass', inc: 'pass', sack: 'pass', int: 'pass', spike: 'pass', pen: 'pen', punt: 'kick', fg: 'kick'};
const KIND = {run: 'Run', kneel: 'Kneel', pass: 'Pass', inc: 'Incomplete', sack: 'Sack', int: 'Interception', spike: 'Spike', pen: 'Penalty', punt: 'Punt', fg: 'Field goal'};
const COL = {run: 'var(--run)', pass: 'var(--pass)', pen: 'var(--pen)', kick: 'var(--kick)'};
const ORD = ['', '1st', '2nd', '3rd', '4th'];
const gain = p => p.a - p.b;
const signed = n => (n > 0 ? '+' + n : n < 0 ? '−' + -n : '0');
const downText = p => (p.dn ? `${ORD[p.dn]} & ${p.togo >= p.a ? 'Goal' : p.togo}` : '');
function spot(y, team, other) { // yardline_100 -> "ARI 10" / "50" / "LAC 15"
  return y === 50 ? '50' : y > 50 ? `${team} ${100 - y}` : `${other} ${y}`;
}
function driveStats(d) {
  const ps = d.plays, snaps = ps.filter(p => p.k !== 'pen');
  const pct = f => (snaps.length ? Math.round(100 * snaps.filter(p => FAMILY[p.k] === f).length / snaps.length) : 0);
  return {plays: snaps.length, yards: ps.length ? ps[0].a - ps[ps.length - 1].b : 0, time: d.top,
    run: pct('run'), pass: pct('pass'), pens: ps.filter(p => p.pen).length, firsts: ps.filter(p => p.fd).length};
}
function headline(d) { // Madden-style: "34 yard field goal by C.Ryland"
  const last = d.plays[d.plays.length - 1] || {}, yd = last.kick ? `${last.kick} yard ` : '';
  switch (S.legend.outcomes.find(o => o.emoji === d.s)?.key) {
    case 'td': return `Touchdown${d.scorer ? ' — ' + d.scorer : ''}`;
    case 'fg': return `${yd}field goal${d.kicker ? ' by ' + d.kicker : ''}`;
    case 'miss': return `${yd}field goal ${last.fg === 'blocked' ? 'blocked' : 'no good'}`.replace(/^f/, 'F');
    case 'punt': return `Punt${last.kick ? ', ' + last.kick + ' yards' : ''}`;
    case 'to': return !d.plays.length ? 'Fumbled kickoff return' : last.k === 'int' ? 'Intercepted' : 'Fumble lost';
    case 'pick6': return 'Turnover returned for a touchdown';
    case 'downs': return 'Turnover on downs';
    case 'safety': return 'Safety';
    case 'half': return 'End of half';
    default: return 'End of game';
  }
}

// Field chart. Own goal line on the left, always; one row per snap, top to bottom.
// Height fits 15 rows (99% of drives 2016-2025; the max was 23 with every snap) and grows past that.
const ROWS = 15, R = 4.4, TOP = 7, BOT = 7, X = y => 10 + (100 - y);
function fieldSVG(d, opp) {
  const lastI = d.plays.length - 1, H = TOP + Math.max(d.plays.length, ROWS) * R + BOT + 1;
  const [c1] = S.teams.teams[d.team].colors, [o1] = S.teams.teams[opp].colors;
  let s = `<svg viewBox="0 0 120 ${H}" role="img" aria-label="Field chart, ${d.plays.length} snaps">`;
  for (let k = 0; k < 20; k++) s += `<rect x="${10 + k * 5}" y="0" width="5" height="${H}" fill="${k % 2 ? 'var(--field2)' : 'var(--field)'}"/>`;
  s += `<rect x="0" y="0" width="10" height="${H}" fill="${c1}" opacity=".9"/><rect x="110" y="0" width="10" height="${H}" fill="${o1}" opacity=".9"/>`;
  const ez = (t, x, r) => `<text x="${x}" y="${H / 2}" transform="rotate(${r} ${x} ${H / 2})" text-anchor="middle" dominant-baseline="central" fill="#fff" opacity=".85" font-size="5">${t}</text>`;
  s += ez(d.team, 5, -90) + ez(opp, 115, 90);
  for (let y = 10; y <= 110; y += 5) s += `<line x1="${y}" x2="${y}" y1="0" y2="${H}" stroke="#E9E6DA" stroke-width="${y % 10 ? .18 : .4}" opacity="${y % 10 ? .45 : .8}"/>`;
  for (let k = 1; k <= 9; k++) {
    const t = (k <= 5 ? k : 10 - k) * 10;
    s += `<text x="${10 + k * 10}" y="5.3" text-anchor="middle" fill="#E9E6DA" font-size="3.9">${t}</text><text x="${10 + k * 10}" y="${H - 1.9}" text-anchor="middle" fill="#E9E6DA" font-size="3.9">${t}</text>`;
  }
  if (d.plays.length) s += `<line x1="${X(d.plays[0].a)}" x2="${X(d.plays[0].a)}" y1="${TOP - 1}" y2="${H - BOT + 1}" stroke="var(--acc)" stroke-width=".45" stroke-dasharray="1 .8"/>`;
  d.plays.forEach((p, i) => {
    const cy = TOP + i * R + R / 2, xa = X(p.a), xb = X(p.b), fam = FAMILY[p.k], c = COL[fam];
    let m = `<rect class="hit" x="0" y="${TOP + i * R}" width="120" height="${R}"/>`;
    if (i !== lastI) m += `<line x1="${xa}" x2="${xa}" y1="${cy - 1.8}" y2="${cy + 1.8}" stroke="#fff" stroke-width=".5" stroke-linecap="round"/>`;
    if (p.k === 'int') {
      m += `<line x1="${xa}" x2="${X(p.a - (p.air ?? 0))}" y1="${cy}" y2="${cy}" stroke="${c}" stroke-width=".55" stroke-dasharray="1.1 .7"/>`;
    } else if (fam === 'kick') {
      const xt = p.k === 'fg' ? 119.4 : Math.min(X(p.a - (p.kick ?? 0)), 119.4);
      m += `<line x1="${xa}" x2="${xt}" y1="${cy}" y2="${cy}" stroke="${c}" stroke-width=".55" stroke-dasharray=".25 .9" stroke-linecap="round"/>`;
    } else if (xb !== xa) { // incompletions and no-gain plays show only the snap tick
      m += `<rect x="${Math.min(xa, xb)}" y="${cy - 1.3}" width="${Math.abs(xb - xa)}" height="2.6" rx="1.3" fill="${c}"/>`;
    }
    if (p.pen && p.k !== 'pen') m += `<path d="M${xb + .5} ${cy - 1.5}l1.6 1.5l-1.6 1.5z" fill="var(--pen)"/>`;
    if (i === lastI) m += `<text class="em" x="${Math.min(Math.max(xa, 2), 117.6)}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="4.2">${d.s}</text>`;
    s += `<g class="pl" data-p="${i}">${m}</g>`;
  });
  return s + '</svg>';
}
function playCaption(d, opp, i) {
  const p = d.plays[i];
  if (!p) return 'Tap a row, or use the arrow keys, to see each play.';
  const n = gain(p), what = FAMILY[p.k] === 'kick' ? KIND[p.k] : `${KIND[p.k]} · ${signed(n)} yd${Math.abs(n) === 1 ? '' : 's'}`;
  return `<b>${i + 1}. ${[downText(p), `Q${p.q} ${p.t}`, spot(p.a, d.team, opp)].filter(Boolean).join(' · ')} — ${what}</b><br>${esc(p.desc)}`;
}
const KEY = `<div class="key"><span><i style="background:var(--run)"></i>Run</span><span><i style="background:var(--pass)"></i>Pass</span>
  <span><i style="background:var(--pen)"></i>Penalty</span><span><i class="dots"></i>Kick</span>
  <span>▸ flag on the play · the drive's result sits at the snap of its last play</span></div>`;
function driveHTML(g, i) {
  const d = g.drives[i], opp = d.team === g.away ? g.home : g.away;
  const top = `<div class="ds-top"><div class="ds-title">Drive Summary</div><div class="ds-team">${stamp(d.team, false)}<span title="Drive ${i + 1} of ${g.drives.length}">#${i + 1} · Q${d.q}</span></div></div>`;
  if (!d.plays.length) return `<section class="ds">${top}<div class="ds-head">${d.s} ${esc(headline(d))}</div><div class="ds-sub">No offensive snaps.</div></section>`;
  const st = driveStats(d), last = d.plays[d.plays.length - 1];
  return `<section class="ds" aria-label="Drive ${i + 1} summary">${top}
    <div class="ds-head">${d.s} ${esc(headline(d))}</div>
    <div class="ds-sub">${spot(d.plays[0].a, d.team, opp)} → ${last.b <= 0 ? opp + ' end zone' : spot(last.b, d.team, opp)} · ${st.firsts} first down${st.firsts === 1 ? '' : 's'}</div>
    <div class="ds-body">
      <div><div class="field">${fieldSVG(d, opp)}</div><div class="cap" id="cap" aria-live="polite">${playCaption(d, opp, -1)}</div></div>
      <dl class="st">
        <div><dt>Plays</dt><dd>${st.plays}</dd></div><div><dt>Yards</dt><dd>${st.yards}</dd></div><div><dt>Time</dt><dd>${st.time}</dd></div>
        <div><dt class="run">Run</dt><dd>${st.run}%</dd></div><div><dt class="pass">Pass</dt><dd>${st.pass}%</dd></div><div><dt class="pen">Penalty</dt><dd>${st.pens}</dd></div>
      </dl></div>${KEY}</section>`;
}
// Strips rebuilt from the drives, one button per drive (segments match derive.strip()).
function driveStrip(g, team) {
  const segs = [[], [], []];
  g.drives.forEach((d, i) => { if (d.team === team) segs[d.h].push(i); });
  const parts = segs.filter((p, k) => k < 2 || p.length);
  const pipe = `<span class="pipe" aria-hidden="true">${esc(S.legend.pipe)}</span>`;
  return `<span class="s">${parts.map(p => p.map(i => `<button class="dv${i === S.game.sel ? ' on' : ''}" data-d="${i}" aria-expanded="${i === S.game.sel}" aria-label="Drive ${i + 1}, ${team}: ${esc(S.legend.label[g.drives[i].s])}">${g.drives[i].s}</button>`).join('')).join(pipe)}</span>`;
}
function drawGame() {
  const {g, sel} = S.game;
  const row = (t, pts, opp) => `<div class="row ${pts > opp ? 'win' : ''}">${stamp(t)}<div class="strip">${driveStrip(g, t)}</div><span class="pts">${pts}</span></div>`;
  $('#gcard').innerHTML = `<div class="ch"><span class="t">${sel < 0 ? 'Tap a drive' : 'Tap it again to close'}</span><button class="tag copy" data-copy aria-label="Copy this game to clipboard">Copy</button></div>
    ${row(g.away, g.aScore, g.hScore)}${row(g.home, g.hScore, g.aScore)}`;
  $('#drive').innerHTML = sel < 0 ? '' : driveHTML(g, sel);
  S.game.p = -1;
  fit($('#gview'));
}
function pickPlay(p) {
  const {g, sel} = S.game, d = g.drives[sel];
  S.game.p = p;
  document.querySelectorAll('#drive g.pl').forEach(x => x.classList.toggle('on', +x.dataset.p === p));
  $('#cap').innerHTML = playCaption(d, d.team === g.away ? g.home : g.away, p);
}
async function viewGame({id}) {
  const g = await getJSON(`${S.season}/games/${id}.json`);
  weekNav(g.week);
  const title = `${name(g.away)} at ${name(g.home)}`;
  document.title = `${title}, Week ${g.week} · Possession Strips`;
  const v = $('#view');
  const sub = g.final ? `${title} · ${gameDate(g)} · Final ${g.aScore}–${g.hScore}` : `${title} · ${started(g) ? 'In progress' : gameDate(g)}`;
  v.innerHTML = `<div class="hero"><h1 class="gh">${g.away} <span>at</span> ${g.home}</h1><div class="acts"><a class="btn" href="week/${g.week}/">← Week ${g.week}</a></div></div>
    <p class="sub">${esc(sub)}</p>
    <div id="gview">${g.final ? '<article class="card" id="gcard" data-fit></article><div id="drive"></div>'
      : `<p class="sub">${started(g) ? 'Drive charts post after the final whistle.' : 'Drive charts post after the game.'}</p>`}</div>`;
  if (!g.final) return;
  S.game = {g, sel: 0, p: -1}; // open on the first drive
  drawGame();
  v.onclick = e => {
    const b = e.target.closest('[data-d]');
    if (b) { S.game.sel = +b.dataset.d === S.game.sel ? -1 : +b.dataset.d; return drawGame(); } // tap the open drive again to close
    const pl = e.target.closest('g.pl');
    if (pl) return pickPlay(+pl.dataset.p);
    if (e.target.closest('[data-copy]')) return copy(g.copy, 'Copied — ' + g.copy.split(':')[0]);
  };
}
// Arrow keys step through the open drive's plays.
document.addEventListener('keydown', e => {
  const G = S.game;
  if (!G || G.sel < 0 || e.altKey || e.metaKey || e.ctrlKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key], n = G.g.drives[G.sel].plays.length;
  if (!step || !n) return;
  e.preventDefault();
  pickPlay(Math.max(0, Math.min(n - 1, G.p + step)));
});

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
  if (a === 'game' && /^\d{4}_\d{2}_[A-Z]+_[A-Z]+$/.test(b || '')) return {view: 'game', id: b};
  if (a === 'team') {
    const t = b && (S.teams.aliases[b.toUpperCase()] || b.toUpperCase());
    return {view: 'team', team: S.teams.teams[t] ? t : null};
  }
  return {view: 'week', week: S.meta.latestWeek, home: true};
}
function pathOf(r) {
  if (r.view === 'week') return r.home ? '' : `week/${r.week}/`;
  if (r.view === 'team') return r.team ? `team/${r.team}/` : 'team/';
  if (r.view === 'game') return `game/${r.id}/`;
  return 'standings/';
}
const VIEWS = {week: viewWeek, standings: viewStandings, team: viewTeam, game: viewGame};
async function render() {
  const r = S.route = parseRoute();
  document.querySelectorAll('.tabs a').forEach(a => {
    const on = a.dataset.tab === (r.view === 'game' ? 'week' : r.view);
    a.classList.toggle('on', on);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  if (r.view !== 'week' && r.view !== 'game') $('#weeks').hidden = true;
  if (r.view !== 'game') S.game = null;
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
