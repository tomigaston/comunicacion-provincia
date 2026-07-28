#!/usr/bin/env python3
"""
Lee los excels fuente en contexto/ y genera los JSON que alimentan el
tablero en data/ (fuera de public/, servidos solo vía API routes con sesión).

Uso: python3 scripts/generar_datos.py
"""
import json
import re
import unicodedata
from datetime import datetime, date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CONTEXTO = ROOT / "contexto"
DATA_OUT = ROOT / "data"

HOY = date.today()


def normalizar(s):
    """Mayúsculas, sin espacios de más, sin tildes — para comparar claves entre planillas."""
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    s = str(s).strip().upper()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", s)


def _a_timestamp(v):
    """Acepta Timestamp/datetime/date/str y devuelve pd.Timestamp o None (NaT).

    Ojo: pd.NaT es instancia de datetime/date (subclasea para duck-typing), por
    eso hay que descartar nulos con pd.isna ANTES de mirar isinstance, si no
    un NaT se cuela como si fuera una fecha válida.
    """
    if v is None:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(v, pd.Timestamp):
        return v
    if isinstance(v, (datetime, date)):
        return pd.Timestamp(v)
    ts = pd.to_datetime(v, errors="coerce", dayfirst=False)
    return None if pd.isna(ts) else ts


def fecha_iso(v):
    ts = _a_timestamp(v)
    return None if ts is None else ts.strftime("%Y-%m-%d")


def estado_por_fecha(fecha_fin):
    """Vigente/Finalizada contra la fecha de hoy. None si no hay fecha (no se inventa)."""
    ts = _a_timestamp(fecha_fin)
    if ts is None:
        return None
    return "Vigente" if ts.date() >= HOY else "Finalizada"


