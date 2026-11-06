from PIL import Image, ImageDraw
import os

# tiza · icono de aplicación: teja de tiza con sonrisa y chispa lima.
S = 2048
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

d.rounded_rectangle(
    [0, 0, S, S],
    radius=int(S * 0.235),
    fill=(30, 28, 25, 255),  # --pizarra
)
d.rounded_rectangle(
    [int(S * 0.125), int(S * 0.125), int(S * 0.875), int(S * 0.875)],
    radius=int(S * 0.19),
    fill=(243, 240, 232, 255),  # --tiza
)

ink = (30, 28, 25, 255)
eye_r = int(S * 0.029)
for cx in (int(S * 0.39), int(S * 0.61)):
    cy = int(S * 0.43)
    d.ellipse([cx - eye_r, cy - eye_r, cx + eye_r, cy + eye_r], fill=ink)

d.arc(
    [int(S * 0.32), int(S * 0.42), int(S * 0.68), int(S * 0.70)],
    start=22,
    end=158,
    fill=ink,
    width=int(S * 0.046),
)

spark = int(S * 0.054)
d.ellipse(
    [int(S * 0.745) - spark, int(S * 0.255) - spark, int(S * 0.745) + spark, int(S * 0.255) + spark],
    fill=(199, 236, 74, 255),  # --lima-400
)

img = img.resize((1024, 1024), Image.LANCZOS)
os.makedirs("public", exist_ok=True)
for size, name in [
    (512, "pwa-512.png"),
    (192, "pwa-192.png"),
    (180, "apple-touch-icon.png"),
    (64, "favicon-64.png"),
]:
    img.resize((size, size), Image.LANCZOS).save(os.path.join("public", name))
img.resize((256, 256), Image.LANCZOS).save("public/icon.png")
print("icons written")
