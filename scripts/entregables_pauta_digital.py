#!/usr/bin/env python3
"""
Entregables de control de Pauta Digital que no son el tablero (los escribe
este script; el archivo de filas no procesadas lo escribe generar_datos.py en
la misma corrida que los JSON):

  B. Parejas_duplicadas_a_confirmar_por_el_area.xlsx
  C. Nombres_a_confirmar_por_el_area.xlsx
  F. Titulos_que_nombran_otro_lugar.xlsx (uso interno, no para el área)

Además imprime los números que usan el manual metodológico y el mail al área
(niveles de pauta activa, mail de vencimientos, estados), calculados sobre las
mismas piezas que el tablero.

Usa las funciones de generar_datos.py (mismas reglas, sin copiarlas) y no
escribe nada en data/. Respeta PD_FECHA_CONTROL igual que el generador.

Uso: python3 scripts/entregables_pauta_digital.py
"""
import difflib
import re
import sys
from collections import Counter
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generar_datos as g  # noqa: E402

pd = g.pd
SALIDA = g.ENTREGABLES_PD
SIMILITUD_SUGERENCIA = 0.75
COLUMNAS_PAREJA = (g.COLUMNA_AUDIENCIA_PAUTA_GLOBAL, "LINK MATERIAL", "TIPO DE MATERIAL")


def mapas():
    localidades, _ = g.cargar_localidades()
    l2o, l2d, d2l = {}, {}, {}
    for loc in localidades:
        nl, nd = g.normalizar(loc["localidad"]), g.normalizar(loc["departamento"])
        l2o[nl] = loc["localidad"]; l2d[nl] = loc["departamento"]
        d2l.setdefault(nd, []).append(nl)
    return localidades, l2o, l2d, d2l


def cargar():
    """Corre cargar_pauta_digital_global() capturando las entradas previas al
    descarte de duplicados (para medir B2 y armar las parejas)."""
    localidades, l2o, l2d, d2l = mapas()
    capturadas = {}
    original = g._dedup_pauta_global

    def con_captura(piezas):
        capturadas["entradas"] = [dict(p) for p in piezas]
        return original(piezas)

    g._dedup_pauta_global = con_captura
    try:
        piezas, control = g.cargar_pauta_digital_global(l2o, l2d, d2l)
    finally:
        g._dedup_pauta_global = original
    return localidades, l2o, l2d, d2l, piezas, control, capturadas["entradas"]


def medir_b2(entradas):
    """Grupos D4 que mezclan dirigida y provincial, y en cuántos B2 cambia la
    ganadora respecto de no aplicarlo (criterio de la Fase 1)."""
    grupos = {}
    for e in entradas:
        grupos.setdefault(e["_dedup_clave"], []).append(e)
    mixtos = [v for v in grupos.values() if len(v) > 1 and len({e["_dedup_dirigida"] for e in v}) > 1]
    sin_b2 = [dict(e, _dedup_dirigida=False) for e in entradas]
    gan_con = {e["_dedup_clave"]: (e["_fila"]) for e in g._dedup_pauta_global([dict(e) for e in entradas])[0]}
    gan_sin = {e["_dedup_clave"]: (e["_fila"]) for e in g._dedup_pauta_global(sin_b2)[0]}
    cambian = [v for v in mixtos if gan_con[v[0]["_dedup_clave"]] != gan_sin[v[0]["_dedup_clave"]]]
    return len(mixtos), cambian, gan_con, gan_sin


