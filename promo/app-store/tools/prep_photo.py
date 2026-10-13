"""Cut, resize and finish one photo for the App Store header images (called by compose-header.mjs).

Usage: python3 prep_photo.py SRC OUT X0 Y0 X1 Y1 WIDTH HEIGHT GRAIN
The crop (X0, Y0, X1, Y1, source pixels) is resized to WIDTH x HEIGHT with Lanczos, lightly
sharpened, then given a fine monochrome grain (GRAIN = noise sigma, 0 for none) that keeps an
enlarged photo from looking smeared.
"""
import sys

from PIL import Image, ImageChops, ImageFilter

src, out, x0, y0, x1, y1, width, height, grain = sys.argv[1:10]
w, h = int(width), int(height)
im = Image.open(src).convert('RGB').crop((int(x0), int(y0), int(x1), int(y1)))
im = im.resize((w, h), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=3, percent=55, threshold=2))
sigma = float(grain)
if sigma:
    noise = Image.effect_noise((w, h), sigma).convert('RGB')  # grey noise centred on 128
    im = ImageChops.add(im, noise, 1, -128)
im.save(out)
