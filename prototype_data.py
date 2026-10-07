import pandas as pd, json, sys
D=sys.argv[1]
d = pd.read_csv(D+'/pbp.csv.gz', low_memory=False,
    usecols=['game_id','week','home_team','away_team','home_score','away_score','fixed_drive',
             'fixed_drive_result','posteam','qtr','play_type','fumble_lost'])
E = {'Touchdown':'🟩','Field goal':'🟢','Punt':'⬜','Missed field goal':'⭕','Turnover':'🔺',
     'Turnover on downs':'🔻','Opp touchdown':'♦️','Safety':'🟪'}
dd = d.dropna(subset=['posteam','fixed_drive_result'])
rows = []
for (g, fd), x in dd.groupby(['game_id','fixed_drive'], sort=True):
    nk = x[x.play_type != 'kickoff']
    team = nk.posteam.mode()[0] if len(nk) else x.posteam.iloc[0]
    k = x[(x.play_type == 'kickoff') & (x.fumble_lost == 1)]
    if len(k):
        rows.append(dict(game_id=g, fd=fd - 0.5, team=k.posteam.iloc[0], res='Turnover', q0=k.qtr.iloc[0], q1=k.qtr.iloc[0]))
    rows.append(dict(game_id=g, fd=fd, team=team, res=x.fixed_drive_result.iloc[0], q0=x.qtr.iloc[0], q1=x.qtr.iloc[-1]))
dr = pd.DataFrame(rows).sort_values(['game_id','fd'])
dr['s'] = [('⏹️' if r.q1 >= 4 else '⏸️') if r.res == 'End of half' else E[r.res] for r in dr.itertuples()]
def segs(g, t):
    x = dr[(dr.game_id == g) & (dr.team == t)]
    out = [list(x[x.q0 <= 2].s), list(x[(x.q0 > 2) & (x.q0 <= 4)].s)]
    ot = list(x[x.q0 > 4].s)
    if ot: out.append(ot)
    return out
sched = pd.read_csv(D+'/games.csv'); sched = sched[(sched.season==2026)&(sched.game_type=='REG')]
played = set(d.game_id.unique())
ab = lambda t: 'LAR' if t=='LA' else t
weeks = {}
for r in sched.sort_values(['gameday','gametime','game_id']).itertuples():
    g = dict(id=r.game_id, day=r.gameday, time=r.gametime, away=ab(r.away_team), home=ab(r.home_team))
    if r.game_id in played:
        g.update(final=True, aScore=int(r.away_score), hScore=int(r.home_score),
                 aStrip=segs(r.game_id, r.away_team), hStrip=segs(r.game_id, r.home_team))
    else:
        g.update(final=False)
    weeks.setdefault(int(r.week), []).append(g)
print(json.dumps(weeks, ensure_ascii=False, separators=(',',':')))
