"""
Square portrait centred on the face, for the example portraits.
  python3 face-crop.py <in> <out>
Exit 0: written. Exit 2: rejected (no face, several faces, or a face too
small: a distant figure, not a portrait).
"""
import sys

import cv2

src, out = sys.argv[1], sys.argv[2]
img = cv2.imread(src)
if img is None:
    sys.exit(2)
h, w = img.shape[:2]
gray = cv2.equalizeHist(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(int(w * 0.08), int(w * 0.08)))
if len(faces) == 0:
    sys.exit(2)
faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
x, y, fw, fh = faces[0]
# One person: a second face of comparable size means a group or a couple.
if len(faces) > 1 and faces[1][2] > fw * 0.5:
    sys.exit(2)
# A portrait: the face is at least a sixth of the photo's width.
if fw < w / 6:
    sys.exit(2)
side = int(min(fw * 2.6, w, h))
cx, cy = x + fw // 2, y + int(fh * 0.62)
left = max(0, min(w - side, cx - side // 2))
top = max(0, min(h - side, cy - side // 2))
crop = cv2.resize(img[top:top + side, left:left + side], (400, 400), interpolation=cv2.INTER_AREA)
cv2.imwrite(out, crop, [cv2.IMWRITE_JPEG_QUALITY, 82])
