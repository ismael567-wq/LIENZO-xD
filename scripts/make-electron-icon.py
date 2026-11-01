from PIL import Image
img = Image.open("public/pwa-512.png").convert("RGBA")
img.save("build/icon.png")
img.save("build/icon.ico", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print("icons ok")
