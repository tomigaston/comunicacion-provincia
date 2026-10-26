#!/usr/bin/env python3
"""
Verificación independiente del archivo de filas no procesadas de Pauta
Digital (entregables/pauta_digital/Filas_no_procesadas_Pauta_Digital.xlsx).

NO importa ni usa scripts/generar_datos.py: recalcula el cuadre directamente
de Contexto/Pauta RRSS_GLOBAL.xlsx y Contexto/Localidades (1).xlsx con una
implementación propia de las reglas del manual (universo D1, alias D2,
duplicados D4 con desempate B2) y lo compara contra:
  - la hoja Resumen del archivo de filas no procesadas, y
  - data/pauta_digital.json (piezas de la fuente nueva, por ámbito y estado).

Sale con código 1 si algún número no coincide.

Uso: python3 scripts/verificar_no_procesadas_pauta_digital.py
"""
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

import openpyxl
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PLANILLA = ROOT / "Contexto" / "Pauta RRSS_GLOBAL.xlsx"
LOCALIDADES = ROOT / "Contexto" / "Localidades (1).xlsx"
ARCHIVO_A = ROOT / "entregables" / "pauta_digital" / "Filas_no_procesadas_Pauta_Digital.xlsx"
JSON_PD = ROOT / "data" / "pauta_digital.json"
AUDIENCIA = "AUDIENCIA  (Barrios o publicos) "


def nrm(v):
    if v is None:
        return ""
    if isinstance(v, float) and v != v:
        return ""
    if v is pd.NaT:
        return ""
    t = unicodedata.normalize("NFKD", str(v).strip().upper()).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", t)


def vacio(v):
    return v is None or (isinstance(v, float) and v != v) or v is pd.NaT


def fecha(v):
    if vacio(v):
        return ""
    ts = pd.to_datetime(v, errors="coerce")
    return "" if pd.isna(ts) else ts.strftime("%Y-%m-%d")


