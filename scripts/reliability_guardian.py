#!/usr/bin/env python3
"""Public-data validation and monitoring. No credentials, spreadsheet writes or photo archives."""
import argparse
import collections
import datetime as dt
import html.parser
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import urllib.error

BASE = 'https://nyfa-srilanka.github.io/'
CORE = ('index.html', 'bridge.js', 'phase1-ui.js', 'smart-map.js', 'home-map-expand.js',
        'training-calendar.js', 'nyfa-district-gallery.js', 'nyfa-home-photo-banner.js', 'nyfa-district-explorer.js')
METRICS = ('targetYouth','youthTrained','completedSessions','scheduledSessions')

class Report:
    def __init__(self): self.errors=[]; self.warnings=[]; self.checks=[]
    def error(self, message): self.errors.append(message)
    def warn(self, message): self.warnings.append(message)
    def ok(self, message): self.checks.append(message)
    def finish(self):
        for level, messages in [('PASS',self.checks),('WARNING',self.warnings),('FAIL',self.errors)]:
            for m in messages:
                print(f'{level}: {m}')
                if os.getenv('GITHUB_ACTIONS') and level in ('WARNING','FAIL'):
                    print(('::warning::' if level=='WARNING' else '::error::')+m.replace('%','%25').replace('\n','%0A').replace('\r','%0D'))
        summary = os.getenv('GITHUB_STEP_SUMMARY')
        if summary:
            with open(summary,'a',encoding='utf-8') as f:
                f.write('\n### NYFA Reliability Guardian\n')
                for level, messages in [('Passed',self.checks),('Review',self.warnings),('Failed',self.errors)]:
                    if messages: f.write('\n**'+level+'**\n'+''.join('- '+m+'\n' for m in messages))
        return 1 if self.errors else 0

def read_http(path, limit=16*1024*1024):
    url=urllib.parse.urljoin(BASE,path)
    for attempt in range(3):
        try:
            request=urllib.request.Request(url,headers={'User-Agent':'NYFA-Reliability-Guardian/1.0','Cache-Control':'no-cache','Accept':'*/*'})
            with urllib.request.urlopen(request,timeout=15) as resp:
                if urllib.parse.urlsplit(resp.geturl()).netloc != urllib.parse.urlsplit(BASE).netloc: raise ValueError('unexpected redirect')
                raw=resp.read(limit+1)
                if len(raw)>limit: raise ValueError('size limit')
                return raw
        except Exception:
            if attempt==2: raise
            time.sleep(2*(attempt+1))

def utc_stamp(s, sri_lanka=False):
    if not isinstance(s,str): raise ValueError('missing timestamp')
    t=dt.datetime.fromisoformat(s.replace('Z','+00:00'))
    if t.tzinfo is None:
        if not sri_lanka: raise ValueError('timestamp has no timezone')
        t=t.replace(tzinfo=dt.timezone(dt.timedelta(hours=5,minutes=30)))
    return t.astimezone(dt.timezone.utc)

def number(x): return type(x) in (int,float) and math.isfinite(x)
def metric(obj,k):
    v=obj.get(k); return v.get('value') if isinstance(v,dict) else None

