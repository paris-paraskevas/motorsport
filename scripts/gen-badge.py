"""
Generate the notification badge PNG used by the service worker.

Android's Notification API renders `badge` as a white silhouette mask
in the status bar. Source must be monochrome (white on transparent).
A noisy or detailed image collapses into mush at status-bar size.

Output: public/icons/badge-96.png — 96x96, white-on-transparent,
single checkered flag on a pole. Crisp at small sizes.
"""
from PIL import Image, ImageDraw

SIZE = 96
OUT = "public/icons/badge-96.png"

WHITE = (255, 255, 255, 255)


def main():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Geometry — leave 8px breathing room around the icon.
    margin = 10
    pole_x = 24
    pole_top = margin
    pole_bottom = SIZE - margin
    pole_w = 7

    # Pole (thick rectangle, slightly rounded ends)
    draw.rounded_rectangle(
        [pole_x - pole_w // 2, pole_top, pole_x + pole_w // 2, pole_bottom],
        radius=2,
        fill=WHITE,
    )

    # Flag body — large rectangle starting just right of the pole, top-aligned,
    # taking ~half the icon height. Slight wave on the right edge.
    flag_left = pole_x + pole_w // 2
    flag_top = margin + 2
    flag_h = 44
    flag_bottom = flag_top + flag_h
    flag_right = SIZE - margin

    # Wave on the right edge — concave dip to evoke a flapping flag
    wave_dip = 7
    points = [
        (flag_left, flag_top),
        (flag_right, flag_top + 3),
        (flag_right - wave_dip, flag_top + flag_h // 2),
        (flag_right, flag_bottom - 3),
        (flag_left, flag_bottom),
    ]
    draw.polygon(points, fill=WHITE)

    img.save(OUT)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
