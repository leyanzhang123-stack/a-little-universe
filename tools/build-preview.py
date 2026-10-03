# -*- coding: utf-8 -*-
"""Bundle the whole site into one HTML file, for sharing a preview link.
To fit under upload limits the preview downsizes photos and lowers the audio bitrate.
For the real deliverable use build-standalone.py (full quality + local fonts).
Usage: python3 tools/build-preview.py
"""
import re, os, base64, io, subprocess, tempfile
from PIL import Image
import imageio_ffmpeg

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda f: open(os.path.join(R, f), encoding='utf-8').read()

css = read('styles.css')
css = re.sub(r'/\* =+\n   Fonts[\s\S]*?\n\n(?=:root)', '', css)   # swap the local fonts for Google Fonts
css = (css.replace('"Site Body",', '"LXGW WenKai TC",')
          .replace('"Site Display","Site Display CJK",', '"Cormorant Garamond","Noto Serif SC",')
          .replace('"Site Mono",', '"DM Mono",'))

def shrink_img(path):
    im = Image.open(path).convert('RGB')
    im.thumbnail((820, 820), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=68, optimize=True)
    return 'image/jpeg', buf.getvalue()

def shrink_audio(path):
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    out = os.path.join(tempfile.gettempdir(), 'prev.m4a')
    subprocess.run([exe, '-y', '-hide_banner', '-loglevel', 'error', '-i', path,
                    '-ac', '1', '-b:a', '48k', '-c:a', 'aac', out], check=False)
    return 'audio/mp4', open(out, 'rb').read()

def shrink_video(path):
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    out = os.path.join(tempfile.gettempdir(), 'prev_%s.mp4' % abs(hash(path)))
    subprocess.run([exe, '-y', '-hide_banner', '-loglevel', 'error', '-i', path,
                    '-vf', 'scale=-2:720', '-c:v', 'libx264', '-crf', '30', '-preset', 'veryfast',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k',
                    '-movflags', '+faststart', out], check=False)
    return 'video/mp4', open(out, 'rb').read()

def asset(f):
    path = os.path.join(R, f)
    if not os.path.exists(path): return None
    ext = os.path.splitext(f)[1].lower()
    if ext in ('.jpg', '.jpeg', '.png', '.webp'): mime, data = shrink_img(path)
    elif ext in ('.mp3', '.m4a'):                 mime, data = shrink_audio(path)
    elif ext == '.mp4':                           mime, data = shrink_video(path)
    else: return None
    return "'data:%s;base64,%s'" % (mime, base64.b64encode(data).decode())

content = re.sub(r"'((?:photos|audio)/[^']+|[\w.-]+\.(?:mp3|m4a|mp4))'",
                 lambda m: asset(m.group(1)) or m.group(0), read('content.js'))

body = read('index.html')
body = body[body.index('<body class="night locked">') + len('<body class="night locked">'):]
body = body[:body.index('</body>')]
body = re.sub(r'\s*<script src="content\.js"></script>\s*<script src="main\.js"></script>\s*', '\n', body)

out = f'''<title>A Little Universe · preview</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Mono&family=LXGW+WenKai+TC&family=Noto+Serif+SC:wght@600&display=swap">
<style>
{css}
</style>
<script>document.body.classList.add('night','locked');</script>
{body}
<script>
{content}
</script>
<script>
{read('main.js')}
</script>
'''
os.makedirs(os.path.join(R, 'dist'), exist_ok=True)
p = os.path.join(R, 'dist/preview.html')
open(p, 'w', encoding='utf-8').write(out)
print('dist/preview.html  %.2f MB' % (os.path.getsize(p) / 1048576))
