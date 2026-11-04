"""Generate app icons with Pillow: remove only the connected black corners."""

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
image = Image.open(ROOT / "icon.png").convert("RGBA")
pixels = image.load()
width, height = image.size
queue = deque([(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)])
visited = set()

while queue:
    x, y = queue.popleft()
    if (x, y) in visited or not (0 <= x < width and 0 <= y < height):
        continue
    visited.add((x, y))
    r, g, b, a = pixels[x, y]
    # The opaque lime tile stops this flood before it reaches the artwork.
    if a == 0 or g >= 240:
        continue
    # Undo the black matte on antialiased edge pixels as well.
    alpha = g if g > 5 else 0
    pixels[x, y] = (
        min(255, round(r * 255 / g)) if alpha else 0,
        255 if alpha else 0,
        min(255, round(b * 255 / g)) if alpha else 0,
        alpha,
    )
    queue.extend([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)])

image.save(ROOT / "icon.png")
output = ROOT / "public/icons"
for name, size in [("192", 192), ("512", 512), ("favicon-32", 32)]:
    image.resize((size, size), Image.Resampling.LANCZOS).save(output / f"yoridam-v2-{name}.png")

# Opaque platform variants avoid black fallback behind transparent pixels.
opaque = Image.new("RGBA", image.size, "#8cff19")
opaque.alpha_composite(image)
opaque.convert("RGB").resize((180, 180), Image.Resampling.LANCZOS).save(
    output / "yoridam-v2-apple-touch-icon.png"
)
maskable = Image.new("RGBA", (512, 512), "#8cff19")
maskable.alpha_composite(image.resize((330, 330), Image.Resampling.LANCZOS), (91, 91))
maskable.convert("RGB").save(output / "yoridam-v2-maskable-512.png")
