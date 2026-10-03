# -*- coding: utf-8 -*-
"""Produce a folder (dist/site/) ready to upload to any static host.
Same compression as the single-file build, but assets stay separate so the
browser loads them on demand and the first screen arrives sooner.
Usage: python3 tools/build-site.py
"""
import os, re, io, shutil, subprocess, glob, zipfile
from PIL import Image
import imageio_ffmpeg

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(R, 'dist/site')
exe = imageio_ffmpeg.get_ffmpeg_exe()
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT)

for f in ('index.html', 'styles.css', 'main.js', 'content.js'):
    shutil.copy(os.path.join(R, f), OUT)

# subset each font down to the characters the page actually uses
txt = os.path.join(OUT, '_chars.txt')
src = open(os.path.join(R,'content.js'),encoding='utf-8').read() + \
      open(os.path.join(R,'index.html'),encoding='utf-8').read() + \
      open(os.path.join(R,'main.js'),encoding='utf-8').read()
chars = set(re.findall(r'[一-鿿　-〿＀-￯]', src))
chars |= set(chr(c) for c in range(0x20, 0x7f)) | set('　·—–…“”‘’《》〈〉【】、。，！？；：（）～♡✦♪▶❚←→↑↓°%')
open(txt,'w',encoding='utf-8').write(''.join(sorted(chars)))
os.makedirs(os.path.join(OUT,'fonts'))
for f in sorted(glob.glob(os.path.join(R,'fonts/*.woff2'))):
    name = os.path.basename(f)
    # ko-*.woff2 is already a three-glyph subset, and the char set above is all
    # CJK, so subsetting it would strip every Hangul glyph and leave an empty
    # font. Copy it through untouched.
    if name.startswith('ko-'):
        shutil.copy(f, os.path.join(OUT,'fonts',name)); continue
    subprocess.run(['pyftsubset', f, '--output-file='+os.path.join(OUT,'fonts',name),
        '--flavor=woff2', '--text-file='+txt, '--no-hinting', '--desubroutinize'], check=True)
os.remove(txt)

# photos / video / audio: compress, then write back to the same relative path
def conv(rel):
    s = os.path.join(R, rel); d = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(d), exist_ok=True)
    ext = os.path.splitext(rel)[1].lower()
    if ext in ('.jpg','.jpeg','.png','.webp'):
        im = Image.open(s).convert('RGB'); im.thumbnail((1000,1000), Image.LANCZOS)
        im.save(d, 'JPEG', quality=75, optimize=True, progressive=True)
    elif ext == '.mp4':
        subprocess.run([exe,'-y','-hide_banner','-loglevel','error','-i',s,'-vf','scale=-2:960',
            '-c:v','libx264','-crf','30','-preset','slow','-pix_fmt','yuv420p',
            '-c:a','aac','-b:a','80k','-movflags','+faststart',d], check=False)
    elif ext in ('.mp3','.m4a'):
        subprocess.run([exe,'-y','-hide_banner','-loglevel','error','-i',s,'-b:a','112k',d], check=False)
    else:
        shutil.copy(s, d)

refs = sorted(set(re.findall(r"'((?:photos|audio)/[^']+|[\w.-]+\.(?:mp3|m4a|mp4))'",
                             open(os.path.join(R,'content.js'),encoding='utf-8').read())))
n = 0
for rel in refs:
    if os.path.exists(os.path.join(R, rel)): conv(rel); n += 1
print('  %d assets' % n)

total = sum(os.path.getsize(os.path.join(dp,f)) for dp,_,fs in os.walk(OUT) for f in fs)
print('  dist/site/  %.1f MB' % (total/1048576))

zp = os.path.join(R, 'dist/site-upload-this.zip')
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for dp, _, fs in os.walk(OUT):
        for f in fs:
            p = os.path.join(dp, f)
            z.write(p, os.path.relpath(p, OUT))
print('  %s  %.1f MB' % (os.path.basename(zp), os.path.getsize(zp)/1048576))
