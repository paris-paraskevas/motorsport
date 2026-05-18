"""
Generate the notification badge PNG used by the service worker.

Android's Notification API renders `badge` as a white silhouette mask
in the status bar. Source must be monochrome (white on transparent).
A noisy or detailed image collapses into mush at status-bar size.

Output: public/icons/badge-96.png — 96x96, white-on-transparent,
chequered flag on a pole. The chequer pattern is rendered as a 4x3 grid
of white squares against transparent gaps so it reads as motorsport-coded
even at status-bar resolution.
"""
from PIL import Image, ImageDraw

SIZE = 96
OUT = "public/icons/badge-96.png"

WHITE = (255, 255, 255, 255)


def main():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = 10
    pole_x = 22
    pole_top = margin
    pole_bottom = SIZE - margin
    pole_w = 6

    # Pole — slim, slightly rounded ends.
    draw.rounded_rectangle(
        [pole_x - pole_w // 2, pole_top, pole_x + pole_w // 2, pole_bottom],
        radius=2,
        fill=WHITE,
    )

    # Flag bounds — top-aligned, takes the upper half. A 4-col × 3-row
    # chequer grid fits comfortably in this area.
    flag_left = pole_x + pole_w // 2 + 1
    flag_top = margin + 2
    flag_right = SIZE - margin
    flag_h = 44
    flag_bottom = flag_top + flag_h

    cols = 4
    rows = 3
    cell_w = (flag_right - flag_left) // cols
    cell_h = (flag_bottom - flag_top) // rows

    # Alternating squares — (r + c) even → opaque white, else transparent.
    # Inner padding keeps a thin transparent gutter between squares so the
    # checker pattern stays legible even after Android's silhouette mask.
    pad = 1
    for r in range(rows):
        for c in range(cols):
            if (r + c) % 2 != 0:
                continue
            x0 = flag_left + c * cell_w + pad
            y0 = flag_top + r * cell_h + pad
            x1 = flag_left + (c + 1) * cell_w - pad
            y1 = flag_top + (r + 1) * cell_h - pad
            draw.rectangle([x0, y0, x1, y1], fill=WHITE)

    img.save(OUT)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
