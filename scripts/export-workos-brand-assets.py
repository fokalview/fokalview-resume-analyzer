from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "brand-assets" / "workos"
FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")

NAVY = "#18202a"
BLUE = "#155f8a"
TEAL = "#0f8fa0"
PALE_BLUE = "#e7f5fb"
BORDER = "#bfd8e4"


def rounded_rectangle(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_mark(image, box):
    draw = ImageDraw.Draw(image)
    left, top, right, bottom = box
    size = right - left
    scale = size / 512

    rounded_rectangle(
        draw,
        box,
        radius=round(80 * scale),
        fill=PALE_BLUE,
        outline=BORDER,
        width=max(1, round(8 * scale)),
    )

    center_x = left + size * 0.5
    center_y = top + size * 0.53
    radius = size * 0.255
    stroke = max(2, round(size * 0.045))
    draw.ellipse(
        (
            center_x - radius,
            center_y - radius,
            center_x + radius,
            center_y + radius,
        ),
        outline=BLUE,
        width=stroke,
    )

    needle = [
        (center_x + size * 0.19, center_y - size * 0.22),
        (center_x + size * 0.06, center_y + size * 0.08),
        (center_x - size * 0.20, center_y + size * 0.22),
        (center_x - size * 0.06, center_y - size * 0.08),
    ]
    draw.polygon(needle, fill=BLUE)
    draw.line(
        (
            center_x - size * 0.06,
            center_y - size * 0.08,
            center_x + size * 0.06,
            center_y + size * 0.08,
        ),
        fill=PALE_BLUE,
        width=max(2, round(size * 0.025)),
    )

    arrow = [
        (left + size * 0.70, top + size * 0.14),
        (left + size * 0.88, top + size * 0.14),
        (left + size * 0.88, top + size * 0.32),
    ]
    draw.line(arrow, fill=TEAL, width=max(2, round(size * 0.035)), joint="curve")


def save_icon():
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw_mark(image, (8, 8, 504, 504))
    image.save(OUTPUT / "sagittaiq-logo-icon.png", optimize=True)


def save_logo():
    image = Image.new("RGBA", (1400, 400), (0, 0, 0, 0))
    draw_mark(image, (24, 24, 376, 376))
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(FONT_BOLD), 188)

    x = 430
    y = 88
    draw.text((x, y), "Sagitta", font=font, fill=NAVY, spacing=0)
    sagitta_width = draw.textlength("Sagitta", font=font)
    draw.text((x + sagitta_width, y), "IQ", font=font, fill=TEAL, spacing=0)
    image.save(OUTPUT / "sagittaiq-logo.png", optimize=True)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    save_icon()
    save_logo()
    for path in sorted(OUTPUT.glob("*.png")):
        with Image.open(path) as image:
            print(f"{path.name}: {image.width}x{image.height}, {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