def parejas(control):
    """Pares de FILAS (descartada, queda) con su comparación de métricas."""
    df = control["df"]
    met = control["columnas_metricas"]
    por_par = {}
    for d in control["descartes"]:
        clave = (d["fila_descartada"], d["fila_queda"])
        por_par.setdefault(clave, {"d": d, "localidades": []})["localidades"].append(d["localidad"])
    filas = []
    for (fd, fq), info in por_par.items():
        r_d, r_q = df.loc[fd - 2], df.loc[fq - 2]
        difieren = [(c, g.limpio(r_d[c]), g.limpio(r_q[c])) for c in met if not g._mismo_valor(r_d[c], r_q[c])]
        vacias = [c.strip() for c in COLUMNAS_PAREJA if not g.normalizar(r_q[c])]
        filas.append({
            "Fila que queda": fq, "Fila descartada": fd,
            "CAMPAÑA": g.limpio(r_q["CAMPAÑA"]), "TITULO DE LA PIEZA": g.limpio(r_q["TITULO DE LA PIEZA"]),
            "Localidades donde coinciden": len(info["localidades"]),
            "Métricas": "DISTINTAS" if difieren else "MISMAS",
            "Métricas que difieren (descartada → queda)": "; ".join(f"{c.strip()}: {a!r} → {b!r}" for c, a, b in difieren),
            "Por qué queda esa fila": info["d"]["motivo"],
            "¿Alguna de AUDIENCIA / LINK MATERIAL / TIPO DE MATERIAL vacía?": ("Sí: " + ", ".join(vacias)) if vacias else "No",
            "AUDIENCIA": g.limpio(r_q[g.COLUMNA_AUDIENCIA_PAUTA_GLOBAL]), "TIPO DE MATERIAL": g.limpio(r_q["TIPO DE MATERIAL"]),
            "LINK MATERIAL": g.limpio(r_q["LINK MATERIAL"]),
            "¿La fila descartada perdió todas sus entradas?": "Sí" if info["d"]["fila_perdio_todas"] else "No",
        })
    filas.sort(key=lambda f: (f["Métricas"] != "DISTINTAS", f["Fila que queda"], f["Fila descartada"]))
    return filas


COMO_LEER_B = [
    "Qué es este archivo",
    "Cada renglón es una pareja de filas de la planilla Pauta RRSS_GLOBAL que el tablero considera la MISMA pieza "
    "cargada dos veces: coinciden en CAMPAÑA, TITULO DE LA PIEZA, PLATAFORMA, localidad, INICIO, FIN, LINK MATERIAL, "
    "TIPO DE MATERIAL y AUDIENCIA (sin distinguir mayúsculas, tildes ni espacios de más; una celda vacía coincide con otra vacía).",
    "El tablero muestra una sola de las dos (\"Fila que queda\") y no suma sus métricas.",
    "",
    "Qué les pedimos confirmar",
    "Para cada pareja, si son la misma pieza cargada dos veces (está bien que quede una) o si son piezas distintas.",
    "Si son piezas distintas, hay que diferenciarlas en alguna de las columnas de arriba (por ejemplo, TIPO DE MATERIAL, "
    "AUDIENCIA o LINK MATERIAL) para que el tablero las cuente por separado.",
    "",
    "Cómo leer las columnas",
    "Métricas: MISMAS si las dos filas traen exactamente las mismas métricas; DISTINTAS si alguna difiere. "
    "Las parejas con métricas DISTINTAS son las más importantes para revisar.",
    "Métricas que difieren: cada métrica con el valor de la fila descartada y, después de la flecha, el de la fila que queda.",
    "Por qué queda esa fila: la regla que eligió cuál se muestra (pauta dirigida antes que provincial; FECHA DE ENVÍO más "
    "reciente; ESTADO = ACTIVO; o, si todo empata, la primera de la planilla).",
    "Alguna vacía: si AUDIENCIA, LINK MATERIAL o TIPO DE MATERIAL están vacías, la coincidencia se apoya en menos datos.",
    "Localidades donde coinciden: una fila de TODAS LAS LOCALIDADES alcanza varias localidades; es la cantidad en que se superponen.",
]


def escribir_b(filas_b, ruta):
    with pd.ExcelWriter(ruta, engine="openpyxl") as xw:
        pd.DataFrame({"Cómo leer": COMO_LEER_B}).to_excel(xw, sheet_name="Cómo leer", index=False)
        pd.DataFrame(filas_b).to_excel(xw, sheet_name="Parejas", index=False)


