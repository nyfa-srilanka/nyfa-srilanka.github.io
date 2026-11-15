#!/usr/bin/env python3
"""Fetch the public NYFA dashboard JSONP API and create a validated, public snapshot.

Runs only in GitHub Actions. Uses Python standard library; no Google credentials.
Never logs the returned payload, which contains publicly approved programme data.
"""
import datetime as dt
import json
import os
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

CALLBACK = 'nyfaCallback_Snapshot2026'
RESTRICTED_KEY = re.compile(
    r'(?:^|_)(?:email|e_mail|telephone|phone|mobile|contact|contactnumber|'
    r'contactperson|nysccontactperson|personalname|supervisorname)(?:$|_)',
    re.IGNORECASE,
)


def validate_public_data(data):
    if not isinstance(data, dict) or not isinstance(data.get('sessions'), list):
        raise ValueError('Dashboard response has no valid sessions list')
    if not isinstance(data.get('dashboard'), dict):
        raise ValueError('Dashboard response has no dashboard section')
    reliability = data.get('reliability') or {}
    if reliability.get('mode') not in ('live', 'recent'):
        raise ValueError('Refusing to publish unavailable or unverified summary data')

    def walk(value):
        if isinstance(value, dict):
            for key, child in value.items():
                name = re.sub(r'(?<=[a-z0-9])(?=[A-Z])', '_', str(key)).lower()
                if RESTRICTED_KEY.search(name) or any(
                    word in name.replace('_', '')
                    for word in ('phonenumber', 'contactperson', 'emailaddress', 'supervisorname')
                ):
                    raise ValueError('Possible private field detected; snapshot blocked')
                walk(child)
        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(data)
    return data


def get_public_dashboard():
    base = os.environ.get('NYFA_PUBLIC_API_URL', '').strip()
    if not base.startswith('https://script.google.com/macros/s/') or not base.endswith('/exec'):
        raise ValueError('NYFA_PUBLIC_API_URL is missing or invalid')
    params = urllib.parse.urlencode({
        'nyfa_public': 'dashboard',
        'cb': CALLBACK,
        '_': str(int(time.time())),
    })
    url = base + '?' + params
    request = urllib.request.Request(
        url, headers={'User-Agent': 'NYFA-GitHub-Pages-Snapshot/1.0', 'Accept': '*/*'}
    )
    with urllib.request.urlopen(request, timeout=35) as response:
        raw = response.read(12 * 1024 * 1024 + 1)
    if len(raw) > 12 * 1024 * 1024:
        raise ValueError('Response exceeds safe size limit')
    body = raw.decode('utf-8-sig').strip()
    match = re.fullmatch(r'\s*' + CALLBACK + r'\s*\((.*)\)\s*;?\s*', body, re.DOTALL)
    if not match:
        raise ValueError('Unexpected response format (expected public JSONP callback)')
    result = json.loads(match.group(1))
    if result.get('ok') is not True:
        raise ValueError('Public API returned an error')
    return validate_public_data(result.get('data'))


def main():
    output = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'public/dashboard-snapshot.json')
    data = None
    for attempt in range(1, 4):
        try:
            data = get_public_dashboard()
            break
        except Exception as exc:
            print('Attempt %d failed: %s' % (attempt, str(exc)), file=sys.stderr)
            if attempt < 3:
                time.sleep(attempt * 3)
    if data is None:
        raise SystemExit('No valid public snapshot; leaving the last successful Pages deployment untouched.')
    snapshot = {
        'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
        'data': data,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('Public snapshot prepared (%d sessions, %d bytes).' % (
        len(data['sessions']), output.stat().st_size
    ))


if __name__ == '__main__':
    main()
