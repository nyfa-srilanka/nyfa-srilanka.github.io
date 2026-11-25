#!/usr/bin/env python3
"""Publish only images returned by the existing public, approval-scoped gallery API.
No Drive credentials, source filenames, original Drive IDs or EXIF metadata are published.
Build outside public/ until complete; never reuse photos from previous deployments.
"""
import base64
import concurrent.futures
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import urllib.parse
import urllib.request
from PIL import Image, ImageOps

CALLBACK = 'nyfaCallback_GalleryPublish2026'
MAX_BYTES = 20 * 1024 * 1024
MAX_PHOTOS = 400
Image.MAX_IMAGE_PIXELS = 40_000_000
DISTRICTS = ('Ampara Anuradhapura Badulla Batticaloa Colombo Galle Gampaha Hambantota Jaffna '
             'Kalutara Kalmunai Kandy Kegalle Kilinochchi Kurunegala Mannar Matale Matara '
             'Monaragala Mullaitivu Polonnaruwa Puttalam Ratnapura Trincomalee Vavuniya '
             'NIHS CMC').split() + ['Nuwara Eliya']
DISTRICT_MAP = {re.sub(r'[^a-z]', '', d.lower()): d for d in DISTRICTS}
DISTRICT_MAP.update({'rathnapura':'Ratnapura','mulativ':'Mullaitivu','mullativu':'Mullaitivu',
                     'vavunia':'Vavuniya','moneragala':'Monaragala','nuwaraeliya':'Nuwara Eliya'})


def allowed(url):
    p = urllib.parse.urlsplit(url)
    host = p.hostname or ''
    return (p.scheme == 'https' and not p.username and not p.password and
            p.port in (None, 443) and (host in ('script.google.com', 'drive.google.com',
            'drive.usercontent.google.com') or host.endswith('.googleusercontent.com')))


class GoogleRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not allowed(newurl):
            raise ValueError('Non-approved redirect')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def retrieve(url):
    if not allowed(url):
        raise ValueError('Non-approved URL')
    req = urllib.request.Request(url, headers={'User-Agent':'NYFA-Public-Gallery/1.0','Accept':'*/*'})
    with urllib.request.build_opener(GoogleRedirect()).open(req, timeout=12) as response:
        if not allowed(response.geturl()):
            raise ValueError('Non-approved destination')
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError('Response too large')
    return body


def api(resource, photo_id=None):
    base = os.environ.get('NYFA_PUBLIC_API_URL', '').strip()
    if not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec', base):
        raise ValueError('Invalid public API URL')
    params = {'nyfa_public':resource, 'cb':CALLBACK, 'fresh':'1'}
    if photo_id is not None:
        params['id'] = photo_id
    body = retrieve(base + '?' + urllib.parse.urlencode(params)).decode('utf-8-sig').strip()
    match = re.fullmatch(re.escape(CALLBACK) + r'\s*\((.*)\)\s*;?\s*', body, re.DOTALL)
    if not match:
        raise ValueError('Unexpected gallery API response')
    result = json.loads(match.group(1))
    if not isinstance(result, dict) or result.get('ok') is not True:
        raise ValueError('Gallery API did not return success')
    return result.get('data')


