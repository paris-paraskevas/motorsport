"""
Generate the notification badge PNG used by the service worker.

Android's Notification API renders `badge` as a white silhouette mask
in the status bar. Source MUST be monochrome — a single opaque colour
(white) on transparency, with NO colour and NO gradients. Anything else
collapses into mush (or a solid blob) once Android applies its alpha mask.

Output: public/icons/badge-96.png — 96x96, white-on-transparent,
a chequered flag on a pole. The chequer is drawn as opaque white squares
against transparent gaps on a 4x4 grid, so the "flag" reads as a
motorsport-coded silhouette even at status-bar resolution.
"""
from PIL import Image, ImageDraw

SIZE = 96
OUT = "public/icons/badge-96.png"

# Single opaque colour. White on transparent is the ONLY safe choice for the
# Android badge mask — see the module docstring.
WHITE = (255, 255, 255, 255)


def main():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Safe-zone padding — keep the motif clear of the icon edge so it isn't
    # clipped by the platform's circular/rounded badge crop.
    margin = 10

    # Pole — a slim vertical staff down the left, slightly rounded ends.
    pole_cx = 22
    pole_w = 6
    pole_top = margin
    pole_bottom = SIZE - margin
    draw.rounded_rectangle(
        [pole_cx - pole_w // 2, pole_top, pole_cx + pole_w // 2, pole_bottom],
        radius=pole_w // 2,
        fill=WHITE,
    )

    # Flag — a square-ish chequered field flying from the top of the pole.
    # A 4x4 grid keeps the corners filled (grid[0][0] opaque), which reads as a
    # proper chequered flag rather than a lattice, and stays legible after the
    # silhouette mask because the opaque squares meet corner-to-corner.
    grid = 4
    flag_left = pole_cx + pole_w // 2
    flag_top = margin + 2
    flag_size = 48  # width == height, an even multiple of the grid
    cell = flag_size // grid  # 12px cells

    for row in range(grid):
        for col in range(grid):
            # Checkerboard: fill where (row + col) is even so opposite corners
            # are opaque. No inner padding — squares touch at their corners,
            # which survives downscaling far better than gutter-separated cells.
            if (row + col) % 2 != 0:
                continue
            x0 = flag_left + col * cell
            y0 = flag_top + row * cell
            x1 = x0 + cell
            y1 = y0 + cell
            draw.rectangle([x0, y0, x1, y1], fill=WHITE)

    img.save(OUT)

    # Assert the monochrome + transparency invariants so a bad edit can't
    # silently ship a coloured or opaque badge. Pixels are read via load()
    # (a stable API) rather than getdata() (deprecated in Pillow 12).
    check = Image.open(OUT).convert("RGBA")
    px = check.load()
    opaque_colours = set()
    has_transparent = False
    for y in range(check.height):
        for x in range(check.width):
            r, g, b, a = px[x, y]
            if a == 255:
                opaque_colours.add((r, g, b))
            elif a == 0:
                has_transparent = True
    assert check.size == (SIZE, SIZE), f"expected {SIZE}x{SIZE}, got {check.size}"
    assert opaque_colours <= {WHITE[:3]}, f"non-white opaque pixels: {opaque_colours}"
    assert has_transparent, "badge has no transparency — Android mask will break"

    print(f"wrote {OUT} — {check.size[0]}x{check.size[1]}, white-on-transparent")


if __name__ == "__main__":
    main()
