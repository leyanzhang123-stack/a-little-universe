# -*- coding: utf-8 -*-
"""Bundle the whole site into a single HTML file. Fonts, photos, audio and
video are all inlined, so it opens with no network at all.
Fonts are re-subset to the characters actually used; photos and video are
re-compressed at delivery quality.
Usage: python3 tools/build-standalone.py
"""
import re, os, io, base64, subprocess, tempfile, glob
from PIL import Image
import imageio_ffmpeg
from fontTools import subset as ftsubset

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda f: open(os.path.join(R, f), encoding='utf-8').read()
exe = imageio_ffmpeg.get_ffmpeg_exe()
tmp = tempfile.mkdtemp()

content_js, index_html, main_js, css = read('content.js'), read('index.html'), read('main.js'), read('styles.css')

# ---- fonts: keep only the characters the page really uses ----
chars = set(''.join(re.findall(r'[一-鿿　-〿＀-￯]', content_js + index_html + main_js)))
chars |= set(chr(c) for c in range(0x20, 0x7f))
chars |= set('　·—–…“”‘’《》〈〉【】、。，！？；：（）～♡✦♪▶❚←→↑↓°%')
for f in sorted(glob.glob(os.path.join(R, 'fonts/*.woff2'))):
    name = os.path.basename(f)
    out = os.path.join(tmp, name)
    # ko-*.woff2 is already a three-glyph subset and the char set above is all
    # CJK, so subsetting it would strip every Hangul glyph and leave an empty
    # font. Read the original straight through.
    if name.startswith('ko-'):
        out = f
    else:
        txt = os.path.join(tmp, 'chars.txt'); open(txt, 'w', encoding='utf-8').write(''.join(sorted(chars)))
        subprocess.run(['pyftsubset', f, '--output-file=' + out, '--flavor=woff2',
                        '--text-file=' + txt, '--no-hinting', '--desubroutinize'], check=True)
    rel = 'fonts/' + name
    data = open(out, 'rb').read()
    css = css.replace('url("%s")' % rel, 'url("data:font/woff2;base64,%s")' % base64.b64encode(data).decode())
    print('  %-22s %5.0fKB → %4.0fKB' % (os.path.basename(f), os.path.getsize(f)/1024, len(data)/1024))

# ---- photos / video / audio ----
MIME = {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'}
def asset(f):
    p = os.path.join(R, f)
    if not os.path.exists(p): return None
    ext = os.path.splitext(f)[1].lower()
    if ext in MIME:
        im = Image.open(p).convert('RGB'); im.thumbnail((1000, 1000), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, 'JPEG', quality=75, optimize=True, progressive=True)
        return 'image/jpeg', buf.getvalue()
    if ext == '.mp4':
        o = os.path.join(tmp, 'v%d.mp4' % abs(hash(f)))
        subprocess.run([exe,'-y','-hide_banner','-loglevel','error','-i',p,'-vf','scale=-2:960',
            '-c:v','libx264','-crf','30','-preset','slow','-pix_fmt','yuv420p',
            '-c:a','aac','-b:a','80k','-movflags','+faststart',o], check=False)
        return 'video/mp4', open(o,'rb').read()
    if ext in ('.mp3','.m4a'):
        o = os.path.join(tmp, 'a.m4a')
        subprocess.run([exe,'-y','-hide_banner','-loglevel','error','-i',p,
            '-b:a','112k','-c:a','aac',o], check=False)
        return 'audio/mp4', open(o,'rb').read()
    return None

saved = [0, 0]
def repl(m):
    f = m.group(1); got = asset(f)
    if not got: return m.group(0)
    mime, data = got
    saved[0] += os.path.getsize(os.path.join(R, f)); saved[1] += len(data)
    return "'data:%s;base64,%s'" % (mime, base64.b64encode(data).decode())
content_js = re.sub(r"'((?:photos|audio)/[^']+|[\w.-]+\.(?:mp3|m4a|mp4))'", repl, content_js)
print('  assets  %.1fMB -> %.1fMB' % (saved[0]/1048576, saved[1]/1048576))

out = (index_html
       .replace('<link rel="stylesheet" href="styles.css">', '<style>\n%s\n</style>' % css)
       .replace('<script src="content.js"></script>', '<script>\n%s\n</script>' % content_js)
       .replace('<script src="main.js"></script>', '<script>\n%s\n</script>' % main_js))

os.makedirs(os.path.join(R, 'dist'), exist_ok=True)
p = os.path.join(R, 'dist/standalone.html')
open(p, 'w', encoding='utf-8').write(out)
print('\ndist/standalone.html   %.1f MB' % (os.path.getsize(p)/1048576))