def main():
    wb = openpyxl.load_workbook(PLANILLA, read_only=True)
    renglones = wb["GLOBAL_ImportRange"].max_row - 1
    wb.close()
    crudo = pd.read_excel(PLANILLA, sheet_name="GLOBAL_ImportRange")
    reales = crudo[~(crudo["CAMPAÑA"].apply(vacio) & crudo["TITULO DE LA PIEZA"].apply(vacio))]

    loc = pd.read_excel(LOCALIDADES, sheet_name="Hoja1")
    las60 = {nrm(r["Localidad"]): nrm(r["Departamento"]) for _, r in loc.iterrows()}
    por_depto = {}
    for l, d in las60.items():
        por_depto.setdefault(d, []).append(l)

    fuera, entradas = Counter(), []
    for i, r in reales.iterrows():
        e, f = r["DEPARTAMENTO"], r["LOCALIDAD / SUBCIRCUITO"]
        if "CORDOBA" not in nrm(e):
            fuera["fuera_de_cordoba"] += 1
            continue
        m = re.match(r"^DEPARTAMENTO\s+(DE\s+)?(.+)$", str(e).split(",")[0].strip(), re.I) if not vacio(e) else None
        depto = nrm(m.group(2)) if m else None
        ftxt = "" if vacio(f) else str(f).strip()
        if not ftxt:
            fuera["pendiente"] += 1
            continue
        if re.match(r"^\d{3,4}[A-Za-z]?\s*-", ftxt):
            locs, dirigida = ["CORDOBA"], True
        elif ftxt == "TODAS LAS LOCALIDADES":
            if depto:
                locs, dirigida = por_depto.get(depto, []), True
                if not locs:
                    fuera["depto_sin_60"] += 1
                    continue
            else:
                locs, dirigida = sorted(las60), False
        else:
            cand = nrm(ftxt.split(",")[0])
            if cand == "CORDOBA CAPITAL":
                cand = "CORDOBA"
            if cand == "VILLA SANTA ROSA DE RIO" and depto == "RIO PRIMERO":
                cand = "VILLA SANTA ROSA"
            if cand not in las60:
                fuera["localidad_fuera_60"] += 1
                continue
            locs, dirigida = [cand], True
        envio = pd.to_datetime(r["FECHA DE ENVÍO"], errors="coerce")
        for l in locs:
            entradas.append({
                "fila": int(i) + 2, "loc": l, "dirigida": dirigida, "estado": nrm(r["ESTADO"]),
                "envio": None if pd.isna(envio) else envio, "activo": nrm(r["ESTADO"]) == "ACTIVO",
                "clave": (nrm(r["CAMPAÑA"]), nrm(r["TITULO DE LA PIEZA"]), nrm(r["PLATAFORMA"]), l,
                          fecha(r["INICIO "]), fecha(r["FIN"]), nrm(r["LINK MATERIAL"]), nrm(r["TIPO DE MATERIAL"]),
                          nrm(r[AUDIENCIA])),
                "sub": ("circuito_capital" if re.match(r"^\d{3,4}", ftxt) else "multiple_depto" if ftxt == "TODAS LAS LOCALIDADES" and depto
                        else "multiple_provincia" if ftxt == "TODAS LAS LOCALIDADES" else "localidad_directa"),
            })

    def gana(a, b):  # True si a reemplaza a b
        if a["dirigida"] != b["dirigida"]:
            return a["dirigida"]
        if a["envio"] != b["envio"]:
            if b["envio"] is None:
                return True
            if a["envio"] is None:
                return False
            return a["envio"] > b["envio"]
        if a["activo"] != b["activo"]:
            return a["activo"]
        return False

    ganadora = {}
    for e in entradas:
        k = e["clave"]
        if k not in ganadora or gana(e, ganadora[k]):
            ganadora[k] = e
    quedan = list(ganadora.values())
    filas_entran = {e["fila"] for e in entradas}
    filas_quedan = {e["fila"] for e in quedan}

    propio = {
        "Renglones de la hoja GLOBAL_ImportRange (sin encabezado)": renglones,
        "Vacíos con formato (sin ningún valor), descartados": renglones - len(crudo),
        "Renglones con algún valor pero sin CAMPAÑA ni TITULO (arrastre), descartados": len(crudo) - len(reales),
        "Filas reales (CAMPAÑA o TITULO DE LA PIEZA cargados)": len(reales),
        "Fuera de Córdoba": fuera["fuera_de_cordoba"],
        "Fuera del universo: localidad fuera de las 60": fuera["localidad_fuera_60"],
        "Fuera del universo: TODAS LAS LOCALIDADES de un departamento sin ninguna de las 60": fuera["depto_sin_60"],
        "Pendientes (LOCALIDAD / SUBCIRCUITO vacía)": fuera["pendiente"],
        "Filas que entran al tablero": len(filas_entran),
        "Duplicadas: perdieron todas sus entradas (repetición genuina, sin métricas, a confirmar por el área)": len(filas_entran - filas_quedan),
        "Filas con al menos una entrada en el tablero": len(filas_quedan),
        "Entradas generadas (una por localidad alcanzada)": len(entradas),
        "Entradas unificadas (descartadas por duplicado)": len(entradas) - len(quedan),
        "Piezas del tablero (fuente Pauta RRSS_GLOBAL)": len(quedan),
    }

    resumen = pd.read_excel(ARCHIVO_A, sheet_name="Resumen", nrows=len(propio))
    archivo = dict(zip(resumen["Paso"], resumen["Cantidad"]))
    piezas = [p for p in json.load(open(JSON_PD, encoding="utf-8"))["piezas"] if p["fuente"] == "global"]

    errores = 0
    print(f"{'Paso':<100} {'propio':>8} {'archivo A':>10}")
    for paso, valor in propio.items():
        ok = archivo.get(paso) == valor
        errores += not ok
        print(f"{paso:<100} {valor:>8} {archivo.get(paso, '—'):>10}  {'OK' if ok else 'NO COINCIDE'}")
    hojas = pd.read_excel(ARCHIVO_A, sheet_name=None)
    n_fuera = len(hojas["Fuera_del_universo"])
    esperado_fuera = fuera["fuera_de_cordoba"] + fuera["localidad_fuera_60"] + fuera["depto_sin_60"]
    n_dup = len(hojas["Duplicadas"]) if "Fila descartada" in hojas["Duplicadas"].columns else 0
    for nombre, a, b in [
        ("Hoja Fuera_del_universo: filas", esperado_fuera, n_fuera),
        ("Hoja Duplicadas: entradas descartadas", len(entradas) - len(quedan), n_dup),
        ("JSON: piezas de la fuente nueva", len(quedan), len(piezas)),
        ("JSON: piezas por ámbito", dict(sorted(Counter(e["sub"] for e in quedan).items())), dict(sorted(Counter(p["sub_ambito"] for p in piezas).items()))),
        ("JSON: piezas Vigente (ESTADO = ACTIVO)", sum(e["estado"] == "ACTIVO" for e in quedan), sum(p["estado"] == "Vigente" for p in piezas)),
        ("JSON: piezas con ámbito departamento en la fuente nueva", 0, sum(p["alcance_tipo"] == "departamento" for p in piezas)),
    ]:
        ok = a == b
        errores += not ok
        print(f"{nombre:<100} {str(a):>8} {str(b):>10}  {'OK' if ok else 'NO COINCIDE'}")
    print("RESULTADO:", "todo coincide" if not errores else f"{errores} diferencia(s)")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
