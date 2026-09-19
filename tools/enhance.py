#!/usr/bin/env python3
"""
تحسين جودة الصور — بدون تغيير محتواها
Enhance image quality without altering content.

يرفع الدقة، ويزيل التشويش، ويحدّ الحواف، ويضبط السطوع والتباين والألوان.
لا يضيف أو يحذف أي عنصر من الصورة.

الاستخدام:
    python tools/enhance.py assets/img/school-original.jpg assets/img/school.jpg
    python tools/enhance.py assets/img/logo-raw.png assets/img/logo-kindergarten.png --logo

الخيارات:
    --logo     وضع الشعارات: يحافظ على الشفافية وحدّة الحواف، بلا تدفئة ألوان
    --scale N  معامل التكبير (افتراضيًا ٢ للصور، ٣ للشعارات)
    --width N  العرض النهائي بالبكسل (يتجاوز --scale)
"""

import argparse
import os
import sys

try:
    from PIL import Image, ImageEnhance, ImageFilter
except ImportError:
    sys.exit("PIL غير مثبّت. نفّذ:  pip install pillow")


def enhance_photo(img, scale):
    """صورة فوتوغرافية: تكبير ناعم + إزالة تشويش + حدّة + تباين ودفء خفيف."""
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    w, h = img.size
    img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # تنعيم خفيف يزيل حبيبات كاميرا الجوال قبل زيادة الحدة
    img = img.filter(ImageFilter.MedianFilter(size=3))

    # حدّة موجّهة: تبرز التفاصيل دون هالات حول الحواف
    img = img.filter(ImageFilter.UnsharpMask(radius=2.2, percent=145, threshold=3))

    img = ImageEnhance.Brightness(img).enhance(1.04)
    img = ImageEnhance.Contrast(img).enhance(1.14)
    img = ImageEnhance.Color(img).enhance(1.16)
    return img


def enhance_logo(img, scale):
    """شعار: تكبير مع الحفاظ على الشفافية وحدّة الحروف، بلا تغيير ألوان."""
    if img.mode not in ("RGBA", "LA"):
        img = img.convert("RGBA")

    w, h = img.size
    img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=1.6, percent=190, threshold=2))
    img = ImageEnhance.Contrast(img).enhance(1.08)
    return img


def main():
    ap = argparse.ArgumentParser(description="تحسين جودة صورة دون تغيير محتواها")
    ap.add_argument("src", help="الصورة الأصلية")
    ap.add_argument("dst", help="ملف الإخراج")
    ap.add_argument("--logo", action="store_true", help="وضع الشعارات")
    ap.add_argument("--scale", type=float, default=None, help="معامل التكبير")
    ap.add_argument("--width", type=int, default=None, help="العرض النهائي بالبكسل")
    args = ap.parse_args()

    if not os.path.exists(args.src):
        sys.exit("لم يُعثر على الملف: " + args.src)

    img = Image.open(args.src)
    ow, oh = img.size

    scale = args.scale if args.scale else (3.0 if args.logo else 2.0)
    if args.width:
        scale = args.width / ow

    img = enhance_logo(img, scale) if args.logo else enhance_photo(img, scale)

    os.makedirs(os.path.dirname(os.path.abspath(args.dst)) or ".", exist_ok=True)

    ext = os.path.splitext(args.dst)[1].lower()
    if ext in (".jpg", ".jpeg"):
        img.convert("RGB").save(args.dst, "JPEG", quality=93, optimize=True, progressive=True)
    else:
        img.save(args.dst, optimize=True)

    nw, nh = img.size
    kb = os.path.getsize(args.dst) / 1024
    print("تم: {}x{}  ←  {}x{}   ({:.0f} ك.ب)".format(ow, oh, nw, nh, kb))
    print("الملف: " + args.dst)


if __name__ == "__main__":
    main()