def check_dashboard(s,r,monitor=False):
    if not isinstance(s,dict) or not isinstance(s.get('data'),dict): r.error('Invalid dashboard snapshot structure'); return None
    d=s['data']; sessions=d.get('sessions'); dash=d.get('dashboard'); rel=d.get('reliability')
    if not isinstance(sessions,list) or not isinstance(dash,dict) or not isinstance(rel,dict) or rel.get('mode') not in ('live','recent'):
        r.error('Dashboard payload is missing verified sessions, totals or reliability status'); return None
    if dash.get('available') is not True: r.error('Verified national dashboard totals are unavailable')
    try:
        pub=utc_stamp(s.get('generatedAt')); fetched=utc_stamp(d.get('fetchedAt'),True)
        age=(dt.datetime.now(dt.timezone.utc)-min(pub,fetched)).total_seconds()/3600
        if max(pub,fetched)>dt.datetime.now(dt.timezone.utc)+dt.timedelta(minutes=5): r.error('A dashboard timestamp is in the future')
        elif age>6:
            (r.error if monitor else r.warn)(f'Dashboard data is more than six hours old ({age:.1f} h)')
        elif age>2: r.warn(f'Dashboard synchronisation delayed ({age:.1f} h; review above 2 h)')
        else: r.ok(f'Dashboard source and publication timestamps within two hours ({max(age,0):.1f} h)')
    except (ValueError,TypeError,OverflowError): r.error('Dashboard timestamp invalid or missing')
    m=dash.get('metrics'); districts=dash.get('districts')
    if not isinstance(m,dict) or not isinstance(districts,list): r.error('Missing metric or district structures'); return None
    totals={k:metric(m,k) for k in METRICS}
    for k,v in totals.items():
        if not number(v) or v<0 or int(v)!=v: r.error(f'Invalid national count: {k}')
    if number(totals['targetYouth']) and totals['targetYouth']==0: r.warn('National youth target is zero; verify reporting source')
    if any(not isinstance(x,dict) for x in sessions+districts): r.error('Malformed session or district row'); return totals
    ids=collections.Counter(str(x.get('id') or '').strip().casefold() for x in sessions)
    duplicate=sum(1 for k,n in ids.items() if k and n>1)
    if duplicate: r.warn(f'{duplicate} duplicate non-empty session IDs; review Master Schedule')
    if ids.get(''): r.warn(f'{ids[""]} session rows without an ID')
    invalid=0
    for x in sessions:
        lat,lng=x.get('lat'),x.get('lng')
        if lat in (None,'') and lng in (None,''): continue
        if not (number(lat) and number(lng) and 5.7<=lat<=10.1 and 79.4<=lng<=82.2): invalid+=1
    if invalid: r.warn(f'{invalid} session coordinate pairs outside validated Sri Lanka bounds or malformed; existing map filters exclude these')
    areas=collections.Counter(str(x.get('name') or '').strip().casefold() for x in districts)
    if any(n>1 for k,n in areas.items() if k): r.warn('Repeated reporting-area names; review district breakdown')
    for k in ('youthTrained','completedSessions'):
        values=[metric(x,k) for x in districts]
        if values and all(number(v) and v>=0 for v in values) and number(totals[k]) and sum(values)!=totals[k]: r.warn(f'District sum differs from national {k}; review reporting definitions and corrections')
    if not sessions and number(totals['completedSessions']) and totals['completedSessions']>0: r.warn('Completed sessions reported but session list empty')
    r.ok(f'Dashboard payload parsed: {len(sessions)} sessions, {len(districts)} reporting areas')
    return totals

def compare_previous(current,r):
    if current is None: return
    try:
        prior=json.loads(read_http('dashboard-snapshot.json'))['data']['dashboard']['metrics']
    except Exception: r.warn('Previous public snapshot unavailable for comparison; structural checks still ran'); return
    if not isinstance(prior,dict): r.warn('Previous national totals unavailable for comparison'); return
    for k in ('youthTrained','completedSessions'):
        old=metric(prior,k); new=current[k]
        if number(old) and number(new) and old>0 and new<old:
            r.warn(f'{k} decreased versus previous publication ({old:g} to {new:g}); verify legitimate reporting correction')
    r.ok('Previous publication comparison completed (decreases are review flags, not automatic blocks)')

class Scripts(html.parser.HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=False); self.items=[]; self.active=None
    def handle_starttag(self,tag,attrs):
        if tag=='script':
            a=dict(attrs); self.active=[a,[]]
    def handle_data(self,data):
        if self.active is not None: self.active[1].append(data)
    def handle_endtag(self,tag):
        if tag=='script' and self.active is not None: self.items.append(self.active); self.active=None

