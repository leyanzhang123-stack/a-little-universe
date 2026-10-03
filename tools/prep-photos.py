# -*- coding: utf-8 -*-
"""Tidy up a folder of photos: order by capture time, convert to JPEG, resize
to something sensible, and strip EXIF (GPS included).
Usage: python3 tools/prep-photos.py photos/meals [long-edge pixels]
"""
import sys, os, glob
from PIL import Image, ImageOps, ExifTags
import pillow_heif
pillow_heif.register_heif_opener()

d = sys.argv[1].rstrip('/')
LONG = int(sys.argv[2]) if len(sys.argv) > 2 else 1200

EXTS = ('*.HEIC','*.heic','*.HEIF','*.heif','*.jpg','*.JPG','*.jpeg','*.JPEG','*.png','*.PNG','*.webp')
files = [f for pat in EXTS for f in glob.glob(os.path.join(d, pat))]
files = [f for f in files if not os.path.basename(f)[:2].isdigit()]   # already processed, leave alone

def shot_at(f):
    try:
        ex = Image.open(f).getexif() or {}
        tag = {ExifTags.TAGS.get(k, k): v for k, v in ex.items()}
        dt = tag.get('DateTimeOriginal') or tag.get('DateTime')
        if not dt:
            sub = ex.get_ifd(0x8769)
            dt = {ExifTags.TAGS.get(k, k): v for k, v in sub.items()}.get('DateTimeOriginal')
        return str(dt) if dt else 'zzzz'
    except Exception:
        return 'zzzz'

files.sort(key=lambda f: (shot_at(f), os.path.basename(f)))
print(f"{d}  {len(files)} images, long edge {LONG}px\n")
total = 0
for i, f in enumerate(files, 1):
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    im.thumbnail((LONG, LONG), Image.LANCZOS)
    out = os.path.join(d, f"{i:02d}.jpg")
    clean = Image.new('RGB', im.size)      # fresh image: no EXIF, no GPS carried over
    clean.paste(im)
    clean.save(out, 'JPEG', quality=80, optimize=True, progressive=True)
    kb = os.path.getsize(out) // 1024
    total += kb
    print(f"  {i:02d}.jpg  ←  {os.path.basename(f):<20} {shot_at(f)[:16]:<18} {kb}KB")
print(f"\ntotal {total/1024:.1f}MB")