def escribir_c(control, localidades, l2o, ruta):
    alias = [a for a in control["alias_aplicados"] if a["alias"] != "CORDOBA CAPITAL"]
    hoja_alias = pd.DataFrame([{
        "Fila de la planilla": a["fila"], "Texto en LOCALIDAD / SUBCIRCUITO": a["localidad_texto"],
        "Se toma como": a["localidad"], "ESTADO": a["estado"],
        "Condición": "Solo cuando DEPARTAMENTO es Río Primero",
        "Confirmación": "Alias confirmado para esta carga; pedimos al área que confirme que corresponde a Villa Santa Rosa.",
    } for a in alias])
    nombres = {}
    for f in control["fuera"]:
        if f["motivo"] != "localidad_fuera_de_las_60":
            continue
        k = (f["localidad_texto"], f["departamento_candidato"])
        nombres.setdefault(k, []).append(f)
    filas = []
    n60 = sorted(l2o)
    for (texto, depto), fs in sorted(nombres.items(), key=lambda x: (-len(x[1]), str(x[0]))):
        nt = g.normalizar(texto)
        mejor = max(n60, key=lambda x: difflib.SequenceMatcher(None, nt, x).ratio())
        sim = difflib.SequenceMatcher(None, nt, mejor).ratio()
        filas.append({
            "Nombre en la planilla": texto, "Departamento (columna DEPARTAMENTO)": depto,
            "Filas": len(fs), "ESTADO": ", ".join(f"{k}: {v}" for k, v in sorted(Counter(str(x["estado"]) for x in fs).items())),
            "Situación": "No está entre las 60 localidades del tablero",
            "Localidad de las 60 más parecida": l2o[mejor], "Similitud": round(sim, 2),
            "Sugerencia (no aplicada)": f"¿Es {l2o[mejor]}?" if sim >= SIMILITUD_SUGERENCIA else "",
            "Filas de la planilla": ", ".join(str(x["fila"]) for x in fs),
        })
    oficial = pd.DataFrame([{"Departamento": l["departamento"], "Localidad": l["localidad"]} for l in localidades])
    with pd.ExcelWriter(ruta, engine="openpyxl") as xw:
        hoja_alias.to_excel(xw, sheet_name="Alias aplicado", index=False)
        pd.DataFrame(filas).to_excel(xw, sheet_name="Fuera de las 60", index=False)
        oficial.to_excel(xw, sheet_name="Las 60 (lista oficial)", index=False)
    return alias, filas


def titulos_otro_lugar(control, piezas, l2o, l2d, d2l):
    """F: filas (no provinciales) cuyo TÍTULO o CAMPAÑA nombra una localidad
    de las 60 o un departamento distinto del asignado. B3: "CORDOBA" sola no
    se busca; sí "CORDOBA CAPITAL" (= Córdoba) y "CAPITAL"."""
    nombres = {n: n for n in l2o if n != "CORDOBA"}
    nombres.update({d: d for d in d2l})
    nombres["CORDOBA CAPITAL"] = "CORDOBA"
    patron = re.compile(r"\b(" + "|".join(re.escape(n) for n in sorted(nombres, key=len, reverse=True)) + r")\b")
    df = control["df"]
    por_fila = {}
    for e in control["entradas_por_fila"]:
        por_fila.setdefault(e["fila"], []).append(e)
    filas = []
    for fila, es in sorted(por_fila.items()):
        sub = es[0]["sub_ambito"]
        if sub == "multiple_provincia":
            continue
        r = df.loc[fila - 2]
        texto = f"{g.normalizar(r['TITULO DE LA PIEZA'])} | {g.normalizar(r['CAMPAÑA'])}"
        nombrados = {nombres[m.group(1)] for m in patron.finditer(texto)}
        if not nombrados:
            continue
        locs = {g.normalizar(e["localidad"]) for e in es}
        deptos = {g.normalizar(l2d[l]) for l in locs}
        ajenos = sorted(nombrados - locs - deptos)
        if not ajenos:
            continue
        asignado = (f"Depto. {l2d[next(iter(locs))]} ({len(locs)} localidades)" if sub == "multiple_depto"
                    else f"{l2o[next(iter(locs))]} ({'circuito de Capital' if sub == 'circuito_capital' else 'localidad'})")
        filas.append({
            "Fila de la planilla": fila, "TITULO DE LA PIEZA": g.limpio(r["TITULO DE LA PIEZA"]),
            "CAMPAÑA": g.limpio(r["CAMPAÑA"]), "Lugar asignado (DEPARTAMENTO / LOCALIDAD)": asignado,
            "Lugar nombrado en título o campaña": ", ".join(ajenos), "ESTADO": g.limpio(r["ESTADO"]),
        })
    return filas


