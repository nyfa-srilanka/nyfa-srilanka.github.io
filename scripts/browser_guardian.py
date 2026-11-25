#!/usr/bin/env python3
"""Fresh, anonymous Chromium/Firefox/WebKit smoke tests. Google Apps Script is blocked."""
import argparse
import functools
import http.server
import json
import os
from pathlib import Path
import threading
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass


def smoke(browser, name, base, mobile=False, unavailable=False):
    context=browser.new_context(viewport={'width':390,'height':844} if mobile else {'width':1365,'height':850},
        locale='en-GB',timezone_id='Asia/Colombo', reduced_motion='reduce')
    page=context.new_page(); forbidden=[]; errors=[]
    def route(request_route):
        host=urlsplit(request_route.request.url).hostname or ''
        if host in ('script.google.com','script.googleusercontent.com'):
            forbidden.append(host); request_route.abort()
        else: request_route.continue_()
    context.route('**/*',route)
    page.on('pageerror',lambda error: errors.append(type(error).__name__))
    try:
        page.goto(base,wait_until='domcontentloaded',timeout=45000)
        page.wait_for_function("document.querySelector('#dashboardSource')?.textContent.includes('PUBLISHED PROGRAMME DATA')",timeout=25000)
        # Compare with published display strings; never accept demo, blank or phantom counts.
        expected=page.evaluate("""async () => { const r=await fetch('./dashboard-snapshot.json',{cache:'no-store'}); return (await r.json()).data.dashboard.metrics; }""")
        for element,metric in [('kTargetYouth','targetYouth'),('kYouthTrained','youthTrained'),('kCompleted','completedSessions'),('kScheduled','scheduledSessions')]:
            value=expected[metric]['display']
            if str(value).strip() in ('','—','None'): raise AssertionError('Published KPI display missing')
            page.wait_for_function("([id,v])=>document.getElementById(id)?.textContent.trim()===String(v).trim()",arg=[element,value],timeout=15000)
        if not mobile:
            with page.expect_response(lambda r: 'dashboard-snapshot.json' in r.url and r.status==200,timeout=20000):
                page.locator('#refreshBtn').click(timeout=15000)
            page.wait_for_function("!document.getElementById('refreshBtn').disabled",timeout=20000)
        for tab in (['sessions','locations','districts','overview'] if mobile else ['sessions','locations','districts','calendar','resources','overview']):
            selector=('.mobile-tab' if mobile else '.navbtn')+'[data-section="'+tab+'"]'
            page.locator(selector).first.click(timeout=15000)
            page.wait_for_function("id=>document.getElementById('sec-'+id)?.classList.contains('active')",arg=tab,timeout=10000)
        if not mobile and not unavailable:
            gallery=page.evaluate("""async () => {const r=await fetch('./gallery-snapshot.json',{cache:'no-store'}); return await r.json()}""")
            if gallery.get('available') is not True: raise AssertionError('Gallery unavailable')
            if gallery.get('photos'):
                page.wait_for_function("document.querySelector('#nyfa-photo-banner .npb-photo.active')?.naturalWidth>0",timeout=25000)
                page.locator('.navbtn[data-section="gallery"]').first.click(timeout=15000)
                page.locator('#na-grid .na-card').first.click(timeout=20000)
                page.locator('#na-grid .na-card').first.click(timeout=20000)
                page.wait_for_function("document.querySelector('#na-large')?.naturalWidth>0",timeout=20000)
                page.locator('#na-close').click(timeout=10000)
        if forbidden: raise AssertionError('Browser attempted direct Google Apps Script access')
        if errors: raise AssertionError(f'{len(errors)} unhandled JavaScript errors')
        print(f'PASS: {name} {"mobile viewport" if mobile else "desktop"}; anonymous dashboard and navigation; direct Apps Script blocked')
    finally: context.close()


def main():
    p=argparse.ArgumentParser(); p.add_argument('--root',default='public'); p.add_argument('--url'); p.add_argument('--chromium-path'); a=p.parse_args()
    server=None; unavailable=False
    if a.url:
        base=a.url
    else:
        root=Path(a.root).resolve()
        gallery=json.loads((root/'gallery-snapshot.json').read_text())
        unavailable=gallery.get('available') is not True
        handler=functools.partial(QuietServer,directory=str(root))
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        base=f'http://127.0.0.1:{server.server_port}/'
    failed=[]
    try:
        with sync_playwright() as pw:
            names=['chromium'] if a.chromium_path else ['chromium','firefox','webkit']
            for name in names:
                browser=None
                try:
                    kw={'executable_path':a.chromium_path,'args':['--no-sandbox']} if a.chromium_path else {}
                    browser=getattr(pw,name).launch(**kw)
                    smoke(browser,name,base,unavailable=unavailable)
                    if name in ('chromium','webkit'):smoke(browser,name,base,mobile=True,unavailable=unavailable)
                except Exception as e:
                    # Playwright logs may include URLs and page content. Report only a bounded diagnostic.
                    msg=str(e).splitlines()[0][:200]
                    print(f'FAIL: {name}: {type(e).__name__}: {msg}')
                    failed.append(name)
                finally:
                    if browser: browser.close()
    finally:
        if server:server.shutdown()
    if unavailable: print('WARNING: Photo browser checks skipped; publisher explicitly marked gallery unavailable (dashboard tests still ran).')
    if failed: raise SystemExit(1)
if __name__=='__main__':main()
