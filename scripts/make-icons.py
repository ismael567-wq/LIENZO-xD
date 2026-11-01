from PIL import Image, ImageDraw
import os

S = 2048
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
radius = int(S * 0.235)
d.rounded_rectangle([0, 0, S, S], radius=radius, fill=(14, 91, 79, 255))
w = int(S * 0.085)
def line(points, color, width):
    d.line(points, fill=color, width=width, joint="curve")
    for p in (points[0], points[-1]):
        d.ellipse([p[0]-width/2, p[1]-width/2, p[0]+width/2, p[1]+width/2], fill=color)

line([(int(S*0.31), int(S*0.30)), (int(S*0.31), int(S*0.69)), (int(S*0.69), int(S*0.69))], (221, 240, 106, 255), w)
line([(int(S*0.47), int(S*0.46)), (int(S*0.69), int(S*0.68))], (255, 253, 247, 255), int(w*0.82))
d.ellipse([int(S*0.695), int(S*0.285), int(S*0.755), int(S*0.345)], fill=(255, 253, 247, 255))

img = img.resize((1024, 1024), Image.LANCZOS)
os.makedirs("public", exist_ok=True)
for size, name in [(512, "pwa-512.png"), (192, "pwa-192.png"), (180, "apple-touch-icon.png"), (64, "favicon-64.png")]:
    img.resize((size, size), Image.LANCZOS).save(os.path.join("public", name))
img.resize((256, 256), Image.LANCZOS).save("public/icon.png")
print("icons written")