def bytes_from_source(source):
    if not isinstance(source, str) or not source:
        raise ValueError('Missing image source')
    if source.startswith('data:'):
        match = re.fullmatch(r'data:image/(?:jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)', source, re.I)
        if not match or len(match.group(1)) > (MAX_BYTES * 4 // 3 + 100):
            raise ValueError('Invalid image data')
        return base64.b64decode(re.sub(r'\s+', '', match.group(1)), validate=True)
    return retrieve(source)


def decode_photo(source):
    raw = bytes_from_source(source)
    with Image.open(io.BytesIO(raw)) as im:
        if im.width * im.height > 40_000_000 or im.format not in ('JPEG','PNG','WEBP','GIF'):
            raise ValueError('Unsupported or oversized image')
        im = ImageOps.exif_transpose(im)
        im.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        if 'A' in im.getbands() or 'transparency' in im.info:
            rgba = im.convert('RGBA')
            rgb = Image.new('RGB', rgba.size, 'white')
            rgb.paste(rgba, mask=rgba.getchannel('A'))
        else:
            rgb = im.convert('RGB')
        # A new pixel-only image prevents source metadata from being copied.
        out = Image.new('RGB', rgb.size)
        out.paste(rgb)
        return out


def save_jpeg(im, limit, quality):
    copy = im.copy()
    copy.thumbnail((limit, limit), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    copy.save(buf, 'JPEG', quality=quality, optimize=True, progressive=True)
    return buf.getvalue()


def prepare_photo(item, district, stage):
    # Only a photo whose ID was in the freshly returned approved list can enter here.
    photo_id = item['id']
    im = None
    for source in dict.fromkeys(s for s in (item.get('full'), item.get('thumb')) if isinstance(s, str) and s):
        try:
            im = decode_photo(source)
            break
        except Exception:
            pass
    if im is None:
        try:
            im = decode_photo(api('thumbnail', photo_id))
        except Exception:
            return None
    full = save_jpeg(im, 1600, 84)
    thumb = save_jpeg(im, 480, 78)
    public_id = hashlib.sha256(photo_id.encode()).hexdigest()[:24]
    version = hashlib.sha256(full).hexdigest()[:16]
    prefix = public_id + '-' + version
    full_name, thumb_name = prefix + '-full.jpg', prefix + '-thumb.jpg'
    (stage / full_name).write_bytes(full)
    (stage / thumb_name).write_bytes(thumb)
    return {'id': public_id, 'district': district, 'full':'./photo-assets/'+full_name,
            'thumb':'./photo-assets/'+thumb_name}


def manifest(available, photos, missing=0):
    return {'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
            'available':available,'photos':photos,'missing':missing}


def build(public):
    public.mkdir(parents=True, exist_ok=True)
    # The GitHub build uses a clean public directory. Explicitly remove any old outputs.
    shutil.rmtree(public / 'photo-assets', ignore_errors=True)
    (public / 'gallery-snapshot.json').unlink(missing_ok=True)
    try:
        data = api('gallery')
        if not isinstance(data, dict) or not isinstance(data.get('photos'), list):
            raise ValueError('No approved photo list returned')
        items = data['photos']
        if len(items) > MAX_PHOTOS:
            raise ValueError('Gallery exceeds configured safe batch size')
        jobs, seen, missing = [], set(), 0
        for item in items:
            if not isinstance(item, dict):
                missing += 1
                continue
            ident = item.get('id')
            district = DISTRICT_MAP.get(re.sub(r'[^a-z]', '', str(item.get('district','')).lower()))
            if not isinstance(ident, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,200}', ident) or not district:
                missing += 1
                continue
            if ident in seen:
                continue
            seen.add(ident)
            jobs.append((item,district))
        with tempfile.TemporaryDirectory(prefix='nyfa-photo-stage-', dir=public.parent) as work:
            stage = Path(work) / 'photo-assets'
            stage.mkdir()
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                def task(job):
                    try:
                        return prepare_photo(job[0], job[1], stage)
                    except Exception:
                        return None
                results = list(pool.map(task, jobs))
            photos = [p for p in results if p is not None]
            missing += len(results) - len(photos)
            # Keep only the files that belong to the current approved manifest.
            used = {Path(p[k]).name for p in photos for k in ('full','thumb')}
            for file in stage.iterdir():
                if file.name not in used:
                    file.unlink()
            shutil.move(str(stage), str(public / 'photo-assets'))
        result = manifest(bool(photos) or not items, photos, missing)
    except Exception as error:
        shutil.rmtree(public / 'photo-assets', ignore_errors=True)
        # Do not log URLs, response payloads or filenames. Never republish unconfirmed old photos.
        print('Gallery sync unavailable: '+type(error).__name__, file=sys.stderr)
        result = manifest(False, [])
    (public / 'gallery-snapshot.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('Gallery available=%s; published=%d; skipped=%d' % (result['available'],len(result['photos']),result['missing']))
    return result


if __name__ == '__main__':
    build(Path(sys.argv[1] if len(sys.argv)>1 else 'public'))
