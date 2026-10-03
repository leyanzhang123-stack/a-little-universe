# -*- coding: utf-8 -*-
"""Generate the placeholder images used by the demo (photos/demo/).
No real photography at all: soft gradients and geometry drawn in code.
Aspect ratios are deliberately as uneven as real material, so the layout
exercises the same branches.
Usage: python3 tools/make-demo-photos.py
"""
import os, math, random
from PIL import Image, ImageDraw, ImageFilter

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Follows the site colour temperatures: cream, pale sky, soft violet, warm
# beige, dusk violet
PALETTES = [
    ((252, 247, 238), (214, 227, 240)),
    ((226, 238, 247), (189, 205, 232)),
    ((214, 214, 240), (176, 180, 226)),
    ((247, 238, 222), (226, 207, 184)),
    ((190, 190, 224), (120, 126, 176)),
]

def grad(w, h, c1, c2, angle):
    """Lay down a linear gradient at an arbitrary angle."""
    base = Image.new('RGB', (w, h))
    px = base.load()
    rad = math.radians(angle)
    dx, dy = math.cos(rad), math.sin(rad)
    span = abs(w * dx) + abs(h * dy)
    for y in range(h):
        for x in range(w):
            t = ((x * dx + y * dy) + span / 2) / span
            t = min(1.0, max(0.0, t))
            px[x, y] = (
                int(c1[0] + (c2[0] - c1[0]) * t),
                int(c1[1] + (c2[1] - c1[1]) * t),
                int(c1[2] + (c2[2] - c1[2]) * t),
            )
    return base

def make(path, w, h, seed):
    rnd = random.Random(seed)
    c1, c2 = PALETTES[seed % len(PALETTES)]
    img = grad(w, h, c1, c2, rnd.uniform(0, 360))

    # a few soft light and dark blobs, standing in for tonal areas in a photo
    blob = Image.new('RGB', (w, h), (0, 0, 0))
    bd = ImageDraw.Draw(blob)
    for _ in range(rnd.randint(3, 5)):
        r = rnd.randint(min(w, h) // 5, min(w, h) // 2)
        cx, cy = rnd.randint(0, w), rnd.randint(0, h)
        v = rnd.randint(140, 255)
        bd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(v, v, v))
    blob = blob.filter(ImageFilter.GaussianBlur(min(w, h) // 6))
    img = Image.blend(img, Image.composite(
        Image.new('RGB', (w, h), (255, 255, 255)), img, blob.convert('L')), 0.22)

    # a thin geometric line, so the placeholder reads as designed rather than broken
    d = ImageDraw.Draw(img, 'RGBA')
    d.line([(0, h * rnd.uniform(.3, .7)), (w, h * rnd.uniform(.3, .7))],
           fill=(255, 255, 255, 60), width=max(1, w // 300))
    rr = min(w, h) // 5
    d.ellipse([w / 2 - rr, h / 2 - rr, w / 2 + rr, h / 2 + rr],
              outline=(255, 255, 255, 90), width=max(1, w // 260))

    img = img.filter(ImageFilter.GaussianBlur(0.4))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'JPEG', quality=82, optimize=True)

# uneven shapes, like real material: portrait, landscape and square
SHAPES = [(1200, 1500), (1200, 900), (900, 1200), (1200, 1200), (1050, 1400), (1400, 1050)]

def batch(folder, n, off):
    for i in range(1, n + 1):
        w, h = SHAPES[(i + off) % len(SHAPES)]
        make(os.path.join(R, 'photos/demo', folder, '%02d.jpg' % i), w, h, i + off)
    print('photos/demo/%s  ->  %d images' % (folder, n))

batch('timeline', 12, 0)
batch('meals', 8, 2)
batch('childhood', 6, 4)
make(os.path.join(R, 'photos/demo/finale-poster.jpg'), 900, 1200, 9)
print('photos/demo/finale-poster.jpg')