def numeros(control, piezas, hoy):
    """Niveles a nivel FILA (universo y tablero), campañas, piezas y mail."""
    df = control["df"]
    por_fila = {}
    for e in control["entradas_por_fila"]:
        por_fila.setdefault(e["fila"], e["sub_ambito"])
    duplicadas = set(control["filas_duplicadas"])
    def fila_info(f):
        r = df.loc[f - 2]
        ini, fin = g._a_timestamp(r["INICIO "]), g._a_timestamp(r["FIN"])
        camp = g._forma_canonica(control["mapa_campanas"], g.limpio(r["CAMPAÑA"])) or g.limpio(r["TITULO DE LA PIEZA"])
        return dict(activo=g.normalizar(g.limpio(r["ESTADO"])) == "ACTIVO", ini=ini.date() if ini is not None else None,
                    fin=fin.date() if fin is not None else None, camp=g.normalizar(camp), sub=por_fila[f])
    info = {f: fila_info(f) for f in por_fila}
    def niveles(filas):
        n1 = [f for f in filas if info[f]["activo"]]
        n2 = [f for f in n1 if info[f]["ini"] and info[f]["fin"] and info[f]["ini"] <= hoy <= info[f]["fin"]]
        n3 = [f for f in n2 if info[f]["sub"] in g.SUB_AMBITOS_DIRIGIDOS_PAUTA_GLOBAL]
        mail = [f for f in n2 if hoy <= info[f]["fin"] <= hoy + timedelta(days=7)]
        c = lambda fs: len({info[f]["camp"] for f in fs})
        return {"N1": (len(n1), c(n1)), "N2": (len(n2), c(n2)), "N3": (len(n3), c(n3)),
                "mail": (len(mail), len({(info[f]["camp"], info[f]["fin"]) for f in mail})),
                "vencido": sum(1 for f in n1 if info[f]["fin"] and info[f]["fin"] < hoy),
                "campanas": c(filas)}
    universo = sorted(info)
    tablero = [f for f in universo if f not in duplicadas]
    hi = hoy.isoformat(); vh = (hoy + timedelta(days=7)).isoformat()
    viva = lambda p: p["estado"] == "Vigente" and p["inicio"] and p["finalizacion"] and p["inicio"] <= hi <= p["finalizacion"]
    dirig = lambda p: p["sub_ambito"] in g.SUB_AMBITOS_DIRIGIDOS_PAUTA_GLOBAL
    lineas = {(p["campana"] or p["titulo_pieza"] or "Sin campaña", p["finalizacion"])
              for p in piezas if viva(p) and hi <= p["finalizacion"] <= vh and p["localidad"]}
    cba = [p for p in piezas if p["localidad"] == "CORDOBA"]
    return {
        "universo": niveles(universo), "tablero": niveles(tablero),
        "piezas": {"N1": sum(p["estado"] == "Vigente" for p in piezas), "N2": sum(1 for p in piezas if viva(p)),
                   "N3": sum(1 for p in piezas if viva(p) and dirig(p))},
        "mail_lineas_codigo": len(lineas), "mail_campanas_codigo": len({c for c, _ in lineas}),
        "cordoba_tabla": len(cba), "cordoba_tarjeta": sum(1 for p in cba if viva(p) and dirig(p)),
        "localidades_con_pd_dirigida": len({p["localidad"] for p in piezas if viva(p) and dirig(p)}),
    }


