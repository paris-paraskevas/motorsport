"""
Generate the notification badge PNG used by the service worker.

Android's Notification API takes a `badge` icon and renders it as a
white silhouette mask in the status bar. The source image must be
monochrome (white on transparent); a full-colour source produces the
"blank white square" rendering you'd otherwise see.

Output: public/icons/badge-96.png — 96x96, white-on-transparent,
crossed-checkered-flags silhouette echoing the app icon.
"""
from PIL import Image, ImageDraw

SIZE = 96
OUT = "public/icons/badge-96.png"


def draw_flag(draw: ImageDraw.ImageDraw, pole_x: int, base_y: int,
              top_y: int, flag_w: int, flag_h: int, direction: int):
    """Draw a triangular pennant + pole, monochrome white."""
    # Pole — a vertical white rectangle from base_y down to top_y up
    pole_w = 4
    draw.rectangle(
        [pole_x - pole_w // 2, top_y, pole_x + pole_w // 2, base_y],
        fill=(255, 255, 255, 255),
    )
    # Flag — a parallelogram-ish shape billowing in `direction` (1 = right, -1 = left)
    flag_left = pole_x + pole_w // 2 if direction == 1 else pole_x - pole_w // 2 - flag_w
    flag_top = top_y
    flag_bottom = top_y + flag_h
    flag_right = flag_left + flag_w
    poly = [
        (flag_left, flag_top),
        (flag_right, flag_top + flag_h // 5),
        (flag_right - flag_w // 6, flag_bottom - flag_h // 6),
        (flag_left, flag_bottom - flag_h // 3),
    ]
    draw.polygon(poly, fill=(255, 255, 255, 255))


def main():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Two crossed flags, mirrored, meeting near the middle.
    # Pole 1 — left flag, leaning slightly right (we just place vertically)
    draw_flag(
        draw,
        pole_x=30, base_y=88, top_y=18,
        flag_w=42, flag_h=34,
        direction=1,
    )
    # Pole 2 — right flag, mirrored
    draw_flag(
        draw,
        pole_x=SIZE - 30, base_y=88, top_y=18,
        flag_w=42, flag_h=34,
        direction=-1,
    )

    img.save(OUT)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