def lista_links(v):
    """Las celdas de links traen varios links separados por salto de línea (uno por
    cada tema/campaña de la fila). Antes solo se guardaba el string crudo completo
    y el frontend lo usaba como href de un único <a>, por eso solo abría el primero.
    Acá se devuelve una lista de links ya separados y limpios, para que el frontend
    los liste todos (uno por renglón) sin tener que parsear nada."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return []
    texto = str(v)
    partes = re.split(r"[\r\n]+", texto)
    return [p.strip() for p in partes if p.strip()]


def limpio(v):
    """NaN/NaT -> None; numpy scalars -> tipos nativos; cualquier otra cosa rara (ej. celdas
    de Excel con formato hora, tipo datetime.time) -> string, para que siempre sea serializable."""
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    if isinstance(v, (pd.Timestamp, datetime, date)):
        return fecha_iso(v)
    if isinstance(v, (str, int, bool)):
        return v
    if hasattr(v, "item"):
        return v.item()
    if isinstance(v, float):
        return v
    return str(v)


# ---------------------------------------------------------------------------
# 1. Localidades (universo fijo de 60)
# ---------------------------------------------------------------------------

def cargar_localidades():
    df = pd.read_excel(CONTEXTO / "Localidades (1).xlsx", sheet_name="Hoja1")
    localidades = []
    claves = set()
    for _, row in df.iterrows():
        depto, loc = row["Departamento"], row["Localidad"]
        localidades.append({
            "departamento": str(depto).strip(),
            "localidad": str(loc).strip(),
            "cabecera": str(row.get("Cabecera", "")).strip().lower() == "si",
            "ranking": limpio(row.get("RANKING")),
            "poblacion": limpio(row.get("Población")),
        })
        claves.add((normalizar(depto), normalizar(loc)))
    return localidades, claves


# ---------------------------------------------------------------------------
# 2. Medios tradicionales
# ---------------------------------------------------------------------------

COBERTURA_COLS = {
    "TV": "TV",
    "RADIO": "RADIO",
    "WEB": "WEB",
    "CARTELERÍA": "CARTELERIA",
    "VIA PÚBLICA": "VIA_PUBLICA",
    "GRÁFICA": "GRAFICA",
    "PANTALLA LED": "PANTALLA_LED",
}


def banda_cobertura(total_tipos):
    if total_tipos <= 0:
        return "Sin"
    if total_tipos <= 2:
        return "Baja"
    if total_tipos <= 4:
        return "Media"
    return "Alta"


def cargar_medios_tradicionales():
    xls = CONTEXTO / "Medios tradicionales.xlsx"
    cobertura_df = pd.read_excel(xls, sheet_name="Cobertura")
    vigente_df = pd.read_excel(xls, sheet_name="Maestro_Vigente")
    cambios_df = pd.read_excel(xls, sheet_name="Cambios_Ultima_Semana")
    historico_df = pd.read_excel(xls, sheet_name="Historico")
    parametros_df = pd.read_excel(xls, sheet_name="Parametros", header=None)

    vigentes_por_localidad = {}
    for _, row in vigente_df.iterrows():
        clave = (normalizar(row["Departamento"]), normalizar(row["Localidad"]))
        vigentes_por_localidad.setdefault(clave, []).append({
            "tipo_medio": limpio(row["Tipo_Medio"]),
            "tema_vigente": limpio(row["Tema_Vigente"]),
            "link_material": limpio(row["Link_Material"]),  # string crudo, se mantiene por compatibilidad
            "links_material": lista_links(row["Link_Material"]),  # lista lista para listar en el front
            "fecha_inicio_racha": fecha_iso(row["Fecha_Inicio_Racha"]),
            "fecha_ultima_semana": fecha_iso(row["Fecha_Ultima_Semana"]),
            "semanas_consecutivas": limpio(row["Semanas_Consecutivas"]),
            "estado_semana": limpio(row["Estado_Semana"]),
        })

    localidades = []
    for _, row in cobertura_df.iterrows():
        clave = (normalizar(row["Departamento"]), normalizar(row["Localidad"]))
        total_tipos = int(row["Total_Tipos"])
        cobertura = {clave_json: int(row[col_original]) for col_original, clave_json in COBERTURA_COLS.items()}
        localidades.append({
            "departamento": str(row["Departamento"]).strip(),
            "localidad": str(row["Localidad"]).strip(),
            "cobertura": cobertura,
            "total_tipos": total_tipos,
            "banda_cobertura": banda_cobertura(total_tipos),
            "vigentes": vigentes_por_localidad.get(clave, []),
        })

    cambios = []
    for _, row in cambios_df.iterrows():
        cambios.append({
            "departamento": limpio(row["Departamento"]),
            "localidad": limpio(row["Localidad"]),
            "tipo_medio": limpio(row["Tipo_Medio"]),
            "fecha_semana_anterior": fecha_iso(row["Fecha_Semana_Anterior"]),
            "tema_anterior": limpio(row["Tema_Anterior"]),
            "fecha_semana_actual": fecha_iso(row["Fecha_Semana_Actual"]),
            "tema_actual": limpio(row["Tema_Actual"]),
        })

    semanas_cargadas = sorted({fecha_iso(f) for f in historico_df["Fecha_Snapshot"].dropna().unique()})

    # Umbrales de Parametros: la hoja es de formato libre (label en columna 1, valor en columna 3).
    umbral_amarilla = umbral_roja = None
    for _, row in parametros_df.iterrows():
        etiqueta = str(row[1]) if not pd.isna(row[1]) else ""
        valor = row[3]
        if not pd.isna(valor) and float(valor).is_integer():
            valor = int(valor)
        if "🟡" in etiqueta or "amarill" in etiqueta.lower():
            umbral_amarilla = limpio(valor)
        elif "🔴" in etiqueta or "rojo" in etiqueta.lower() or "roj" in etiqueta.lower():
            umbral_roja = limpio(valor)

    medios_tradicionales = {
        "semanas_cargadas": semanas_cargadas,
        "umbral_alerta_amarilla_semanas": umbral_amarilla,
        "umbral_alerta_roja_semanas": umbral_roja,
        "localidades": localidades,
    }
    movimientos_semana = {
        "total_avisos_cambiaron": len(cambios),
        "cambios": cambios,
    }
    return medios_tradicionales, movimientos_semana


# ---------------------------------------------------------------------------
# 3. Pauta digital
# ---------------------------------------------------------------------------

CODIGO_RE = re.compile(r"^([A-Za-z0-9]{14})\s*-\s*(.*)$")
ADCODE_RE = re.compile(r"^A\d{4,6}$")


def parsear_nombre_anuncio(nombre):
    """
    Formato real observado: CODIGO(14) - GEO[/audiencia] - AREA - CAMPAÑA - [segmentación] - ADCODE - formato - C/D|S/D - objetivo
    El geo y el ad-code ya vienen separados en columnas propias del excel curado;
    acá solo se extrae el código de pieza, el área temática y el título de campaña.
    """
    m = CODIGO_RE.match(str(nombre))
    if not m:
        return {"codigo_pieza": None, "area_tematica": None, "campana": str(nombre)}

    codigo, resto = m.group(1), m.group(2)
    partes = [p.strip() for p in resto.split(" - ")]

    if len(partes) < 3:
        return {"codigo_pieza": codigo, "area_tematica": None, "campana": partes[-1] if partes else resto}

    area_tematica = partes[1]
    ad_idx = next((i for i in range(2, len(partes)) if ADCODE_RE.match(partes[i])), None)

    if ad_idx is not None and ad_idx > 2:
        campana = " - ".join(partes[2:ad_idx])
    else:
        campana = partes[2]

    return {"codigo_pieza": codigo, "area_tematica": area_tematica, "campana": campana}


ALCANCE_A_TIPO = {
    "LOCALIDAD": "localidad",
    "CAPITAL": "localidad",
    "DEPARTAMENTO": "departamento",
    "PROVINCIA": "provincia",
}


def cargar_pauta_digital(claves_60):
    df = pd.read_excel(CONTEXTO / "Medios Digitales.xlsx", sheet_name="Pauta Digital Curada")
    piezas = []
    for _, row in df.iterrows():
        parseo = parsear_nombre_anuncio(row["Nombre del anuncio"])
        alcance_detectado = limpio(row["Alcance_Detectado (auditoría)"])
        depto = limpio(row["Departamento"])
        loc = limpio(row["Localidad"])

        en_60 = False
        if loc and (normalizar(depto), normalizar(loc)) in claves_60:
            en_60 = True
        elif alcance_detectado == "PROVINCIA":
            en_60 = True  # provincia entera siempre aplica al universo
        elif alcance_detectado == "DEPARTAMENTO" and depto:
            en_60 = any(normalizar(depto) == d for d, _ in claves_60)

        piezas.append({
            "codigo_pieza": parseo["codigo_pieza"],
            "nombre_anuncio": limpio(row["Nombre del anuncio"]),
            "area_tematica": parseo["area_tematica"],
            "campana": parseo["campana"],
            "alcance_detectado": alcance_detectado,
            "alcance_tipo": ALCANCE_A_TIPO.get(alcance_detectado),
            "en_60_localidades": en_60,
            "departamento": depto,
            "localidad": loc,
            "barrio": limpio(row["Barrio"]),
            "circuito_electoral": limpio(row["Circuito_Electoral"]),
            "inicio_informe": fecha_iso(row["Inicio del informe"]),
            "fin_informe": fecha_iso(row["Fin del informe"]),
            "fecha_creacion": fecha_iso(row["Fecha de creación"]),
            "finalizacion": fecha_iso(row["Finalización"]),
            "estado": estado_por_fecha(row["Finalización"]),
            "alcance": limpio(row["Alcance"]),
            "frecuencia": limpio(row["Frecuencia"]),
            "impresiones": limpio(row["Impresiones"]),
            "visualizaciones": limpio(row["Visualizaciones"]),
            "cpm": limpio(row["CPM (costo por mil impresiones) (ARS)"]),
            "importe_gastado": limpio(row["Importe gastado (ARS)"]),
            "presupuesto": limpio(row["Presupuesto del conjunto de anuncios"]),
            "tipo_presupuesto": limpio(row["Tipo de presupuesto del conjunto de anuncios"]),
            "clics": limpio(row["Clics en el enlace"]),
            "ctr": limpio(row["CTR (todos)"]),
        })
    return {"piezas": piezas}


# ---------------------------------------------------------------------------
# 4. Audiovisuales
# ---------------------------------------------------------------------------

def cargar_audiovisuales():
    df = pd.read_excel(CONTEXTO / "Audiovisuales.xlsx", sheet_name="Localidades y Campañas")
    items = []
    for _, row in df.iterrows():
        origen = limpio(row["Origen"])
        items.append({
            "origen": origen,
            "es_campana": origen == "25 localidades",  # Obras FOCOM no es "Campaña" (doc 3.3)
            "fecha_carga": fecha_iso(row["Fecha_Carga"]),
            "campana": limpio(row["Campaña"]),
            "tipo_contenido": limpio(row["Tipo_Contenido"]),
            "departamento": limpio(row["Departamento"]),
            "localidad": limpio(row["Localidad"]),
            "en_60_prioritarias": str(row.get("En_60_Prioritarias", "")).strip().lower() == "sí",
            "fecha_inicio": fecha_iso(row["Fecha_Inicio"]),
            "fecha_fin": fecha_iso(row["Fecha_Fin"]),
            "estado": estado_por_fecha(row["Fecha_Fin"]),
            "link": limpio(row["Link"]),  # string crudo, se mantiene por compatibilidad
            "links": lista_links(row["Link"]),  # lista lista para listar en el front (por si trae más de uno)
            "copy": limpio(row["Copy"]),
            "sugerencias_pauta": limpio(row["Sugerencias_Pauta"]),
            "notas": limpio(row["Notas"]),
        })
    return {"items": items}


# ---------------------------------------------------------------------------
# 5. Campañas unificadas
# ---------------------------------------------------------------------------

def construir_campanas(medios_tradicionales, pauta_digital, audiovisuales):
    items = []

    for loc in medios_tradicionales["localidades"]:
        for v in loc["vigentes"]:
            items.append({
                "area_origen": "Medios tradicionales",
                "campana": v["tema_vigente"],
                "alcance_tipo": "localidad",
                "departamento": loc["departamento"],
                "localidad": loc["localidad"],
                "detalle": {
                    "tipo_medio": v["tipo_medio"],
                    "semanas_consecutivas": v["semanas_consecutivas"],
                    "estado_semana": v["estado_semana"],
                    "link_material": v["link_material"],
                    "links_material": v["links_material"],
                },
            })

    for pieza in pauta_digital["piezas"]:
        if pieza["alcance_tipo"] is None:
            continue  # BARRIO/CIRCUITO/CODIGO_AUDIENCIA/OTRO/REGION: no aplican a la vista unificada por localidad/depto
        if not pieza["en_60_localidades"]:
            continue
        items.append({
            "area_origen": "Pauta digital",
            "campana": pieza["campana"],
            "alcance_tipo": pieza["alcance_tipo"],
            "departamento": pieza["departamento"],
            "localidad": pieza["localidad"],
            "detalle": {
                "area_tematica": pieza["area_tematica"],
                "estado": pieza["estado"],
                "finalizacion": pieza["finalizacion"],
                "alcance": pieza["alcance"],
                "importe_gastado": pieza["importe_gastado"],
            },
        })

    for item in audiovisuales["items"]:
        if not item["es_campana"]:
            continue  # Obras FOCOM queda afuera del concepto de Campaña (doc 3.3/4)
        items.append({
            "area_origen": "Audiovisuales",
            "campana": item["campana"],
            "alcance_tipo": "localidad",
            "departamento": item["departamento"],
            "localidad": item["localidad"],
            "detalle": {
                "tipo_contenido": item["tipo_contenido"],
                "estado": item["estado"],
                "fecha_inicio": item["fecha_inicio"],
                "fecha_fin": item["fecha_fin"],
                "link": item["link"],
                "links": item["links"],
            },
        })

    return {"items": items}


# ---------------------------------------------------------------------------

def escribir_json(nombre, contenido):
    DATA_OUT.mkdir(exist_ok=True)
    destino = DATA_OUT / nombre
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(contenido, f, ensure_ascii=False, indent=2)
    print(f"  {nombre}: escrito ({destino.stat().st_size:,} bytes)")


def main():
    print("Generando datos del tablero...")

    localidades, claves_60 = cargar_localidades()
    escribir_json("localidades.json", {"localidades": localidades})

    medios_tradicionales, movimientos_semana = cargar_medios_tradicionales()
    escribir_json("medios_tradicionales.json", medios_tradicionales)
    escribir_json("movimientos_semana.json", movimientos_semana)

    pauta_digital = cargar_pauta_digital(claves_60)
    escribir_json("pauta_digital.json", pauta_digital)

    audiovisuales = cargar_audiovisuales()
    escribir_json("audiovisuales.json", audiovisuales)

    campanas = construir_campanas(medios_tradicionales, pauta_digital, audiovisuales)
    escribir_json("campanas.json", campanas)

    print("Listo.")


if __name__ == "__main__":
    main()
