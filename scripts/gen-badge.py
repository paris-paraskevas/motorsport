"""
Generate the notification badge PNG used by the service worker.

Android's Notification API renders the `badge` as a tiny white silhouette
mask in the status bar — typically scaled down to ~24px. A noisy or
detailed source image collapses into mush at that size.

The previous design used a 4×3 chequer + pole, which at 24px became an
unreadable small white rectangle (see screenshot from 0.10.14 reports).
This redesign drops to a **2×2 chequer with a thick gutter**, no pole.
Two diagonally-opposite cells remain opaque white; the other two stay
transparent. At Android status-bar scale the alternating pattern is
still discernible — clearly a chequered motif rather than a generic
white blob.

Output: public/icons/badge-96.png — 96×96, white-on-transparent.
"""
from PIL import Image, ImageDraw

SIZE = 96
OUT = "public/icons/badge-96.png"

WHITE = (255, 255, 255, 255)


def main():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 2×2 chequered grid, centred. Generous outer margin + visible gutter
    # so the alternating pattern survives Android's silhouette downscale.
    grid_w = 76
    grid_h = 76
    grid_left = (SIZE - grid_w) // 2
    grid_top = (SIZE - grid_h) // 2

    cell_w = grid_w // 2
    cell_h = grid_h // 2
    gutter = 4  # transparent stripe between cells

    # (r + c) even → opaque white. Diagonal pair (0,0) and (1,1).
    for r in range(2):
        for c in range(2):
            if (r + c) % 2 != 0:
                continue
            x0 = grid_left + c * cell_w + gutter // 2
            y0 = grid_top + r * cell_h + gutter // 2
            x1 = grid_left + (c + 1) * cell_w - gutter // 2
            y1 = grid_top + (r + 1) * cell_h - gutter // 2
            draw.rectangle([x0, y0, x1, y1], fill=WHITE)

    img.save(OUT)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