def main():
    localidades, l2o, l2d, d2l, piezas, control, entradas = cargar()
    control["entradas_por_fila"] = [{"fila": e["_fila"], "sub_ambito": e["sub_ambito"], "localidad": e["localidad"]} for e in entradas]
    control["mapa_campanas"] = g.construir_mapa_formas_canonicas(control["df"]["CAMPAÑA"])
    SALIDA.mkdir(parents=True, exist_ok=True)
    print(f"Fecha de control: {g.HOY.isoformat()}")

    mixtos, cambian, gan_con, gan_sin = medir_b2(entradas)
    print(f"B2: grupos D4 que mezclan dirigida y provincial: {mixtos}; cambian de ganadora por B2: {len(cambian)}")
    for v in cambian:
        k = v[0]["_dedup_clave"]
        print(f"   {v[0]['campana']!r} | {v[0]['titulo_pieza']!r} | {v[0]['localidad']} | sin B2 quedaba fila {gan_sin[k]}, con B2 queda fila {gan_con[k]}")

    filas_b = parejas(control)
    escribir_b(filas_b, SALIDA / "Parejas_duplicadas_a_confirmar_por_el_area.xlsx")
    pares_entrada_vacia = sum(1 for d in control["descartes"]
                              if any(not g.normalizar(control["df"].loc[d["fila_queda"] - 2][c]) for c in COLUMNAS_PAREJA))
    print(f"B: {len(filas_b)} parejas de filas ({sum(f['Métricas'] == 'DISTINTAS' for f in filas_b)} con métricas DISTINTAS, "
          f"{sum(f['Métricas'] == 'MISMAS' for f in filas_b)} MISMAS; "
          f"{sum(f['¿Alguna de AUDIENCIA / LINK MATERIAL / TIPO DE MATERIAL vacía?'] != 'No' for f in filas_b)} con alguna de las 3 columnas vacía). "
          f"En entradas: {len(control['descartes'])} pares, {pares_entrada_vacia} con alguna vacía, "
          f"{sum(1 for d in control['descartes'] if not all(g._mismo_valor(control['df'].loc[d['fila_descartada'] - 2][c], control['df'].loc[d['fila_queda'] - 2][c]) for c in control['columnas_metricas']))} con métricas distintas")
    print(f"   motivos de desempate (pares de entradas): {dict(Counter(d['motivo'] for d in control['descartes']))}")

    alias, nombres_fuera = escribir_c(control, localidades, l2o, SALIDA / "Nombres_a_confirmar_por_el_area.xlsx")
    print(f"C: alias {len(alias)} filas ({dict(Counter(str(a['estado']) for a in alias))}); "
          f"{len(nombres_fuera)} nombres fuera de las 60 en {sum(f['Filas'] for f in nombres_fuera)} filas; "
          f"{sum(1 for f in nombres_fuera if f['Sugerencia (no aplicada)'])} con similitud >= {SIMILITUD_SUGERENCIA}")
    for f in nombres_fuera:
        if f["Sugerencia (no aplicada)"]:
            print(f"   {f['Nombre en la planilla']!r} ({f['Departamento (columna DEPARTAMENTO)']}) -> {f['Localidad de las 60 más parecida']} {f['Similitud']}")

    filas_f = titulos_otro_lugar(control, piezas, l2o, l2d, d2l)
    pd.DataFrame(filas_f).to_excel(SALIDA / "Titulos_que_nombran_otro_lugar.xlsx", sheet_name="Títulos", index=False)
    print(f"F: {len(filas_f)} filas; por lugar nombrado: {dict(Counter(x for f in filas_f for x in f['Lugar nombrado en título o campaña'].split(', ')).most_common())}")
    print(f"   por ESTADO: {dict(Counter(str(f['ESTADO']) for f in filas_f))}")

    df = control["df"]
    universo = sorted({e["fila"] for e in control["entradas_por_fila"]})
    U = df.loc[[f - 2 for f in universo]]
    print("NÚMEROS PARA EL MANUAL Y EL MAIL")
    print(f"   filas por ámbito (universo): {dict(Counter(e['sub_ambito'] for e in {e['fila']: e for e in control['entradas_por_fila']}.values()))}")
    print(f"   entradas por ámbito (antes de duplicados): {dict(Counter(e['sub_ambito'] for e in control['entradas_por_fila']))}")
    print(f"   piezas por ámbito (tablero): {dict(Counter(p['sub_ambito'] for p in piezas))}")
    print(f"   ESTADO (filas reales): {dict(Counter(g.normalizar(v) or '(vacío)' for v in df['ESTADO']))}")
    print(f"   ESTADO (filas del universo): {dict(Counter(g.normalizar(v) or '(vacío)' for v in U['ESTADO']))}")
    print(f"   piezas por estado (tablero): {dict(Counter(p['estado'] for p in piezas))}")
    vacio_estado = [int(i) + 2 for i, v in df["ESTADO"].items() if g.limpio(v) is None]
    print(f"   filas con ESTADO vacío: {vacio_estado}")
    sin_i, sin_f = df["INICIO "].apply(lambda v: g._a_timestamp(v) is None), df["FIN"].apply(lambda v: g._a_timestamp(v) is None)
    print(f"   sin INICIO ni FIN: {int((sin_i & sin_f).sum())} {dict(Counter(g.normalizar(v) or '(vacío)' for v in df[sin_i & sin_f]['ESTADO']))}; "
          f"con una sola: {int((sin_i ^ sin_f).sum())} filas {[int(i) + 2 for i in df.index[sin_i ^ sin_f]]}")
    print(f"   ACTIVO sin fechas: {int((sin_i & sin_f & (df['ESTADO'].apply(lambda v: g.normalizar(v)) == 'ACTIVO')).sum())}")
    print(f"   TIPO DE PAUTA = Orgánico: filas reales {int((df['TIPO DE PAUTA'].apply(g.normalizar) == 'ORGANICO').sum())}, "
          f"ACTIVO {int(((df['TIPO DE PAUTA'].apply(g.normalizar) == 'ORGANICO') & (df['ESTADO'].apply(g.normalizar) == 'ACTIVO')).sum())}")
    print(f"   COD. CONTENIDO vacío (filas reales, informativo): {int(df['COD. CONTENIDO'].apply(lambda v: g.limpio(v) is None).sum())}")
    print(f"   fuera de Córdoba: {[(f['fila'], f['departamento'], f['estado']) for f in control['fuera'] if f['motivo'] == 'fuera_de_cordoba']}")
    fuera60 = [f for f in control["fuera"] if f["motivo"] == "localidad_fuera_de_las_60"]
    print(f"   fuera de las 60 por ESTADO: {dict(Counter(str(f['estado']) for f in fuera60))}")
    for hoy in (g.HOY, g.HOY + timedelta(days=1)):
        n = numeros(control, piezas, hoy)
        print(f"   [{hoy.isoformat()}] UNIVERSO (filas que entran, incluye duplicadas): {n['universo']}")
        print(f"   [{hoy.isoformat()}] TABLERO (sin las filas duplicadas): {n['tablero']}")
        print(f"   [{hoy.isoformat()}] piezas-localidad N1/N2/N3: {n['piezas']} | mail (código): {n['mail_lineas_codigo']} líneas, "
              f"{n['mail_campanas_codigo']} campañas | Córdoba: tabla {n['cordoba_tabla']}, tarjeta {n['cordoba_tarjeta']} | "
              f"localidades con PD dirigida viva: {n['localidades_con_pd_dirigida']}")
    print(f"Escrito en {SALIDA.relative_to(g.ROOT)}/: Parejas_duplicadas_a_confirmar_por_el_area.xlsx, "
          "Nombres_a_confirmar_por_el_area.xlsx, Titulos_que_nombran_otro_lugar.xlsx")


if __name__ == "__main__":
    main()