def syntax_check(source,label,r):
    with tempfile.TemporaryDirectory() as tmp:
        p=Path(tmp)/'script.js'; p.write_text(source,encoding='utf-8')
        proc=subprocess.run(['node','--check',str(p)],capture_output=True,text=True,timeout=20)
        if proc.returncode: r.error('JavaScript syntax check failed: '+label)

def check_code(root,r):
    for name in CORE:
        if not (root/name).is_file(): r.error('Required file missing: '+name)
    if r.errors: return
    markup=(root/'index.html').read_text(encoding='utf-8'); parser=Scripts(); parser.feed(markup)
    for i,(attrs,parts) in enumerate(parser.items):
        if attrs.get('type','').lower() not in ('','text/javascript','application/javascript'): continue
        src=attrs.get('src')
        if src:
            parsed=urllib.parse.urlsplit(src)
            if not parsed.scheme and not parsed.netloc:
                name=parsed.path.removeprefix('./').lstrip('/')
                if not name or not (root/name).is_file(): r.error('Missing local script referenced by index.html')
        else: syntax_check(''.join(parts),f'inline script {i+1}',r)
    for name in CORE:
        if name.endswith('.js'): syntax_check((root/name).read_text(encoding='utf-8'),name,r)
    # Do not prohibit Google Maps links or public map tiles; only browser-side Apps Script endpoints.
    for name in CORE:
        if re.search(r'https?://script\.google(?:usercontent)?\.com/(?:macros|macros/echo)',(root/name).read_text(encoding='utf-8'),re.I): r.error('Direct Google Apps Script endpoint found in browser source: '+name)
    if not r.errors: r.ok('Required files, local script references, JavaScript syntax and Google API isolation checked')

PHOTO=re.compile(r'\./photo-assets/([a-f0-9]{24})-([a-f0-9]{16})-(full|thumb)\.jpg\Z')
def check_gallery(g,r,read,monitor=False,actual=None):
    if not isinstance(g,dict) or type(g.get('available')) is not bool or not isinstance(g.get('photos'),list): r.error('Malformed photo manifest'); return
    if not g['available']:
        if g['photos'] or actual: r.error('Unavailable gallery must not publish unconfirmed images')
        else: (r.error if monitor else r.warn)('Photo sync unavailable; dashboard remains independent; no old unconfirmed images reused')
        return
    try:
        stamp=utc_stamp(g.get('generatedAt')); age=(dt.datetime.now(dt.timezone.utc)-stamp).total_seconds()/3600
        if age < -0.084: r.error('Gallery publication timestamp is in the future')
        elif age>6: (r.error if monitor else r.warn)('Gallery approval snapshot older than six hours')
        elif age>2: r.warn('Gallery publication delayed more than two hours')
    except (ValueError,TypeError,OverflowError): r.error('Gallery publication timestamp invalid')
    if type(g.get('missing')) is not int or g['missing']<0: r.error('Invalid gallery missing-count field')
    elif g['missing']: r.warn(f'{g["missing"]} approved photos were skipped; review publisher logs')
    seen=set(); used=set(); bad=0
    for p in g['photos']:
        if not isinstance(p,dict) or not isinstance(p.get('district'),str) or not p['district'].strip(): r.error('Malformed gallery entry'); continue
        pid=p.get('id')
        if not isinstance(pid,str) or not re.fullmatch(r'[a-f0-9]{24}',pid) or pid in seen: r.error('Invalid or duplicate public photo ID'); continue
        seen.add(pid); versions=set()
        for size in ('full','thumb'):
            path=p.get(size); match=PHOTO.fullmatch(path) if isinstance(path,str) else None
            if not match or match[1]!=pid or match[3]!=size: r.error('Unsafe or invalid photo reference'); continue
            versions.add(match[2]); used.add(path[2:])
            try:
                raw=read(path[2:]);
                if not (raw.startswith(b'\xff\xd8') and raw.endswith(b'\xff\xd9')): raise ValueError('invalid JPEG')
            except Exception: bad+=1
        if len(versions)!=1:r.error('Photo full-size and thumbnail versions do not match')
    if bad:r.error(f'{bad} published image files missing or invalid')
    if actual is not None and actual!=used:r.error('Photo assets differ from current approved manifest (missing or unreferenced files)')
    r.ok(f'Gallery manifest checked: {len(seen)} photos, {len(used)} image references')

