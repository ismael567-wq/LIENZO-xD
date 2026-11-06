#!/usr/bin/env python3
"""Audita 48 pares de contraste del sistema de diseño de tiza (WCAG 2.2 AA).

Uso:
    python scripts/contraste_tiza.py            # informe legible
    python scripts/contraste_tiza.py --quiet    # solo fallos

Códigos de salida: 0 si todo pasa, 1 si hay algún par por debajo del mínimo.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass


@dataclass(frozen=True)
class Check:
    theme: str
    label: str
    fg: str
    bg: str
    minimum: float


NIGHT = {
    "pizarra": "#1E1C19",
    "pizarra_hondo": "#161411",
    "superficie": "#2A2823",
    "superficie_alta": "#383530",
    "tiza": "#F3F0E8",
    "tiza_suave": "#ABA59A",
    "tiza_tenue": "#9C968A",
    "lima": "#C7EC4A",
    "lima_300": "#D8F262",
    "marca_tinta": "#1E1C19",
    "cielo": "#9ECBFF",
    "verde": "#7FDCA8",
    "rojo": "#FF8A7A",
    "nota": "#F6D577",
    "nota_tinta": "#2A2418",
    "linea": "#3B3831",
}

DAY = {
    "papel": "#FAF7F0",
    "papel_hondo": "#F1ECDF",
    "superficie": "#FFFFFF",
    "superficie_alta": "#F7F3E9",
    "tinta": "#26241F",
    "tinta_suave": "#6B665C",
    "tinta_tenue": "#746E64",
    "marca": "#2F6B4F",
    "marca_tinta": "#FFFFFF",
    "lima_700": "#4E611C",
    "cielo_700": "#2E5FB7",
    "verde_700": "#2E7D5A",
    "rojo_700": "#B3372B",
    "nota": "#F6D577",
    "nota_tinta": "#2A2418",
    "linea": "#E8E2D4",
}


def build_checks() -> list[Check]:
    n, d = NIGHT, DAY
    checks: list[Check] = []

    # --- Noche (24) ------------------------------------------------------
    checks += [
        Check("noche", "texto principal sobre pizarra", n["tiza"], n["pizarra"], 4.5),
        Check("noche", "texto principal sobre superficie", n["tiza"], n["superficie"], 4.5),
        Check("noche", "texto principal sobre superficie alta", n["tiza"], n["superficie_alta"], 4.5),
        Check("noche", "texto suave sobre pizarra", n["tiza_suave"], n["pizarra"], 4.5),
        Check("noche", "texto suave sobre superficie", n["tiza_suave"], n["superficie"], 4.5),
        Check("noche", "texto tenue sobre pizarra", n["tiza_tenue"], n["pizarra"], 4.5),
        Check("noche", "texto tenue sobre superficie", n["tiza_tenue"], n["superficie"], 4.5),
        Check("noche", "lima sobre pizarra", n["lima"], n["pizarra"], 4.5),
        Check("noche", "lima sobre superficie", n["lima"], n["superficie"], 4.5),
        Check("noche", "lima 300 sobre pizarra", n["lima_300"], n["pizarra"], 4.5),
        Check("noche", "tinta de marca sobre lima (botón)", n["marca_tinta"], n["lima"], 4.5),
        Check("noche", "lima sobre tinta de marca", n["lima"], n["marca_tinta"], 4.5),
        Check("noche", "cielo sobre pizarra", n["cielo"], n["pizarra"], 4.5),
        Check("noche", "cielo sobre superficie", n["cielo"], n["superficie"], 4.5),
        Check("noche", "verde sobre pizarra", n["verde"], n["pizarra"], 4.5),
        Check("noche", "verde sobre superficie", n["verde"], n["superficie"], 4.5),
        Check("noche", "rojo sobre pizarra", n["rojo"], n["pizarra"], 4.5),
        Check("noche", "rojo sobre superficie", n["rojo"], n["superficie"], 4.5),
        Check("noche", "texto de nota sobre nota", n["nota_tinta"], n["nota"], 4.5),
        Check("noche", "nota sobre superficie", n["nota"], n["superficie"], 4.5),
        Check("noche", "foco lima sobre superficie (no texto)", n["lima"], n["superficie"], 3.0),
        Check("noche", "foco lima sobre pizarra (no texto)", n["lima"], n["pizarra"], 3.0),
        Check("noche", "texto suave sobre pizarra honda", n["tiza_suave"], n["pizarra_hondo"], 4.5),
        Check("noche", "texto principal sobre superficie alta", n["tiza"], n["superficie_alta"], 4.5),
    ]

    # --- Día (24) --------------------------------------------------------
    checks += [
        Check("día", "texto principal sobre papel", d["tinta"], d["papel"], 4.5),
        Check("día", "texto principal sobre superficie", d["tinta"], d["superficie"], 4.5),
        Check("día", "texto principal sobre superficie alta", d["tinta"], d["superficie_alta"], 4.5),
        Check("día", "texto suave sobre papel", d["tinta_suave"], d["papel"], 4.5),
        Check("día", "texto suave sobre superficie", d["tinta_suave"], d["superficie"], 4.5),
        Check("día", "texto tenue sobre papel", d["tinta_tenue"], d["papel"], 4.5),
        Check("día", "texto tenue sobre superficie", d["tinta_tenue"], d["superficie"], 4.5),
        Check("día", "marca sobre superficie", d["marca"], d["superficie"], 4.5),
        Check("día", "marca sobre papel", d["marca"], d["papel"], 4.5),
        Check("día", "tinta de marca sobre marca (botón)", d["marca_tinta"], d["marca"], 4.5),
        Check("día", "lima 700 sobre superficie", d["lima_700"], d["superficie"], 4.5),
        Check("día", "lima 700 sobre papel", d["lima_700"], d["papel"], 4.5),
        Check("día", "cielo 700 sobre superficie", d["cielo_700"], d["superficie"], 4.5),
        Check("día", "cielo 700 sobre papel", d["cielo_700"], d["papel"], 4.5),
        Check("día", "verde 700 sobre superficie", d["verde_700"], d["superficie"], 4.5),
        Check("día", "verde 700 sobre papel", d["verde_700"], d["papel"], 4.5),
        Check("día", "rojo 700 sobre superficie", d["rojo_700"], d["superficie"], 4.5),
        Check("día", "rojo 700 sobre papel", d["rojo_700"], d["papel"], 4.5),
        Check("día", "texto de nota sobre nota", d["nota_tinta"], d["nota"], 4.5),
        Check("día", "marca sobre superficie (no texto)", d["marca"], d["superficie"], 3.0),
        Check("día", "marca sobre papel (no texto)", d["marca"], d["papel"], 3.0),
        Check("día", "texto principal sobre papel hondo", d["tinta"], d["papel_hondo"], 4.5),
        Check("día", "texto suave sobre superficie alta", d["tinta_suave"], d["superficie_alta"], 4.5),
        Check("día", "marca sobre superficie alta", d["marca"], d["superficie_alta"], 4.5),
    ]
    return checks


def hex_to_rgb(value: str) -> tuple[float, float, float]:
    raw = value.lstrip("#")
    if len(raw) == 3:
        raw = "".join(part * 2 for part in raw)
    if len(raw) != 6:
        raise ValueError(f"Color inválido: {value}")
    return tuple(int(raw[i : i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def channel(value: float) -> float:
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def luminance(value: str) -> float:
    r, g, b = (channel(c) for c in hex_to_rgb(value))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(fg: str, bg: str) -> float:
    a, b = luminance(fg), luminance(bg)
    light, dark = max(a, b), min(a, b)
    return (light + 0.05) / (dark + 0.05)


def main() -> int:
    parser = argparse.ArgumentParser(description="Contraste WCAG de tiza")
    parser.add_argument("--quiet", action="store_true", help="muestra solo los fallos")
    args = parser.parse_args()

    checks = build_checks()
    failures = 0
    if not args.quiet:
        print(f"tiza · auditoría de contraste WCAG AA ({len(checks)} pares)\n")

    for index, check in enumerate(checks, start=1):
        value = ratio(check.fg, check.bg)
        ok = value >= check.minimum
        if not ok:
            failures += 1
        if not args.quiet or not ok:
            mark = "✓" if ok else "✗"
            print(
                f"{mark} {index:02d}. [{check.theme}] {check.label}: "
                f"{value:.2f}:1 (mín. {check.minimum:.1f})"
            )

    total = len(checks)
    print(
        f"\n{total - failures}/{total} pares cumplen AA"
        + (f" · {failures} fallo(s)" if failures else " · todo en orden")
    )
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
