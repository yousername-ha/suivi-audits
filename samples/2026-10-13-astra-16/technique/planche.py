#!/usr/bin/env python3
"""Planche contact des images de la série (Pillow). Usage : python3 technique/planche.py"""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
files = sorted((root / 'images').glob('*.png'))
cols, cell_w, cell_h, pad = 5, 360, 260, 8
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (cell_w + pad) + pad, rows * (cell_h + 20 + pad) + pad), '#f5f5f0')
draw = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB')
    im.thumbnail((cell_w, cell_h))
    x, y = pad + (i % cols) * (cell_w + pad), pad + (i // cols) * (cell_h + 20 + pad)
    sheet.paste(im, (x, y))
    draw.text((x, y + im.height + 3), f.stem[:48], fill='#173f34')
sheet.save(root / 'PLANCHE-CONTACT.jpg', quality=82)
print(len(files), sheet.size)