def build(root,r):
    check_code(root,r)
    try:
        s=json.loads((root/'dashboard-snapshot.json').read_text()); totals=check_dashboard(s,r); compare_previous(totals,r)
    except Exception: r.error('Could not parse local dashboard snapshot')
    try:
        g=json.loads((root/'gallery-snapshot.json').read_text()); actual={p.relative_to(root).as_posix() for p in (root/'photo-assets').rglob('*') if p.is_file()}; check_gallery(g,r,lambda path:(root/path).read_bytes(),actual=actual)
    except Exception: r.error('Could not validate local photo manifest')

def monitor(r):
    try:
        html=read_http('index.html').decode('utf-8');
        if 'National Youth First Aid Programme' not in html or 'kYouthTrained' not in html: raise ValueError('unexpected homepage')
        for name in CORE[1:]:
            if not read_http(name): raise ValueError('empty script')
        r.ok('Public homepage and all core website scripts accessible without login')
    except Exception:r.error('Public homepage or a required website script could not be retrieved')
    try:check_dashboard(json.loads(read_http('dashboard-snapshot.json')),r,monitor=True)
    except Exception:r.error('Public dashboard snapshot inaccessible or invalid')
    # Check every remote image's headers and sample actual bytes to limit bandwidth.
    # Every image's JPEG markers are checked locally before deployment.
    try:
        from concurrent.futures import ThreadPoolExecutor
        g=json.loads(read_http('gallery-snapshot.json')); paths=set()
        if isinstance(g,dict) and isinstance(g.get('photos'),list):
            for p in g['photos']:
                if isinstance(p,dict):
                    for k in ('full','thumb'):
                        if isinstance(p.get(k),str) and PHOTO.fullmatch(p[k]):paths.add(p[k][2:])
        sample=set(sorted(paths)[:8])
        def test(path):
            try:
                if path in sample:
                    raw=read_http(path,limit=5*1024*1024)
                    return path, raw.startswith(b'\xff\xd8') and raw.endswith(b'\xff\xd9')
                for attempt in range(2):
                    try:
                        req=urllib.request.Request(urllib.parse.urljoin(BASE,path),method='HEAD',headers={'User-Agent':'NYFA-Reliability-Guardian/1.0','Cache-Control':'no-cache'})
                        with urllib.request.urlopen(req,timeout=12) as resp:
                            valid=(resp.status==200 and urllib.parse.urlsplit(resp.geturl()).netloc==urllib.parse.urlsplit(BASE).netloc and resp.headers.get_content_type()=='image/jpeg')
                            if valid: return path,True
                    except Exception:
                        if attempt==1: raise
                    time.sleep(1)
                return path,False
            except Exception:return path,False
        with ThreadPoolExecutor(max_workers=8) as pool:results=dict(pool.map(test,paths))
        check_gallery(g,r,lambda path:b'\xff\xd8\xff\xd9' if results.get(path) else b'',monitor=True)
        r.ok(f'Remote image availability checked ({len(paths)} URLs; {len(sample)} JPEG byte samples)')
    except Exception:r.error('Public gallery snapshot inaccessible or invalid')

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('mode',choices=['build','monitor']); parser.add_argument('root',nargs='?',default='public'); a=parser.parse_args(); r=Report()
    if a.mode=='build': build(Path(a.root),r)
    else: monitor(r)
    return r.finish()
if __name__=='__main__':sys.exit(main())
