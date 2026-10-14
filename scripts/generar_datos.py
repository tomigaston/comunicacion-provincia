#!/usr/bin/env python3
"""
Lee los excels fuente en contexto/ y genera los JSON que alimentan el
tablero en data/ (fuera de public/, servidos solo vía API routes con sesión).

Uso: python3 scripts/generar_datos.py
"""
import difflib
import json
import re
import unicodedata
from collections import Counter
from datetime import datetime, date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CONTEXTO = ROOT / "Contexto"
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


def estado_pauta_digital_desde_crudo(valor_estado_crudo):
    """Estado expuesto en Pauta Digital (fuente GLOBAL, Pauta RRSS_GLOBAL.xlsx):
    se toma DIRECTO de la columna ESTADO del crudo, sin inventar categorías
    propias (regla de negocio 24/09/2026, reemplaza al cálculo viejo por fecha
    INICIO/FIN y también retira por completo el estado fijo "Pendiente" para
    piezas sin COD. CONTENIDO/FECHA DE ENVÍO). Mapeo: ACTIVO -> "Vigente",
    INACTIVO -> "Finalizada", OBSERVADO -> "Observada", PROGRAMADO ->
    "Programada" (11/10/2026: pieza cargada que todavía no empezó; categoría
    propia, no se mapea a Vigente ni a Finalizada ni se recalcula por fecha),
    vacío -> "S/D" (la
    planilla de origen todavía no calculó ESTADO para esa fila -- no se
    infiere nada). Cualquier otro valor se muestra TAL CUAL viene en el
    crudo, sin forzarlo a estas categorías ni descartar la fila."""
    valor = limpio(valor_estado_crudo)
    if valor is None:
        return "S/D"
    return {
        "ACTIVO": "Vigente",
        "INACTIVO": "Finalizada",
        "OBSERVADO": "Observada",
        "PROGRAMADO": "Programada",
    }.get(normalizar(valor), valor)


def estado_audiovisual(fecha_inicio, fecha_fin):
    """Estado de Audiovisuales (11/10/2026), mismo vocabulario que Pauta Digital:
    INICIO > hoy -> "Programada"; INICIO <= hoy <= FIN -> "Vigente"; FIN < hoy
    -> "Finalizada"; sin ninguna de las dos fechas -> "S/D". Sin Fecha_Inicio
    pero con Fecha_Fin se mantiene la lógica anterior por fin (estado_por_fecha).
    Con Fecha_Inicio <= hoy y sin Fecha_Fin no se infiere nada: "S/D"."""
    inicio_ts = _a_timestamp(fecha_inicio)
    fin_ts = _a_timestamp(fecha_fin)
    if inicio_ts is None and fin_ts is None:
        return "S/D"
    if inicio_ts is None:
        return estado_por_fecha(fin_ts)
    if inicio_ts.date() > HOY:
        return "Programada"
    if fin_ts is None:
        return "S/D"
    return estado_por_fecha(fin_ts)


def calcular_alerta(antiguedad_dias, umbral_amarilla, umbral_roja):
    """🟢/🟡/🔴 según antigüedad en días contra los umbrales de Parametros
    (30/50, confirmados por el gobernador el 31/08/2026). Borde único del
    tablero (spec 11/10/2026): 0-29 🟢, 30-49 🟡, 50+ 🔴, o sea el umbral
    cuenta como parte de la banda superior (>=). Es el mismo borde de la
    planilla de MT ("🟡 hace 30 días", "🔴 hace 50") y de colorFrescura() en
    lib/semaforo.js. Hoy ninguna carga la llama (MT lee Alerta ya calculada de
    la planilla; PD alerta por vencimiento en el front): queda como definición
    de referencia del borde, cubierta por test_pauta_digital.py (caso 14). None si no hay antigüedad calculable -- no se inventa un
    verde por default."""
    if antiguedad_dias is None or umbral_amarilla is None or umbral_roja is None:
        return None
    if antiguedad_dias >= umbral_roja:
        return "🔴"
    if antiguedad_dias >= umbral_amarilla:
        return "🟡"
    return "🟢"


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


# Cortes de banda de cobertura MT (confirmados 11/10/2026): 1-2 Baja, 3-4
# Media, 5+ Alta; 0 = Sin. Única fuente de verdad: se exponen en el JSON
# (`cortes_cobertura`) y el front (grilla, semáforo) NO recalcula bandas, lee
# `banda_cobertura` / `total_tipos` de cada localidad.
CORTES_COBERTURA = {"baja_max": 2, "media_max": 4}


def banda_cobertura(total_tipos):
    if total_tipos <= 0:
        return "Sin"
    if total_tipos <= CORTES_COBERTURA["baja_max"]:
        return "Baja"
    if total_tipos <= CORTES_COBERTURA["media_max"]:
        return "Media"
    return "Alta"


def es_mt_activo(estado):
    """Predicado único de presencia/cobertura MT (spec 11/10/2026, Regla 3,
    ajustado): Estado = Activo, nada más. Lo Inactivo no suma. No exige
    Fecha_Desde: sin fecha de inicio no hay antigüedad que medir (las ALERTAS
    sí piden Activo + Fecha_Desde), pero el tema está en el aire igual. Las
    filas Activas sin ninguna fecha entran a `vigentes` con sin_fecha=True
    (carve-out del 11/10, solo MT); las Inactivas sin fecha se descartan."""
    return (estado or "").strip().lower() == "activo"


def snapshot_anterior_mt(previo, actual):
    """Foto de cobertura MT de la carga ANTERIOR, para mostrar el movimiento
    semana a semana (cards de resumen). La hoja Historico del Excel no trae
    Estado, así que no se puede reconstruir con el mismo predicado de cobertura
    (Estado=Activo); por eso se guarda en cada carga la banda de cada localidad
    y la próxima carga la lee. Si la corrida es del MISMO snapshot (reproceso),
    se conserva la foto anterior que ya traía el JSON. Sin JSON previo o sin
    semanas cargadas -> None (el front oculta el delta, no inventa un 0)."""
    if not previo:
        return None
    semanas_prev = previo.get("semanas_cargadas") or []
    semanas_act = actual.get("semanas_cargadas") or []
    if not semanas_prev or not semanas_act:
        return None
    if semanas_prev[-1] == semanas_act[-1]:
        return previo.get("snapshot_anterior")
    return {
        "fecha": semanas_prev[-1],
        "localidades": {
            l["localidad"]: {"banda": l["banda_cobertura"], "total_tipos": l["total_tipos"]}
            for l in previo["localidades"]
        },
    }


def cargar_medios_tradicionales():
    xls = CONTEXTO / "Medios tradicionales.xlsx"
    cobertura_df = pd.read_excel(xls, sheet_name="Cobertura")
    vigente_df = pd.read_excel(xls, sheet_name="Maestro_Vigente")
    cambios_df = pd.read_excel(xls, sheet_name="Cambios_Ultima_Semana")
    caidos_df = pd.read_excel(xls, sheet_name="Caidos")
    historico_df = pd.read_excel(xls, sheet_name="Historico")
    parametros_df = pd.read_excel(xls, sheet_name="Parametros", header=None)

    # Umbrales de Parametros primero (se necesitan más abajo para leer Alerta
    # tal cual viene, y los reutiliza también Pauta Digital vía main()). Desde
    # el 31/08/2026 la hoja pasó de semanas a días (30/50, confirmados por el
    # gobernador el 31/08/2026) -- formato libre igual que antes (label en
    # columna 1, valor en columna 3).
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

    # Maestro_Vigente cambió de esquema el 31/08/2026: de "una fila por
    # Localidad+Tipo de medio con racha semanal agregada" a "una fila por
    # tema vigente", con Estado/Fecha_Desde/Fecha_Hasta/Antiguedad_Dias/Alerta
    # ya calculados en la planilla -- acá solo se lee y se expone, no se
    # recalcula nada (spec Alertas de vencimiento + Semáforo, 01/09/2026).
    # REDES se descarta: no es un tipo de medio válido de esta área, es dato
    # de Pauta Digital colado por error en la planilla.
    vigentes_por_localidad = {}
    for _, row in vigente_df.iterrows():
        tipo_medio = limpio(row["Tipo_Medio"])
        if tipo_medio == "REDES":
            continue
        # Regla de negocio (Tomás): una fila Inactiva sin Fecha_Desde NI
        # Fecha_Hasta no se tiene en cuenta para nada. Excepción (11/10/2026,
        # solo MT): una fila ACTIVA sin ninguna fecha entra como "presente"
        # (`sin_fecha`: True) y cuenta SOLO para cobertura. Sin fecha no hay
        # antigüedad que medir: alerta/antiguedad_dias quedan en None y las
        # excluyen del semáforo, el mail, Campañas/Gantt y la cronología (ver
        # construir_campanas y lib/semaforo.js). Se listan para el equipo de MT
        # en Contexto/Medios tradicionales - Activos sin fecha.md (dato de
        # calidad: no se parchea).
        fecha_desde = fecha_iso(row["Fecha_Desde"])
        fecha_hasta = fecha_iso(row["Fecha_Hasta"])
        sin_fecha = fecha_desde is None and fecha_hasta is None
        if sin_fecha and not es_mt_activo(limpio(row["Estado"])):
            continue
        clave = (normalizar(row["Departamento"]), normalizar(row["Localidad"]))
        # .strip() acá (no en limpio(), que es genérico para todo el pipeline):
        # la fuente puede traer variantes del mismo tema con \n/espacios finales
        # que si no se normalizan se muestran como si fueran temas distintos.
        # No es un problema hoy en Medios tradicionales.xlsx (verificado: 0 de
        # 895 filas con padding), pero blinda contra la próxima carga.
        tema = limpio(row["Tema"])
        if tema is not None:
            tema = tema.strip()
        vigentes_por_localidad.setdefault(clave, []).append({
            "tipo_medio": tipo_medio,
            "tema": tema,
            "link_material": limpio(row["Link_Material"]),  # string crudo, se mantiene por compatibilidad
            "links_material": lista_links(row["Link_Material"]),  # lista lista para listar en el front
            "estado": limpio(row["Estado"]),  # Activo / Inactivo
            "fecha_desde": fecha_desde,
            "fecha_hasta": fecha_hasta,
            # Ya calculados en la planilla contra los umbrales de Parametros
            # (30/50 días). Quedan en None cuando solo hay Fecha_Hasta (no se
            # inventa un verde por default).
            "antiguedad_dias": None if sin_fecha else limpio(row["Antiguedad_Dias"]),
            "alerta": None if sin_fecha else limpio(row["Alerta"]),
            "sin_fecha": sin_fecha,
        })

    localidades = []
    for _, row in cobertura_df.iterrows():
        clave = (normalizar(row["Departamento"]), normalizar(row["Localidad"]))
        # La cobertura NO se lee de las columnas de la hoja Cobertura (queda
        # solo para listar las 60 localidades): se recalcula desde las filas de
        # Maestro_Vigente que sobreviven al filtro de arriba (REDES y filas
        # sin ninguna fecha quedan fuera) y cumplen es_mt_activo().
        # 1 si queda al menos una fila ACTIVA de ese tipo, 0 si no
        # (es_mt_activo): lo Inactivo no suma.
        vigentes_loc = vigentes_por_localidad.get(clave, [])
        tipos_presentes = {
            v["tipo_medio"] for v in vigentes_loc if es_mt_activo(v["estado"])
        }
        cobertura = {
            clave_json: int(col_original in tipos_presentes)
            for col_original, clave_json in COBERTURA_COLS.items()
        }
        total_tipos = sum(cobertura.values())
        localidades.append({
            "departamento": str(row["Departamento"]).strip(),
            "localidad": str(row["Localidad"]).strip(),
            "cobertura": cobertura,
            "total_tipos": total_tipos,
            "banda_cobertura": banda_cobertura(total_tipos),
            "vigentes": vigentes_loc,
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

    caidos = []
    for _, row in caidos_df.iterrows():
        caidos.append({
            "departamento": limpio(row["Departamento"]),
            "localidad": limpio(row["Localidad"]),
            "tipo_medio": limpio(row["Tipo_Medio"]),
            "ultimo_tema": limpio(row["Ultimo_Tema"]),
            "fecha_ultima_vez": fecha_iso(row["Fecha_Ultima_Vez"]),
        })

    semanas_cargadas = sorted({fecha_iso(f) for f in historico_df["Fecha_Snapshot"].dropna().unique()})

    medios_tradicionales = {
        "semanas_cargadas": semanas_cargadas,
        # Umbrales calculados arriba (se necesitan antes, para descartar REDES
        # no depende de esto, pero Pauta Digital sí los reutiliza vía main()).
        # Desde el 31/08/2026 son días, no semanas (dato ya viene en días
        # reales -- ver calcular_alerta()).
        "umbral_alerta_amarilla_dias": umbral_amarilla,
        "umbral_alerta_roja_dias": umbral_roja,
        "cortes_cobertura": CORTES_COBERTURA,
        "localidades": localidades,
    }
    movimientos_semana = {
        "total_avisos_cambiaron": len(cambios),
        "cambios": cambios,
        "total_caidos": len(caidos),
        "caidos": caidos,
    }
    return medios_tradicionales, movimientos_semana


def cargar_historico_medios():
    """Serie completa semana a semana por localidad + tipo de medio, para la
    línea de tiempo ampliada (el resto del tablero solo usa el estado vigente
    de Maestro_Vigente, que no alcanza para mostrar más de la semana actual)."""
    xls = CONTEXTO / "Medios tradicionales.xlsx"
    historico_df = pd.read_excel(xls, sheet_name="Historico")

    # Misma regla de negocio que en cargar_medios_tradicionales(): una fila sin
    # Fecha_Desde NI Fecha_Hasta no se tiene en cuenta. Los snapshots anteriores
    # al esquema con fechas (31/08/2026; ninguna de sus filas trae fechas) se
    # conservan enteros: aplicarles la regla borraría todo el histórico previo.
    sin_fechas = historico_df["Fecha_Desde"].isna() & historico_df["Fecha_Hasta"].isna()
    snapshots_con_fechas = set(historico_df.loc[~sin_fechas, "Fecha_Snapshot"])
    descartar = sin_fechas & historico_df["Fecha_Snapshot"].isin(snapshots_con_fechas)
    historico_df = historico_df[~descartar]

    por_localidad = {}
    for _, row in historico_df.iterrows():
        clave = (normalizar(row["Departamento"]), normalizar(row["Localidad"]))
        entry = por_localidad.setdefault(clave, {
            "departamento": str(row["Departamento"]).strip(),
            "localidad": str(row["Localidad"]).strip(),
            "series": {},
        })
        tipo_clave = COBERTURA_COLS.get(row["Tipo_Medio"], row["Tipo_Medio"])
        entry["series"].setdefault(tipo_clave, []).append({
            "fecha_snapshot": fecha_iso(row["Fecha_Snapshot"]),
            "tema_campana": limpio(row["Tema_Campaña"]),
            "links_material": lista_links(row["Link_Material"]),
        })

    localidades = list(por_localidad.values())
    for loc in localidades:
        for semanas in loc["series"].values():
            semanas.sort(key=lambda s: s["fecha_snapshot"] or "")

    return {"localidades": localidades}


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


TITULO_SUFIJO_RE = re.compile(r"\s*\([^)]*\)\s*$")
TITULO_PREFIJO_CNP_RE = re.compile(r"^CNP\s+", re.IGNORECASE)


def extraer_titulo_pieza(nombre_anuncio):
    """Deriva un título legible de pieza a partir de "Nombre del anuncio"
    (formato CODIGO - GEO - AREA - CAMPAÑA - segmentación - ADCODE - formato -
    C/D|S/D - objetivo): toma el segmento que sigue al área temática y le
    saca comillas/sufijos de formato ("(Video)", "(Link)") y el prefijo
    genérico "CNP". Validado contra las 1181 filas de Medios Digitales.xlsx:
    0 títulos vacíos/nulos."""
    if not nombre_anuncio or not str(nombre_anuncio).strip():
        return None
    partes = [p.strip() for p in str(nombre_anuncio).split(" - ")]
    if len(partes) < 4:
        segmento = str(nombre_anuncio).strip()
    else:
        segmento = partes[3]  # segmento que sigue al tema (Seguridad, Salud, etc.)

    match = re.search(r'"([^"]+)"', segmento)
    if match:
        antes = segmento[: match.start()].strip()
        entre_comillas = match.group(1).strip()
        if not antes or antes.upper() == "CNP":
            titulo = entre_comillas
        else:
            titulo = f"{antes}: {entre_comillas}"
    else:
        titulo = TITULO_SUFIJO_RE.sub("", segmento).strip()
        titulo = TITULO_PREFIJO_CNP_RE.sub("", titulo).strip()

    return titulo if titulo else str(nombre_anuncio).strip()


ALCANCE_A_TIPO = {
    "LOCALIDAD": "localidad",
    "CAPITAL": "localidad",
    "BARRIO": "localidad",  # Localidad siempre CORDOBA en estas filas
    "DEPARTAMENTO": "departamento",
    "PROVINCIA": "provincia",
}
# REGION, CIRCUITO, CODIGO_AUDIENCIA y OTRO quedan fuera de este mapa a
# propósito -> alcance_tipo=None: no se atribuyen a ninguna Localidad ni
# Departamento (siguen visibles tal cual en la pestaña propia de Pauta
# Digital, con su Alcance_Detectado a la vista).

# Medios Digitales.xlsx (Meta Ads, esquema viejo) se corta acá por Finalización
# —mismo campo que ya se usa para ordenar/filtrar pauta digital en toda la
# app—: lo posterior lo cubre Pauta RRSS_GLOBAL.xlsx, la fuente nueva. Las dos
# planillas se solapan en la ventana 3/7-27/7; para no duplicar, esa ventana
# la gana siempre la fuente nueva.
CORTE_HISTORICO_PAUTA_DIGITAL = "2026-07-02"


# sub_ambito del histórico: la fuente vieja nunca expande una pieza a varias
# localidades, así que el mapeo sale directo de alcance_tipo.
SUB_AMBITO_HISTORICO = {
    "localidad": "localidad_directa",
    "departamento": "departamento",
    "provincia": "multiple_provincia",
    None: "sin_ambito",
}


def clasificar_alcance_historico(alcance_detectado, depto, loc, claves_60):
    """Traduce Alcance_Detectado (+ Departamento/Localidad crudos) a
    (en_60_localidades, alcance_tipo) para una fila del histórico (Medios
    Digitales.xlsx). Única fuente de verdad de esta regla —la usa
    cargar_pauta_digital_historico() y scripts/test_pauta_digital.py— para
    que un test de regresión y la generación real nunca puedan divergir.

    Regla sin excepciones: en_60_localidades es True SOLO si la fila trae una
    Localidad puntual que es una de las 60 oficiales (o si es PROVINCIA, que
    aplica al universo entero por definición). Alcance_Detectado=DEPARTAMENTO
    nunca da en_60_localidades=True, aunque su Departamento tenga localidades
    prioritarias: no hay atribución a Localidad a partir de un dato que solo
    viene acotado a nivel Departamento. alcance_tipo sigue devolviendo
    "departamento" como etiqueta para esas filas (se usa para mostrar el
    ámbito en la pestaña propia de Pauta Digital y en Campañas), pero ya no
    habilita ningún match contra un panel de Localidad.

    Una fila OTRO/REGION/CIRCUITO/CODIGO_AUDIENCIA tampoco se atribuye a una
    Localidad ni Departamento aunque su columna Localidad diga, por texto, el
    nombre de una de las 60 (ej. "CORDOBA" en filas OTRO de barrios sueltos).

    Aparte (no algo que este chequeo cambie, ya se daba antes): una fila
    LOCALIDAD cuya Localidad no es una de las 60 oficiales tampoco entra,
    aunque su Departamento sí tenga localidades prioritarias —hoy 44 filas
    del histórico (Freyre, Miramar, Brinkmann, Chancaní y otras menores). No
    se las reasigna al Departamento: el dato ya viene acotado a una localidad
    puntual que no es una de las 60, así que no corresponde inflar el conteo
    departamental con ellas. Queda anotado acá para que la caída de conteo no
    parezca un misterio."""
    en_60 = False
    if alcance_detectado in ("LOCALIDAD", "CAPITAL", "BARRIO"):
        en_60 = bool(loc) and (normalizar(depto), normalizar(loc)) in claves_60
    elif alcance_detectado == "PROVINCIA":
        en_60 = True  # provincia entera siempre aplica al universo
    return en_60, ALCANCE_A_TIPO.get(alcance_detectado)


def cargar_pauta_digital_historico(claves_60):
    """Fuente vieja (Meta Ads, Ene-Jul). Esquema propio, se mantiene tal cual
    —no se lo fuerza al esquema nuevo— para todo lo anterior al corte."""
    df = pd.read_excel(CONTEXTO / "Medios Digitales.xlsx", sheet_name="Pauta Digital Curada")
    piezas = []
    for _, row in df.iterrows():
        finalizacion = fecha_iso(row["Finalización"])
        if finalizacion and finalizacion > CORTE_HISTORICO_PAUTA_DIGITAL:
            continue  # lo cubre la fuente nueva, evita doble conteo

        parseo = parsear_nombre_anuncio(row["Nombre del anuncio"])
        alcance_detectado = limpio(row["Alcance_Detectado (auditoría)"])
        depto = limpio(row["Departamento"])
        loc = limpio(row["Localidad"])
        en_60, alcance_tipo = clasificar_alcance_historico(alcance_detectado, depto, loc, claves_60)
        estado = estado_por_fecha(row["Finalización"])

        piezas.append({
            "fuente": "historico",
            "codigo_pieza": parseo["codigo_pieza"],
            "nombre_anuncio": limpio(row["Nombre del anuncio"]),
            "titulo_pieza": extraer_titulo_pieza(row["Nombre del anuncio"]),
            "area_tematica": parseo["area_tematica"],
            "campana": parseo["campana"],
            "alcance_detectado": alcance_detectado,
            "alcance_tipo": alcance_tipo,
            "sub_ambito": SUB_AMBITO_HISTORICO.get(alcance_tipo),
            "en_60_localidades": en_60,
            "departamento": depto,
            "localidad": loc,
            "barrio": limpio(row["Barrio"]),
            "circuito_electoral": limpio(row["Circuito_Electoral"]),
            "inicio_informe": fecha_iso(row["Inicio del informe"]),
            "fin_informe": fecha_iso(row["Fin del informe"]),
            "fecha_creacion": fecha_iso(row["Fecha de creación"]),
            "finalizacion": finalizacion,
            "estado": estado,
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
            "links_material": [],
        })
    return piezas


# --- Fuente nueva: Pauta RRSS_GLOBAL.xlsx (desde el 3/7/2026) --------------
#
# Esquema totalmente distinto al histórico: geografía en texto libre
# ("LOCALIDAD, DEPARTAMENTO, PROVINCIA DE CÓRDOBA, ARGENTINA" / "TODAS LAS
# LOCALIDADES" / código de subcircuito de Capital / vacío), CAMPAÑA con
# variantes de mayúsculas/tildes, y hasta 4 columnas que pueden traer el link
# real de cada pieza.

CODIGO_CIRCUITO_RE = re.compile(r"^\d{3,4}[A-Za-z]?\s*-")
ALIAS_LOCALIDAD_PAUTA_GLOBAL = {"CORDOBA CAPITAL": "CORDOBA"}


def _departamento_candidato(depto_raw):
    """'DEPARTAMENTO DE SAN JUSTO, PROVINCIA DE CÓRDOBA, ARGENTINA' -> 'SAN JUSTO'
    'DEPARTAMENTO CAPITAL, ...' -> 'CAPITAL' (algunos deptos no llevan 'DE').
    None si la celda no tiene el prefijo 'DEPARTAMENTO' (ej. 'PROVINCIA DE
    CÓRDOBA, ARGENTINA' sola, que no identifica un departamento puntual)."""
    if depto_raw is None or (isinstance(depto_raw, float) and pd.isna(depto_raw)):
        return None
    primero = str(depto_raw).split(",")[0].strip()
    m = re.match(r"^DEPARTAMENTO\s+(DE\s+)?(.+)$", primero, flags=re.IGNORECASE)
    return m.group(2).strip() if m else None


def clasificar_geografia_pauta_global(
    depto_raw, loc_raw, localidades_60_normalizadas, departamento_a_localidades_normalizadas
):
    """Reglas de clasificación de LOCALIDAD / SUBCIRCUITO, en este orden:
    1) DEPARTAMENTO sin "CÓRDOBA" (ej. Santa Fe, Entre Ríos) -> excluida.
    2) Código de subcircuito de Capital (ej. "010A - CABILDO") -> localidad
       Córdoba (Capital no distingue circuito en este tablero).
    3) "TODAS LAS LOCALIDADES" con un DEPARTAMENTO puntual (ej. "DEPARTAMENTO
       RIO CUARTO, PROVINCIA DE CÓRDOBA, ARGENTINA") -> ámbito
       "localidad_multiple": la pieza no es de alcance provincial, es ese
       Departamento entero -> se resuelve a la lista de sus localidades
       dentro de las 60 (Localidades(1).xlsx) y el caller genera una fila de
       salida por cada una, con las métricas completas (sin dividir) en
       todas. Si el Departamento no tiene ninguna de las 60 -> no hay nada
       que expandir, cae al mismo fallback que el punto 4 (ámbito
       departamento, sin crear Localidad nueva).
       "TODAS LAS LOCALIDADES" SIN un Departamento puntual (DEPARTAMENTO =
       "PROVINCIA DE CÓRDOBA, ARGENTINA", la provincia entera) -> mismo
       patrón que el caso anterior pero con las 60 localidades completas
       (no hay un Departamento puntual contra el cual acotar): también
       ámbito "localidad_multiple", con las métricas completas replicadas
       en las 60, sin prorratear.
    4) "X, DEPARTAMENTO, PROVINCIA..." -> candidata = texto antes de la
       primera coma; si matchea una de las 60 -> ámbito localidad; si no
       -> fallback a ámbito departamento (NO se crea localidad nueva; sirve
       solo como etiqueta para la pestaña propia de Pauta Digital y Campañas,
       nunca atribuye la pieza a ningún panel de Localidad).
    5) Vacío (sin Localidad puntual) -> ámbito=None, sin excepciones. Regla
       fija del proyecto: una pieza se atribuye a una Localidad SOLO si su
       Localidad puntual es una de las 60 — ya no hay fallback a Departamento
       acá (antes lo había; se sacó a propósito).
    Cada resultado trae además `sub_ambito` (D2 de la spec de cobertura del
    11/10/2026): localidad_directa | circuito_capital | multiple_depto |
    multiple_provincia | departamento | sin_ambito. Distingue la pieza dirigida a
    una localidad de la expandida desde "provincia entera", que `ambito`
    colapsa en "localidad". Solo los tres primeros + multiple_depto cuentan
    como cobertura de una localidad; multiple_provincia, departamento y
    sin_ambito no.
    Devuelve localidad/departamento en forma NORMALIZADA (sin tildes,
    mayúscula) — el caller la resuelve a la forma oficial de Localidades(1).
    """
    if "CORDOBA" not in normalizar(depto_raw):
        return {"excluida": True}

    depto_candidato = _departamento_candidato(depto_raw)
    loc_str = None if (loc_raw is None or (isinstance(loc_raw, float) and pd.isna(loc_raw))) else str(loc_raw).strip()

    if loc_str and CODIGO_CIRCUITO_RE.match(loc_str):
        return {
            "excluida": False, "ambito": "localidad", "localidad": "CORDOBA",
            "departamento": None, "circuito_codigo_original": loc_str,
            "sub_ambito": "circuito_capital",
        }

    if loc_str == "TODAS LAS LOCALIDADES":
        if depto_candidato:
            localidades_del_depto = departamento_a_localidades_normalizadas.get(normalizar(depto_candidato), [])
            if localidades_del_depto:
                return {
                    "excluida": False, "ambito": "localidad_multiple",
                    "localidades": localidades_del_depto, "departamento": None,
                    "sub_ambito": "multiple_depto",
                }
            return {
                "excluida": False, "ambito": "departamento", "localidad": None,
                "departamento": depto_candidato, "sub_ambito": "departamento",
            }
        return {
            "excluida": False, "ambito": "localidad_multiple",
            "localidades": sorted(localidades_60_normalizadas), "departamento": None,
            "sub_ambito": "multiple_provincia",
        }

    if loc_str:
        candidata = loc_str.split(",")[0].strip()
        n_candidata = normalizar(candidata)
        n_candidata = ALIAS_LOCALIDAD_PAUTA_GLOBAL.get(n_candidata, n_candidata)
        if n_candidata in localidades_60_normalizadas:
            return {
                "excluida": False, "ambito": "localidad", "localidad": n_candidata,
                "departamento": None, "sub_ambito": "localidad_directa",
            }
        # Existe pero no es una de las 60 -> fallback a Departamento, regla
        # fija del proyecto: nunca se crea una localidad nueva.
        return {
            "excluida": False, "ambito": "departamento", "localidad": None,
            "departamento": depto_candidato, "sub_ambito": "departamento",
        }

    # Sin Localidad puntual (loc_str vacío): ya no hay fallback a
    # Departamento. Regla sin excepciones: ámbito=None, la pieza no se
    # atribuye a ninguna Localidad.
    return {"excluida": False, "ambito": None, "localidad": None, "departamento": None, "sub_ambito": "sin_ambito"}


def elegir_forma_canonica(variantes):
    """variantes: lista de (texto_crudo, cantidad_de_apariciones), todos el
    mismo valor salvo mayúsculas/tildes (ya agrupados por su forma
    normalizada). Prioridad: 1) que tenga alguna minúscula —señal de que se
    tipeó bien, no en caps lock—; 2) más apariciones; 3) orden alfabético
    como desempate final y determinístico (ej. "MAMÓGRAFO APROSS" vs typo
    "MAMÓGRAFÓ APROSS", empatadas en mayúscula y cantidad: gana la primera
    en orden de código, que acá es la bien escrita)."""
    def clave(v):
        texto, cantidad = v
        todo_mayuscula = texto == texto.upper()
        return (todo_mayuscula, -cantidad, texto)
    return sorted(variantes, key=clave)[0][0]


def construir_mapa_formas_canonicas(serie):
    """Agrupa los valores de una columna por su forma normalizada (sin
    tildes/mayúscula) y elige una forma canónica por grupo — usado para
    CAMPAÑA, PLATAFORMA y TIPO DE PAUTA, que traen las mismas variantes de
    mayúsculas/tildes para un mismo valor (ej. "Meta"/"META", "Dark
    Post"/"DARK POST")."""
    grupos = {}
    for texto, cantidad in serie.dropna().value_counts().items():
        grupos.setdefault(normalizar(texto), []).append((texto, cantidad))
    return {clave: elegir_forma_canonica(variantes) for clave, variantes in grupos.items()}


def _forma_canonica(mapa, valor_crudo):
    return mapa.get(normalizar(valor_crudo), valor_crudo) if valor_crudo else valor_crudo


def limpiar_link(v):
    """None si la celda es '-'/vacía o no contiene 'http' (Tarea 4: LINK
    MATERIAL/IG/FB/YT pueden traer texto que no es un link real, o nada)."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    if s in ("", "-") or "http" not in s.lower():
        return None
    return s


def _asignaciones_geograficas(geo, localidad_a_oficial, localidad_a_departamento_oficial, deptos_a_oficial):
    """Traduce un `geo` de clasificar_geografia_pauta_global() a la lista de
    asignaciones (Localidad, Departamento) en forma OFICIAL que la fila de
    Pauta RRSS_GLOBAL debe producir. Normalmente es una sola asignación (una
    fila fuente = una pieza); para ambito="localidad_multiple" ("TODAS LAS
    LOCALIDADES" + un Departamento puntual, ver clasificar_geografia_pauta_global)
    es una asignación POR CADA Localidad de las 60 que cae en ese
    Departamento — de ahí sale la fila de salida por Localidad que pide el
    proyecto, con localidad_asignada seteada explícitamente (no re-derivada
    por texto: viene directo de Localidades(1).xlsx, no de un nuevo match de
    string)."""
    if geo["ambito"] == "localidad":
        localidad = localidad_a_oficial[geo["localidad"]]
        departamento = localidad_a_departamento_oficial[geo["localidad"]]
        return [{"localidad": localidad, "departamento": departamento, "localidad_asignada": localidad}]
    if geo["ambito"] == "localidad_multiple":
        asignaciones = []
        for n_loc in geo["localidades"]:
            localidad = localidad_a_oficial[n_loc]
            asignaciones.append({
                "localidad": localidad,
                "departamento": localidad_a_departamento_oficial[n_loc],
                "localidad_asignada": localidad,
            })
        return asignaciones
    if geo["ambito"] == "departamento":
        departamento = deptos_a_oficial.get(normalizar(geo["departamento"]), geo["departamento"])
        return [{"localidad": None, "departamento": departamento, "localidad_asignada": None}]
    return [{"localidad": None, "departamento": None, "localidad_asignada": None}]


def _fila_real_pauta_global(row):
    """Una fila de GLOBAL_ImportRange cuenta como dato real solo si CAMPAÑA o
    TITULO DE LA PIEZA no están vacíos. Sin excepciones ni rango fijo: se
    aplica fila por fila sobre toda la hoja."""
    return limpio(row["CAMPAÑA"]) is not None or limpio(row["TITULO DE LA PIEZA"]) is not None


def _gana_pieza(candidata, actual):
    """True si `candidata` debe reemplazar a `actual` como ganadora de su
    clave de dedup. Orden de criterios (confirmado 06/09/2026, reemplaza al
    criterio viejo de "se queda la primera vista"):
    1) FECHA DE ENVÍO más reciente gana. None cuenta como la más vieja
       posible (pierde contra cualquier fecha real).
    2) Si empatan en fecha (incluido el caso de ambas None), gana la que
       tenga ESTADO=ACTIVO en el excel crudo, contra cualquier otro valor.
    3) Si siguen empatadas, se queda `actual` (la primera vista en orden de
       aparición) -- desempate determinístico, no se reemplaza.

    Usa .get() con default: piezas sintéticas de test que no seteen estas
    claves internas (ej. CASO 9 de test_pauta_digital.py) valen como
    fecha=None/estado_activo=False, así no cambia el desempate 3 para ellas."""
    ts_candidata = candidata.get("_dedup_fecha_envio_ts")
    ts_actual = actual.get("_dedup_fecha_envio_ts")
    if ts_candidata != ts_actual:
        if ts_actual is None:
            return True
        if ts_candidata is None:
            return False
        return ts_candidata > ts_actual
    if candidata.get("_dedup_estado_activo", False) != actual.get("_dedup_estado_activo", False):
        return candidata.get("_dedup_estado_activo", False)
    return False


def _dedup_pauta_global_por_cod_contenido(piezas):
    """Corre DESPUÉS de expandir "TODAS LAS LOCALIDADES" + Departamento en una
    fila por Localidad (nunca antes: antes de expandir no existen todavía los
    localidad_asignada por los que se agrupa acá). Si dos piezas comparten
    COD. CONTENIDO Y la misma clave (Campaña, Título, localidad_asignada), son
    la misma pieza contada dos veces para esa Localidad —típicamente porque
    además de su fila "TODAS LAS LOCALIDADES"+Departamento (que ya la expande
    a esa Localidad) esa pieza también tiene una fila propia apuntando
    directo a esa misma Localidad— y se descarta la repetición para no
    duplicar métricas ahí. COD. CONTENIDO por sí solo NO alcanza como clave:
    se reutiliza entre piezas distintas (mismo código, Campaña/Título
    distintos) en los datos reales, así que sin el resto de la clave se
    fusionarían piezas que no son la misma. Piezas sin COD. CONTENIDO (None)
    nunca se descartan acá: no hay con qué agruparlas de forma confiable.

    Entre las filas que comparten clave, la ganadora se elige con
    _gana_pieza() (ver ahí el criterio: FECHA DE ENVÍO más reciente, tiebreak
    ESTADO=ACTIVO, tiebreak final la primera en orden de aparición) --
    criterio confirmado 06/09/2026, reemplaza al anterior de "se queda la
    primera vista sin mirar fecha ni estado"."""
    ganadoras = {}
    orden = []
    sin_cod = []
    descartadas = 0
    for pieza in piezas:
        cod = pieza.get("cod_contenido")
        if cod is None:
            sin_cod.append(pieza)
            continue
        clave = (cod, pieza["campana"], pieza["titulo_pieza"], pieza["localidad_asignada"])
        if clave not in ganadoras:
            ganadoras[clave] = pieza
            orden.append(clave)
            continue
        descartadas += 1
        if _gana_pieza(pieza, ganadoras[clave]):
            ganadoras[clave] = pieza

    resultado = sin_cod + [ganadoras[clave] for clave in orden]
    for pieza in resultado:
        pieza.pop("_dedup_fecha_envio_ts", None)
        pieza.pop("_dedup_estado_activo", None)
    return resultado, descartadas


def cargar_pauta_digital_global(
    localidad_a_oficial, localidad_a_departamento_oficial, deptos_a_oficial, departamento_a_localidades_normalizadas,
):
    """Fuente nueva, reemplaza a Medios Digitales.xlsx de acá en adelante
    (desde el 3/7/2026). No se fuerza al esquema del histórico —Planificado/
    Ejecutado quedan separados por plataforma (Meta/Google), ver Tarea 5."""
    df_crudo = pd.read_excel(CONTEXTO / "Pauta RRSS_GLOBAL.xlsx", sheet_name="GLOBAL_ImportRange")
    mascara_real = df_crudo.apply(_fila_real_pauta_global, axis=1)
    df = df_crudo[mascara_real].reset_index(drop=True)
    metricas = {
        "filas_totales": len(df_crudo),
        "filas_descartadas": len(df_crudo) - len(df),
        "filas_reales": len(df),
        # A nivel de fila real (antes de excluir por fuera de provincia o
        # expandir geografía) -- consistente con "Códigos únicos con COD.
        # CONTENIDO" más abajo, que también se cuenta sobre df completo.
        "filas_con_cod_contenido": int(df["COD. CONTENIDO"].apply(lambda v: limpio(v) is not None).sum()),
    }

    localidades_60_normalizadas = set(localidad_a_oficial.keys())
    mapa_campanas = construir_mapa_formas_canonicas(df["CAMPAÑA"])
    mapa_plataformas = construir_mapa_formas_canonicas(df["PLATAFORMA"])
    mapa_tipos_pauta = construir_mapa_formas_canonicas(df["TIPO DE PAUTA"])

    piezas = []
    excluidas = 0
    for _, row in df.iterrows():
        geo = clasificar_geografia_pauta_global(
            row["DEPARTAMENTO"], row["LOCALIDAD / SUBCIRCUITO"],
            localidades_60_normalizadas, departamento_a_localidades_normalizadas,
        )
        if geo["excluida"]:
            excluidas += 1
            continue

        asignaciones = _asignaciones_geograficas(
            geo, localidad_a_oficial, localidad_a_departamento_oficial, deptos_a_oficial
        )
        # ambito="localidad_multiple" es el único caso con más de una
        # asignación: todas las demás (localidad / departamento / None)
        # siguen siendo, como antes, una sola pieza por fila fuente.
        ambito_pieza = "localidad" if geo["ambito"] == "localidad_multiple" else geo["ambito"]
        cod_contenido = limpio(row["COD. CONTENIDO"])
        fecha_envio = fecha_iso(row["FECHA DE ENVÍO"])
        # Timestamp completo (no solo la fecha) y ESTADO crudo, usados
        # únicamente por _dedup_pauta_global_por_cod_contenido() para elegir
        # entre filas duplicadas -- ver ese criterio ahí. Se descartan del
        # dict antes de devolver la pieza final (no forman parte del esquema
        # de salida ni de campanas.json).
        _dedup_fecha_envio_ts = _a_timestamp(row["FECHA DE ENVÍO"])
        _dedup_estado_activo = normalizar(limpio(row["ESTADO"])) == "ACTIVO"

        link_material = limpiar_link(row["LINK MATERIAL"])
        link_ig = limpiar_link(row["IG"])
        link_fb = limpiar_link(row["FB"])
        link_yt = limpiar_link(row["YT"])
        # Columna nueva del export (carga del 06/09/2026): landing page con
        # UTMs a la que apunta la pauta -- distinta de LINK MATERIAL (el
        # Drive con la pieza creativa). Campo separado, mismo patrón que
        # IG/FB/YT: no se mezcla con link_material/links_material.
        # UTM´S como fallback de URL: las dos columnas traen el link real en
        # forma mutuamente excluyente (0 filas con las dos a la vez). Con el
        # export vigente (4.009 filas reales, verificado 14/10/2026): 1.514
        # lo traen en URL, 82 solo en UTM´S (que para esas filas SÍ es un link
        # real a pesar del nombre de la columna) y 2.413 en ninguna. Las 6
        # filas donde URL trae texto sin http ("---") no tienen link en UTM´S
        # tampoco. Sin este fallback quedarían 82 links reales sin capturar.
        link_destino = limpiar_link(row["URL"]) or limpiar_link(row["UTM´S"])

        campana = _forma_canonica(mapa_campanas, limpio(row["CAMPAÑA"]))
        plataforma = _forma_canonica(mapa_plataformas, limpio(row["PLATAFORMA"]))
        tipo_pauta = _forma_canonica(mapa_tipos_pauta, limpio(row["TIPO DE PAUTA"]))

        # ESTADO expuesto en el tablero: se toma DIRECTO de la columna ESTADO
        # del crudo (regla de negocio 24/09/2026, reemplaza al cálculo viejo
        # por fecha INICIO/FIN -- ver estado_pauta_digital_desde_crudo()).
        # INICIO/FIN se toman siempre de las columnas AA/AB ("INICIO "/"FIN"),
        # sin fallback a FIN INFORMADO. La alerta de PD ya no se calcula acá:
        # es por vencimiento y se resuelve en el front (lib/semaforo.js,
        # colorVencimientoPD / esPiezaPDViva), a partir de `estado`, `inicio`
        # y `finalizacion` evaluados contra la fecha de hoy.
        inicio_ts = _a_timestamp(row["INICIO "])
        fin_ts = _a_timestamp(row["FIN"])
        estado_pieza = estado_pauta_digital_desde_crudo(row["ESTADO"])
        # Campo informativo congelado a la fecha de generación: True si
        # INICIO <= hoy <= FIN (ambas fechas de las columnas AA/AB, sin
        # fallback a INICIO/FIN INFORMADO). Hoy NO lo lee ningún consumidor
        # (ni el front ni el mail): ambos evalúan esPiezaPDViva(p, hoyIso)
        # (lib/semaforo.js) contra la fecha de hoy, porque este valor queda
        # viejo apenas pasa un día. Se conserva en el JSON (agregado
        # 25/09/2026).
        vigente_por_fecha = (
            inicio_ts is not None and fin_ts is not None
            and inicio_ts.date() <= HOY <= fin_ts.date()
        )

        for asignacion in asignaciones:
            piezas.append({
                "fuente": "global",
                "_dedup_fecha_envio_ts": _dedup_fecha_envio_ts,
                "_dedup_estado_activo": _dedup_estado_activo,
                "codigo_pieza": None,
                "cod_contenido": cod_contenido,
                "nombre_anuncio": limpio(row["TITULO DE LA PIEZA"]),
                "titulo_pieza": limpio(row["TITULO DE LA PIEZA"]),
                "area_tematica": limpio(row["EJE"]),
                "ministerio": limpio(row["MINISTERIO"]),
                "campana": campana,
                "alcance_detectado": {"localidad": "LOCALIDAD", "departamento": "DEPARTAMENTO", "provincia": "PROVINCIA"}.get(ambito_pieza),
                "alcance_tipo": ambito_pieza,
                "sub_ambito": geo["sub_ambito"],
                # Regla sin excepciones (igual que clasificar_alcance_historico() para la
                # fuente vieja): en_60_localidades es True SOLO si la pieza tiene una
                # Localidad puntual de las 60 (ambito=localidad, incluye las expandidas
                # desde "TODAS LAS LOCALIDADES"+Departamento) o es de alcance provincial
                # (ambito=provincia, aplica al universo entero por definición). ambito=
                # departamento NO cuenta como "en las 60 localidades" —el dato ya viene
                # acotado a un Departamento, sin Localidad puntual, así que no se atribuye
                # a ninguna Localidad— y ambito=None tampoco.
                "en_60_localidades": ambito_pieza in ("localidad", "provincia"),
                "departamento": asignacion["departamento"],
                "localidad": asignacion["localidad"],
                # Explícita para las piezas expandidas por Departamento (y, por
                # consistencia de esquema, también para el resto): NO se re-deriva
                # por texto en ningún punto posterior (construir_campanas() y el
                # dedup de más abajo la toman tal cual). None si la pieza no tiene
                # Localidad puntual (ambito departamento/provincia/None).
                "localidad_asignada": asignacion["localidad_asignada"],
                "circuito_codigo_original": geo.get("circuito_codigo_original"),
                "barrio": None,
                "circuito_electoral": None,
                "plataforma": plataforma,
                "tipo_pauta": tipo_pauta,
                "origen": limpio(row["ORIGEN"]),
                "proveedor": limpio(row["PROVEEDOR"]),
                "inicio": fecha_iso(row["INICIO "]),
                "inicio_informe": None,
                "fin_informe": None,
                "fecha_creacion": fecha_envio,
                "finalizacion": fecha_iso(fin_ts),
                # Ver estado_pauta_digital_desde_crudo(): viene directo de la
                # columna ESTADO del crudo, no se deriva de FIN/FIN INFORMADO.
                "estado": estado_pieza,
                "vigente_por_fecha": vigente_por_fecha,
                "alcance": None,
                "frecuencia": None,
                "impresiones": None,
                "visualizaciones": None,
                "cpm": None,
                "cobertura_planificada_meta": limpio(row["Cobertura Planificada META"]),
                "cobertura_ejecutada_meta": limpio(row["Cobertura Ejecutada META"]),
                "impresiones_planificada_meta": limpio(row["Impresiones Planificada META"]),
                "impresiones_ejecutada_meta": limpio(row["Impresiones Ejecutada META"]),
                "frecuencia_planificada_meta": limpio(row["Frecuencia (Meta) Planificada"]),
                "frecuencia_ejecutada_meta": limpio(row["Frecuencia (Meta) Ejecutada"]),
                "cpm_planificada_meta": limpio(row["CPM Planificada META"]),
                "cpm_real_meta": limpio(row["CPM Real META"]),
                # La columna se llamaba "Visualizaciones Planificadas GOOGLE"; el
                # export del 31/08/2026 la renombró a "Visualizaciones Planificadas "
                # (perdió el sufijo GOOGLE, quedó con espacio final) al sumar nuevas
                # columnas de métricas de Google (Impresiones/CPM/Vistas GOOGLE, etc.)
                # que todavía no se mapean a ningún campo del JSON -- ver prompt del 31/08.
                "visualizaciones_planificadas_google": limpio(row["Visualizaciones Planificadas "]),
                "visualizaciones_ejecutadas_google": limpio(row["Visualizaciones Ejecutadas GOOGLE"]),
                "cpv_planificada_google": limpio(row["CPV Planificada GOOGLE"]),
                "cpv_real_google": limpio(row["CPV Real GOOGLE"]),
                "importe_gastado": None,
                "inversion_planificada": limpio(row["Inversión planificada "]),
                "inversion_ejecutada": limpio(row["Inversión ejecutada "]),
                "presupuesto": None,
                "tipo_presupuesto": None,
                "clics": None,
                "ctr": None,
                "link_material": link_material,
                "link_ig": link_ig,
                "link_fb": link_fb,
                "link_yt": link_yt,
                "link_destino": link_destino,
                "links_material": [l for l in (link_material, link_ig, link_fb, link_yt) if l],
            })

    piezas, descartadas_dedup = _dedup_pauta_global_por_cod_contenido(piezas)
    metricas["codigos_unicos_con_cod_contenido"] = int(
        df[df["COD. CONTENIDO"].apply(lambda v: limpio(v) is not None)]["COD. CONTENIDO"].nunique()
    )
    metricas["filas_colapsadas_por_dedup"] = descartadas_dedup
    return piezas, excluidas, descartadas_dedup, metricas


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
            "estado": estado_audiovisual(row["Fecha_Inicio"], row["Fecha_Fin"]),
            "link": limpio(row["Link"]),  # string crudo, se mantiene por compatibilidad
            "links": lista_links(row["Link"]),  # lista lista para listar en el front (por si trae más de uno)
            "copy": limpio(row["Copy"]),
            "sugerencias_pauta": limpio(row["Sugerencias_Pauta"]),
            "notas": limpio(row["Notas"]),
        })
    return {"items": items}


# ---------------------------------------------------------------------------
# 5. SMS
# ---------------------------------------------------------------------------
#
# A diferencia de Medios tradicionales (append-only semanal), el export de SMS
# llega completo y acumulado cada vez -> cada corrida REEMPLAZA el archivo
# anterior y recalcula todo desde cero (mismo patrón que Pauta digital). Ver
# sección 3.4 de CONTEXTO_PROYECTO_TABLERO_COMUNICACION.md para el detalle de
# estas reglas.
#
# Cambio de regla del 22/08/2026: ya no existe ningún alcance de tipo
# "departamento" -> mismo criterio que ya rige en Pauta Digital (desde el
# 20/08/2026) y Contenido Orgánico. Un token de AUDIENCIA (o ZONA=CAPITAL, o
# AUDIENCIA="DEPTO COMPLETO") o resuelve exacto a una de las 60 localidades
# prioritarias, o no genera ningún alcance -> no hay término medio.

FUZZY_CUTOFF_SMS = 0.7  # rango acordado 0.7-0.8; 0.7 para tolerar sufijos oficiales
                        # tipo "NOMBRE - IFFLINGER" que el token de AUDIENCIA no siempre trae

ZONAS_CAPITAL_SMS = {"CAPITAL", "CORDOBA", "CAPITAL + PROVINCIA", "CAPITAL+PROVINCIA"}
ZONA_PROVINCIA_SMS = "PROVINCIA"
AUDIENCIA_DEPTO_COMPLETO_SMS = "DEPTO COMPLETO"
AUDIENCIA_CAPITAL_SUELTO_SMS = "CAPITAL"
LOCALIDAD_CAPITAL_SMS = "CORDOBA"  # nombre oficial de la localidad Capital, una de las 60 (ver Localidades (1).xlsx)

# Excepciones de matching de AUDIENCIA ya resueltas a mano (tabla acordada con
# el usuario). Cada valor es una lista de ("localidad", nombre) | ("excluir", None):
#   - "localidad": se resuelve contra las 60 localidades prioritarias -> exacto
#     primero, fuzzy como fallback (ver _resolver_nombre_localidad). Si no
#     matchea ninguna de las 60 (ni exacto ni fuzzy) no genera ningún alcance
#     -> se loguea en excepciones_sin_resolver, no se inventa nada.
#   - "excluir": el token queda AFUERA DEL UNIVERSO del tablero a propósito ->
#     no genera ningún alcance. Dos motivos posibles: (a) es un barrio (ej.
#     "B° LA FLORESTA": los barrios van a otro proyecto aparte) o (b) es un
#     lugar real, confirmado contra el Nomenclador Maestro, que NO es una de
#     las 60 (ej. TANINGA, LOS GIGANTES, CERRO BLANCO, CANALS). Desde el
#     cambio de regla del 22/08/2026 (ya no existe ningún alcance de tipo
#     "departamento" en SMS -mismo criterio que Pauta Digital y Contenido
#     Orgánico-) ambos motivos terminan en el mismo resultado: sin alcance.
#     Se deja hardcodeado en vez de dejar que la resolución "localidad"
#     normal fracase sola, para no depender del fuzzy sobre estos nombres ya
#     confirmados en cada corrida (mismo riesgo de falso positivo que ya se
#     vio real el 22/08/2026: "LOS GIGANTES" fuzzy-matcheaba a "LOS CISNES",
#     un lugar real pero sin ninguna relación, en otro departamento).
_EXCEPCIONES_AUDIENCIA_SMS_RAW = {
    "CARLOS PAZ": [("localidad", "VILLA CARLOS PAZ")],
    "TOTORAL": [("localidad", "VILLA DEL TOTORAL")],
    "VILLA CIUDAD PARQUE": [("excluir", None)],  # VILLA CIUDAD PARQUE LOS REARTES no es una de las 60
    "LOS REARTES": [("excluir", None)],  # mismo lugar que VILLA CIUDAD PARQUE (LOS REARTES), variante corta -> confirmado 22/08/2026
    "LA CARLOTA LABOULAYE CANALS": [
        ("localidad", "LA CARLOTA"), ("localidad", "LABOULAYE"), ("excluir", None),  # CANALS no es una de las 60
    ],
    "TANINGA": [("excluir", None)],
    "LOS GIGANTES": [("excluir", None)],
    "CERRO BLANCO": [("excluir", None)],
    "CORRAL DE BUSTOS": [("excluir", None)],  # CORRAL DE BUSTOS - IFFLINGER no es una de las 60
    "B° LA FLORESTA": [("excluir", None)],
    # Confirmadas a mano el 22/08/2026 a partir de fuzzy_aplicados de la
    # primera corrida real -> ninguna es una de las 60 (confirmado contra el
    # Nomenclador Maestro real), así que quedan "excluir" directo.
    "VILLA SARMIENTO": [("excluir", None)],  # VILLA SARMIENTO (M) no es una de las 60
    "MONTEBUEY": [("excluir", None)],  # MONTE BUEY no es una de las 60
    "MONTE BUEY": [("excluir", None)],  # mismo lugar, variante con espacio -> confirmado 22/08/2026
    "CAPITÁN GENERAL BERNARDO O’HIGGINS": [("excluir", None)],  # no es una de las 60
    "CURA BROCHERO": [("localidad", "VILLA CURA BROCHERO")],
    "ARROYO LOS PATOS": [("excluir", None)],  # ARROYO DE LOS PATOS no es una de las 60
    "HUANCHILA": [("excluir", None)],  # HUANCHILLA no es una de las 60
    "HIGUERAS": [("excluir", None)],  # LAS HIGUERAS no es una de las 60
    # Confirmadas a mano el 31/08/2026 a partir de fuzzy_aplicados de la
    # corrida con el export del 20/08/2026 -> ninguna es una de las 60 (el
    # usuario verificó geografía real de cada una), el fuzzy (cutoff 0.7) las
    # estaba confundiendo con otra localidad real pero sin relación. LA
    # CESIRA ya venía de una corrida anterior sin resolver; se confirma acá
    # también.
    "LA CESIRA": [("excluir", None)],  # fuzzy-matcheaba a LA CALERA, sin relación real
    "VILLA VALERIA": [("excluir", None)],  # depto. General Roca, a 420km de Cba capital; fuzzy-matcheaba a VILLA MARIA
    "GENERAL ROCA": [("excluir", None)],  # depto. Marcos Juárez; fuzzy-matcheaba a GENERAL CABRERA
    "VILLA DE SOTO": [("excluir", None)],  # depto. Cruz del Eje, no es una de las 60; fuzzy-matcheaba a VILLA DEL TOTORAL
    "VILLA DEL PRADO": [("excluir", None)],  # depto. Santa María, cerca de Alta Gracia; fuzzy-matcheaba a VILLA DEL TOTORAL
    "ANISACATE": [("excluir", None)],  # depto. Santa María; fuzzy-matcheaba a SALSACATE (depto. Pocho)
    "VILLA LA BOLSA": [("excluir", None)],  # depto. Santa María; fuzzy-matcheaba a VILLA DEL ROSARIO (depto. Río Segundo)
    "COLONIA TIROLESA": [("excluir", None)],  # localidad real distinta, vecina de Colonia Caroya; fuzzy-matcheaba a COLONIA CAROYA
    "SINSACATE": [("excluir", None)],  # depto. Totoral; fuzzy-matcheaba a SALSACATE (depto. Pocho)
    "VILLA ELISA": [("excluir", None)],  # sin relación real; fuzzy-matcheaba a VILLA NUEVA
}
# Normalizado una sola vez al importar el módulo (evita tener que escribir a
# mano la forma normalizada -sin tildes/°/mayúscula- de cada clave arriba).
EXCEPCIONES_AUDIENCIA_SMS = {normalizar(k): v for k, v in _EXCEPCIONES_AUDIENCIA_SMS_RAW.items()}

# Tokens de AUDIENCIA revisados y confirmados a mano por el usuario (ronda del
# 22/08/2026) que NO son ninguna de las 60 ni deben generar ningún alcance —
# ya se comportan bien por default (_resolver_token_audiencia devuelve None
# -> sin alcance, la fila no aporta nada geográfico). Esta lista NO agrega
# ninguna resolución nueva: solo sirve para FILTRAR el log de
# no_identificados. Sin este filtro, como el export es un acumulado completo
# (se reprocesa entero en cada corrida), estos mismos 57 tokens reaparecerían
# siempre mezclados con lo que sea genuinamente nuevo, y el log perdería
# utilidad para saber qué hace falta clasificar de verdad.
#
# Una parte son segmentos de AUDIENCIA no geográficos (bases de datos,
# archivos .xlsx colados, rangos etarios, "X interior"); el resto son
# localidades reales de la provincia que no están entre las 60 (confirmado
# contra Localidades_1.xlsx, ninguna aparece ahí). 57 tokens en total (56
# confirmados el 22/08/2026 + CHUÑA sumada el 31/08/2026).
_TOKENS_CONFIRMADOS_SIN_LUGAR_SMS_RAW = [
    # No geográficos
    "18-40", "2. AGENTES PROVINCIA.xlsx", "4. PENITENCIARIOS PROVINCIA.xlsx",
    "6. CABOS PROVINCIA.xlsx", "8. OFICIALES PROVINCIA.xlsx", "Agentes interior",
    "BASE DE DATOS", "BASE DE DATOS DE AGENTES PROVINCIALES",
    "BASE DE DATOS DE CABOS PROVINCIA", "BASE DE DATOS DE OFICIALES PROVINCIA",
    "BASE DE DATOS DE PENITENCIARIOS PROVINCIA", "Cabos interior",
    "Oficiales interior", "Penitenciarios interior", "Números particulares",
    # Localidades reales, no una de las 60
    "ARIAS", "BENGOLEA", "BULNES", "CAVANAGH", "CHARRAS", "COLONIA ITALIANA",
    "CONLARA", "CRUZ DE CAÑA", "DEL CAMPILLO", "EL RASTREADOR",
    "ESTACIÓN GENERAL PAZ", "FALDA DEL CARMEN", "FREYRE", "HUINCA RENANCÓ",
    "ITALO", "LA HIGUERA", "LA PAZ", "LA POBLACION", "LOS CEDROS",
    "LOS HORNILLOS", "LUYABA", "MELO", "MI GRANJA", "MONTE DE LOS GAUCHOS",
    "NONO", "OLAETA", "PACHECO DE MELO", "PANAHOLMA", "PASO VIEJO", "PINCÉN",
    "RANQUELES", "SALADILLO", "SAN JAVIER Y YACANTO", "SAN JOSE DE LA DORMIDA",
    "SAN LORENZO", "TALA CAÑADA", "TANTI", "TICINO", "TINOCO", "UCACHA",
    "VILLA PARQUE SANTA ANA",
    "CHUÑA",  # depto. Ischilín, confirmado 31/08/2026 -> no es una de las 60
]
TOKENS_CONFIRMADOS_SIN_LUGAR_SMS = {normalizar(t) for t in _TOKENS_CONFIRMADOS_SIN_LUGAR_SMS_RAW}


def _token_confirmado_sin_lugar(token):
    """True si este token de AUDIENCIA ya fue revisado a mano y confirmado
    como "no es ninguna de las 60, no genera alcance" -> se usa solo para
    filtrar el log de no_identificados, nunca para resolver un alcance (la
    resolución real sigue siendo la del camino genérico: None)."""
    return normalizar(token) in TOKENS_CONFIRMADOS_SIN_LUGAR_SMS


PARENTESIS_RE = re.compile(r"\([^)]*\)")


def _col(df, nombre_normalizado):
    """Busca una columna por nombre normalizado (mayúscula, sin tildes, sin
    saltos de línea ni espacios de más) -> tolera headers de Excel con salto
    de línea embebido (ej. 'AUDIENCIA\\n(LOCALIDADES O BARRIOS)') sin tener
    que hardcodear el \\n exacto. Falla fuerte (KeyError) si no aparece -
    mejor eso que leer silenciosamente la columna equivocada."""
    objetivo = normalizar(nombre_normalizado.replace("\n", " "))
    for col in df.columns:
        if normalizar(str(col).replace("\n", " ")) == objetivo:
            return col
    raise KeyError(f"No se encontró la columna {nombre_normalizado!r}. Columnas disponibles: {list(df.columns)}")


def _localizar_sms_looker():
    """El export es acumulado completo -> tiene que haber un solo archivo
    'SMS_Looker*.xlsx' en Contexto/ en cada corrida. Si no hay ninguno, la
    sección se omite (todavía no llegó ningún export). Si hay más de uno,
    frena: dejar un solo archivo evita reprocesar una versión vieja por error."""
    candidatos = sorted(CONTEXTO.glob("SMS_Looker*.xlsx"))
    if not candidatos:
        return None
    if len(candidatos) > 1:
        raise RuntimeError(
            "Hay más de un archivo 'SMS_Looker*.xlsx' en Contexto/: "
            f"{[c.name for c in candidatos]}. Es un export ACUMULADO completo (no "
            "append-only) -> dejar un solo archivo, el más reciente, antes de regenerar."
        )
    return candidatos[0]


def _resolver_localidad_exacta(n_loc, localidad_a_oficial, localidad_a_departamento_oficial):
    """n_loc ya normalizado. Localidad (una de las 60) | None. Ya no hay
    fallback a Departamento (cambio de regla del 22/08/2026, ver comentario de
    cabecera de esta sección y CONTEXTO 2): si n_loc no es una de las 60, no
    hay nada que devolver."""
    if n_loc in localidad_a_oficial:
        return {"tipo": "localidad", "departamento": localidad_a_departamento_oficial[n_loc],
                "localidad": localidad_a_oficial[n_loc]}
    return None


def _dividir_audiencia(texto):
    """Split por ' - ', ',' y saltos de línea; limpia paréntesis (rangos
    etarios tipo '(25-45)')."""
    partes = re.split(r"\s+-\s+|,|\n", str(texto))
    limpias = []
    for p in partes:
        p = PARENTESIS_RE.sub("", p).strip()
        if p:
            limpias.append(p)
    return limpias


def _resolver_nombre_localidad(nombre, mapas, fuzzy_aplicados, origen_log):
    """Exacto primero, fuzzy como fallback (cutoff 0.7, ver FUZZY_CUTOFF_SMS)
    contra las 60 localidades prioritarias -> None si no matchea ni por uno
    ni por el otro (ya no hay Departamento a dónde caer, cambio de regla del
    22/08/2026). Se usa tanto para tokens de AUDIENCIA sueltos como para el
    nombre "oficial" que apunta cada excepción hardcodeada de tipo
    "localidad": una excepción confirma que el lugar existe, pero no
    garantiza que su grafía coincida carácter a carácter con las 60 (ej. una
    excepción podría escribir el nombre con un sufijo o variante que el
    padrón oficial no usa), así que igual conviene el fallback fuzzy antes de
    darla por perdida."""
    localidad_a_oficial, _ = mapas
    n_nombre = normalizar(nombre)

    r = _resolver_localidad_exacta(n_nombre, *mapas)
    if r is not None:
        r["matcheo"] = origen_log
        return r

    cercano = difflib.get_close_matches(n_nombre, list(localidad_a_oficial.keys()), n=1, cutoff=FUZZY_CUTOFF_SMS)
    if cercano:
        r = _resolver_localidad_exacta(cercano[0], *mapas)
        r["matcheo"] = "fuzzy" if origen_log == "exacto" else origen_log
        fuzzy_aplicados.append({"token_original": nombre, "matcheado_con": cercano[0]})
        return r

    return None


def _resolver_token_audiencia(token, mapas, fuzzy_aplicados, excepciones_sin_resolver):
    """Devuelve una lista de alcances de tipo "localidad" (nunca prorratea: un
    token puede "explotar" en varias localidades, ej. la excepción de 3 vías)
    o lista VACÍA cuando el token queda fuera del universo del tablero a
    propósito (excepción "excluir") o no matchea ninguna de las 60 dentro de
    una excepción "localidad" (ver excepciones_sin_resolver abajo) -> o None
    si el token no matchea ni por excepción, ni exacto, ni fuzzy -> "no
    identificado". Ya no existe ningún alcance de tipo "departamento" (cambio
    de regla del 22/08/2026, ver cabecera de esta sección): todo lo que no
    sea exactamente una de las 60 queda sin alcance."""
    n_token = normalizar(token)

    if n_token == normalizar(AUDIENCIA_CAPITAL_SUELTO_SMS):
        return [{"tipo": "localidad", "departamento": "CAPITAL", "localidad": LOCALIDAD_CAPITAL_SMS, "matcheo": "capital_suelto"}]

    if n_token in EXCEPCIONES_AUDIENCIA_SMS:
        salida = []
        for tipo, valor in EXCEPCIONES_AUDIENCIA_SMS[n_token]:
            if tipo == "excluir":
                # Queda afuera del universo del tablero a propósito (barrio,
                # o lugar real confirmado que no es una de las 60) -> no
                # genera ningún alcance.
                continue
            r = _resolver_nombre_localidad(valor, mapas, fuzzy_aplicados, origen_log="excepcion")
            if r is None:
                # La excepción hardcodeada apunta a algo que ya no matchea
                # (ni exacto ni fuzzy) contra las 60 -> señal de que algo
                # cambió desde que se cargó esta excepción a mano. Se loguea
                # para revisión manual; ya no hay Departamento a dónde caer,
                # así que no genera ningún alcance.
                excepciones_sin_resolver.append({"token_audiencia": token, "excepcion_apunta_a": valor})
                continue
            salida.append(r)
        return salida

    r = _resolver_nombre_localidad(token, mapas, fuzzy_aplicados, origen_log="exacto")
    if r is not None:
        return [r]

    return None


def cargar_sms(localidad_a_oficial, localidad_a_departamento_oficial):
    ruta = _localizar_sms_looker()
    if ruta is None:
        return None  # todavía no llegó ningún export de SMS -> se omite la sección

    mapas = (localidad_a_oficial, localidad_a_departamento_oficial)

    df = pd.read_excel(ruta, sheet_name="Sms_Looker")
    col_eje = _col(df, "EJE")
    col_depto = _col(df, "DEPARTAMENTO")
    col_fecha = _col(df, "FECHA DE INICIO")
    col_estado = _col(df, "ESTADO")
    col_tematica = _col(df, "TEMATICA")
    col_categoria = _col(df, "CATEGORIA")
    col_mensaje = _col(df, "MENSAJE")
    col_zona = _col(df, "ZONA")
    col_audiencia = _col(df, "AUDIENCIA (LOCALIDADES O BARRIOS)")
    col_cantidad = _col(df, "CANTIDAD DE SMS ENTREGADOS")
    col_circuito = _col(df, "CIRCUITO")

    envios = []
    no_identificados = []
    fuzzy_aplicados = []
    excepciones_sin_resolver = []
    zonas_no_reconocidas = {}

    for idx, row in df.iterrows():
        zona_raw = limpio(row[col_zona])
        n_zona = normalizar(zona_raw)
        audiencia_raw = limpio(row[col_audiencia])
        mensaje_raw = limpio(row[col_mensaje])
        fecha_raw = fecha_iso(row[col_fecha])
        depto_raw_fila = limpio(row[col_depto])  # NO se usa para filtrar/acotar matching (ver 3.4); el único uso que
                                                  # le queda es reconocer "Capital" en AUDIENCIA="DEPTO COMPLETO" (ver abajo)

        # Fila residual del export, no un envío real: caso confirmado el
        # 26/08/2026, la última fila del archivo (MENSAJE/ZONA/FECHA/AUDIENCIA
        # los 4 vacíos, solo traía EJE="SEGURIDAD" suelto). Se descarta antes
        # de sumarla a `envios` -> no entra a ningún conteo ni a ninguna vista,
        # a diferencia de antes donde quedaba como un "envío" fantasma con casi
        # todos los campos null. No se pisa por ESTADO vacío específicamente
        # (más frágil, un envío real podría legítimamente no traer ESTADO):
        # el criterio es que las 4 columnas de contenido estén vacías a la vez.
        if not mensaje_raw and not zona_raw and not fecha_raw and not audiencia_raw:
            continue

        sin_desagregacion = False
        alcances = []

        if n_zona in ZONAS_CAPITAL_SMS:
            # No se desagrega por barrio -> siempre la localidad Capital
            # entera (una de las 60), nunca un Departamento.
            alcances = [{"tipo": "localidad", "departamento": "CAPITAL", "localidad": LOCALIDAD_CAPITAL_SMS, "matcheo": "zona_capital"}]
        elif n_zona == normalizar(ZONA_PROVINCIA_SMS):
            if audiencia_raw and normalizar(audiencia_raw) == normalizar(AUDIENCIA_DEPTO_COMPLETO_SMS):
                # DEPTO COMPLETO: la única forma de saber a qué departamento
                # se refiere es la columna DEPARTAMENTO de la fila. Si es
                # Capital, la localidad Capital cubre igual todo el
                # departamento -> hay alcance. Para cualquier otro
                # departamento ya no existe ningún ámbito que lo represente
                # -> sin desagregación geográfica (en los datos reales,
                # confirmado el 22/08/2026, las 12 filas con DEPTO COMPLETO
                # son siempre de Capital, pero se deja el camino general por
                # las dudas).
                depto_candidato = _departamento_candidato(depto_raw_fila)
                if depto_candidato and normalizar(depto_candidato) == normalizar("CAPITAL"):
                    alcances = [{"tipo": "localidad", "departamento": "CAPITAL", "localidad": LOCALIDAD_CAPITAL_SMS, "matcheo": "depto_completo_capital"}]
                else:
                    sin_desagregacion = True
            elif not audiencia_raw:
                sin_desagregacion = True  # PROVINCIA sin ninguna audiencia especificada: nada para matchear
            else:
                for token in _dividir_audiencia(audiencia_raw):
                    resueltos = _resolver_token_audiencia(token, mapas, fuzzy_aplicados, excepciones_sin_resolver)
                    if resueltos is None:
                        # Sigue sin generar alcance en cualquier caso (esto no
                        # cambia). Si ya fue revisado y confirmado a mano
                        # (TOKENS_CONFIRMADOS_SIN_LUGAR_SMS), no se vuelve a
                        # listar en no_identificados -> evita que estos mismos
                        # 57 tokens reaparezcan cada corrida (el export es
                        # acumulado completo) tapando lo genuinamente nuevo.
                        if not _token_confirmado_sin_lugar(token):
                            no_identificados.append({
                                "fila": int(idx) + 2,  # +2: fila real del excel (header + 1-index)
                                "token": token,
                                "audiencia_original": audiencia_raw,
                                "eje": limpio(row[col_eje]),
                                "fecha_inicio": fecha_iso(row[col_fecha]),
                                "departamento_fila": depto_raw_fila,
                            })
                    else:
                        alcances.extend(resueltos)  # puede ser [] (ej. excepción "excluir") -> no agrega nada
                if not alcances:
                    # Todos los tokens de AUDIENCIA terminaron sin alcance
                    # (excluidos del universo, o no matchearon ninguna de las
                    # 60) -> no queda nada geográfico que mostrar para esta
                    # fila, mismo tratamiento que una ZONA no geográfica.
                    sin_desagregacion = True
        else:
            # ZONA = "Base particular" u otro token no geográfico (bases de
            # datos, rangos etarios, nombres de archivo colados, etc.) -> sin
            # desagregación geográfica. Se mantiene la fila para totales
            # generales pero se excluye de cualquier vista por localidad/depto.
            sin_desagregacion = True
            if zona_raw:
                zonas_no_reconocidas[zona_raw] = zonas_no_reconocidas.get(zona_raw, 0) + 1

        envios.append({
            "eje": limpio(row[col_eje]),
            "fecha_inicio": fecha_raw,
            "estado": limpio(row[col_estado]),
            "tematica": limpio(row[col_tematica]),
            "categoria": limpio(row[col_categoria]),
            "mensaje": mensaje_raw,
            "zona": zona_raw,
            "audiencia_raw": audiencia_raw,
            "cantidad_sms_entregados": limpio(row[col_cantidad]),
            "circuito_raw": limpio(row[col_circuito]),  # sin procesar todavía, ver sección 3.4
            "sin_desagregacion_geografica": sin_desagregacion,
            "alcances": alcances,
        })

    if no_identificados:
        print(f"  ⚠️  SMS: {len(no_identificados)} tokens de AUDIENCIA no identificados -> ver 'no_identificados' en sms.json")
    if excepciones_sin_resolver:
        print(f"  ⚠️  SMS: {len(excepciones_sin_resolver)} excepciones hardcodeadas ya no resuelven -> ver 'excepciones_sin_resolver' en sms.json")
    if fuzzy_aplicados:
        print(f"  ℹ️  SMS: {len(fuzzy_aplicados)} tokens resueltos por coincidencia aproximada -> ver 'fuzzy_aplicados' en sms.json")
    if zonas_no_reconocidas:
        print(f"  ℹ️  SMS: ZONA sin desagregación geográfica: {zonas_no_reconocidas}")

    return {
        "envios": envios,
        "no_identificados": no_identificados,
        "excepciones_sin_resolver": excepciones_sin_resolver,
        "fuzzy_aplicados": fuzzy_aplicados,
        "zonas_no_reconocidas": zonas_no_reconocidas,
    }


# ---------------------------------------------------------------------------
# 6. Contenido Orgánico (GNO)
# ---------------------------------------------------------------------------
#
# Igual que Pauta Digital y SMS: export ACUMULADO COMPLETO -> cada corrida
# reemplaza y reprocesa entero, no es append-only. A diferencia de SMS, acá
# NO hay fallback a Departamento: una localidad de LUGAR o matchea exacto
# (o por alias/fuzzy) una de las 60, o queda directamente afuera de las
# vistas por localidad -> mismo criterio que ya rige en Pauta Digital desde
# el 20/08/2026 (ver sección 2 y 3.2 de CONTEXTO_PROYECTO_TABLERO_COMUNICACION.md).

FUZZY_CUTOFF_GNO = 0.85  # conservador: LUGAR ya viene limpio (nombres cortos,
                          # sin el sufijo verboso de Pauta/SMS) -> el fuzzy acá
                          # es solo red de seguridad para un typo puntual, no
                          # la vía principal de matching.

ALIAS_LUGAR_GNO = {
    "CARLOS PAZ": "VILLA CARLOS PAZ",
    "CIUDAD DE CORDOBA": "CORDOBA",  # cubre tanto "Ciudad de Córdoba" como el
                                       # typo real "Cíudad de Córdoba" -> NFD
                                       # ya le saca la tilde a la í antes de
                                       # comparar, quedan iguales normalizados.
}

TODA_LA_PROVINCIA_GNO = normalizar("Toda la provincia")  # cubre con/sin espacio final

# Confirmado con el usuario (no reabrir): estos tokens de LUGAR existen mundo
# real pero NO son ninguna de las 60 -> quedan afuera de las vistas por
# localidad a propósito. Se tratan distinto de un token "no identificado":
# acá la resolución ya está confirmada (excluir), así que no se loguean para
# revisión -> evita ruido repetido en cada corrida por algo ya zanjado.
EXCLUSIONES_LUGAR_GNO_CONFIRMADAS = {
    normalizar(x) for x in [
        "TANTI", "HUINCA RENANCO", "VILLA DE SOTO", "SAN JOSE DE LA DORMIDA",
        "CHUNA", "CANADA DE LUQUE", "LOS MISTOLES", "POCHO", "LA PAMPA",
        "REGION CENTRO", "ENTE METROPOLITANO",
        # Sumadas 25/08/2026: confirmadas por el usuario, existen en el
        # mundo real pero no son ninguna de las 60 -> mismo criterio.
        "BENJAMIN GOULD", "CANALS", "COLONIA BISMARK", "COLONIA BREMEN",
        "MIRAMAR DE ANSENUZA", "PUEBLO ITALIANO", "VIAMONTE",
        # Sumadas 18/09/2026: confirmadas por el usuario tras el export GNO
        # 18/09 -> nombres de departamento/región (agrupan varias localidades,
        # no son una localidad puntual) y localidades reales fuera de las 60.
        # El patrón "Nombre (N)" (ej. "Minas (4)") es nuevo y de origen
        # desconocido -> mismo criterio: se excluye el token tal cual vino.
        "AREA METROPOLITANA", "SIERRAS CHICAS", "PUNILLA",
        "DEPTO TERCERO ARRIBA", "DEPARTAMENTO TERCERO ARRIBA",
        "DEPARTAMENTO COLON", "DEPTO TULUMBA",
        "MINAS (4)", "SAN JUSTO (4)", "UNION (4)", "GENERAL SAN MARTIN (3)",
        "POCHO (2)", "SAN JAVIER (2)", "RIO SEGUNDO (1)", "JUAREZ CELMAN (1)",
        "RIO CUARTO (1)", "SAN ALBERTO (1) Y TOTORAL (1).",
        "VILLA GIARDINO", "VALLE HERMOSO", "CASA GRANDE", "MAYU SUMAJ",
        "TINOCO", "LAS ISLETILLAS", "PUNTA DEL AGUA", "PAMPAYASTA SUD",
        "PAMPAYASTA NORTE", "PARAJE LOS POTREROS", "DALMACIO VELEZ SARFIELD",
        "CURA BROCHERO",
    ]
}


def _localizar_contenido_organico():
    """Mismo criterio que _localizar_sms_looker(): export acumulado completo
    -> tiene que haber un solo archivo 'Publicaciones*GNO*.xlsx' en Contexto/
    en cada corrida. None si todavía no llegó ningún export; RuntimeError si
    hay más de uno (evita reprocesar una versión vieja por error)."""
    candidatos = sorted(CONTEXTO.glob("Publicaciones*GNO*.xlsx"))
    if not candidatos:
        return None
    if len(candidatos) > 1:
        raise RuntimeError(
            "Hay más de un archivo 'Publicaciones*GNO*.xlsx' en Contexto/: "
            f"{[c.name for c in candidatos]}. Es un export ACUMULADO completo (no "
            "append-only) -> dejar un solo archivo, el más reciente, antes de regenerar."
        )
    return candidatos[0]


def _resolver_lugar_gno(token, localidad_a_oficial, fuzzy_aplicados):
    """Un token ya recortado de LUGAR -> nombre oficial de una de las 60, o
    None si no matchea ni exacto/alias ni por fuzzy (cutoff 0.85). No hay
    fallback a Departamento acá (a diferencia de SMS) -> None significa
    directamente "afuera de las vistas por localidad"."""
    n_token = normalizar(token)
    n_token = ALIAS_LUGAR_GNO.get(n_token, n_token)

    if n_token in localidad_a_oficial:
        return localidad_a_oficial[n_token]

    cercano = difflib.get_close_matches(
        n_token, list(localidad_a_oficial.keys()), n=1, cutoff=FUZZY_CUTOFF_GNO
    )
    if cercano:
        fuzzy_aplicados.append({"token_original": token, "matcheado_con": cercano[0]})
        return localidad_a_oficial[cercano[0]]

    return None


def cargar_contenido_organico(localidad_a_oficial):
    ruta = _localizar_contenido_organico()
    if ruta is None:
        return None  # todavía no llegó ningún export de Contenido Orgánico -> se omite la sección

    df = pd.read_excel(ruta, sheet_name="Hoja 1")
    col_fecha = _col(df, "FECHA")
    col_red = _col(df, "RED SOCIAL")
    col_nombre = _col(df, "NOMBRE DEL CONTENIDO")
    col_link = _col(df, "LINK")
    col_lugar = _col(df, "LUGAR")

    # 1) Forward-fill de FECHA: solo la primera fila de cada tanda de redes
    # trae fecha propia, el resto queda NaT hasta la siguiente fecha real.
    df[col_fecha] = df[col_fecha].ffill()

    # 2) Descartar filas de plantilla vacía (sin RED SOCIAL ni NOMBRE DEL
    # CONTENIDO -> no aportan ningún dato real). Se aplica en cualquier
    # posición del archivo, no solo al final: hay separadores intermedios
    # con el mismo patrón (fila con o sin fecha propia, pero sin ningún
    # contenido) además de la tanda final de fechas futuras vacías. 25/08/
    # 2026: se sacó LINK de la condición -> una fila con un link pegado pero
    # sin RED SOCIAL ni NOMBRE DEL CONTENIDO tampoco es una publicación real
    # (ej. un link suelto con LUGAR cargado pero sin contenido real detrás).
    vacia = df[col_red].isna() & df[col_nombre].isna()
    filas_descartadas = int(vacia.sum())
    df = df[~vacia]

    publicaciones = []
    no_identificados = []
    fuzzy_aplicados = []
    lugares_con_link_excluidos = []
    sin_red_social = []

    for idx, row in df.iterrows():
        fecha = fecha_iso(row[col_fecha])
        red_social = limpio(row[col_red])
        # RED SOCIAL puede traer varias redes separadas por coma (ej. "FB
        # GOBIERNO, FB MLL") -> se separa para poder contar la publicación
        # una vez por cada red. Si viene vacía (fila con contenido real pero
        # sin red cargada) queda lista vacía -no se inventa una red- y se
        # loguea en 'sin_red_social' para revisión.
        redes_sociales = [r.strip() for r in red_social.split(",") if r.strip()] if red_social else []
        nombre_contenido_raw = limpio(row[col_nombre])
        nombre_contenido = nombre_contenido_raw.strip() if nombre_contenido_raw else nombre_contenido_raw
        link = limpiar_link(row[col_link])
        lugar_raw = limpio(row[col_lugar])

        if not redes_sociales:
            sin_red_social.append({
                "fila": int(idx) + 2,
                "fecha": fecha,
                "nombre_contenido": nombre_contenido,
            })

        localidades = []
        ambito_provincial = False
        lugar_excluido_por_link = False

        if lugar_raw:
            if "http" in lugar_raw.lower():
                # Error de carga (link pegado en LUGAR) -> se trata como si
                # LUGAR estuviera vacío, se loguea aparte para revisión.
                lugar_excluido_por_link = True
                lugares_con_link_excluidos.append({
                    "fila": int(idx) + 2,  # +2: header + 1-index, igual que SMS
                    "fecha": fecha,
                    "red_social": red_social,
                    "nombre_contenido": nombre_contenido,
                    "lugar_raw": lugar_raw,
                })
            else:
                for token in [t.strip() for t in lugar_raw.split(",") if t.strip()]:
                    if normalizar(token) == TODA_LA_PROVINCIA_GNO:
                        ambito_provincial = True
                        continue
                    oficial = _resolver_lugar_gno(token, localidad_a_oficial, fuzzy_aplicados)
                    if oficial:
                        if oficial not in localidades:
                            localidades.append(oficial)
                    elif normalizar(token) not in EXCLUSIONES_LUGAR_GNO_CONFIRMADAS:
                        no_identificados.append({
                            "fila": int(idx) + 2,
                            "token": token,
                            "lugar_original": lugar_raw,
                            "fecha": fecha,
                        })

        publicaciones.append({
            "fecha": fecha,
            "red_social": red_social,
            "redes_sociales": redes_sociales,
            "nombre_contenido": nombre_contenido,
            "link": link,
            "lugar_raw": lugar_raw,
            "lugar_excluido_por_link": lugar_excluido_por_link,
            "ambito_provincial": ambito_provincial,
            "localidades": localidades,
        })

    if no_identificados:
        print(f"  ⚠️  Contenido Orgánico: {len(no_identificados)} tokens de LUGAR no identificados -> ver 'no_identificados' en contenido_organico.json")
    if fuzzy_aplicados:
        print(f"  ℹ️  Contenido Orgánico: {len(fuzzy_aplicados)} tokens resueltos por coincidencia aproximada -> ver 'fuzzy_aplicados' en contenido_organico.json")
    if lugares_con_link_excluidos:
        print(f"  ⚠️  Contenido Orgánico: {len(lugares_con_link_excluidos)} filas con un link pegado en LUGAR (tratadas como sin lugar) -> ver 'lugares_con_link_excluidos' en contenido_organico.json")
    if sin_red_social:
        print(f"  ⚠️  Contenido Orgánico: {len(sin_red_social)} publicaciones con contenido pero sin RED SOCIAL cargada -> ver 'sin_red_social' en contenido_organico.json")

    return {
        "publicaciones": publicaciones,
        "no_identificados": no_identificados,
        "fuzzy_aplicados": fuzzy_aplicados,
        "lugares_con_link_excluidos": lugares_con_link_excluidos,
        "sin_red_social": sin_red_social,
        "filas_descartadas_vacias": filas_descartadas,
    }


# ---------------------------------------------------------------------------
# 7. Campañas unificadas
# ---------------------------------------------------------------------------

def construir_campanas(medios_tradicionales, pauta_digital, audiovisuales):
    items = []

    for loc in medios_tradicionales["localidades"]:
        for v in loc["vigentes"]:
            if v["sin_fecha"]:
                continue  # Activo sin fecha: solo cobertura, fuera de Campañas/Gantt
            items.append({
                "area_origen": "Medios tradicionales",
                "campana": v["tema"],
                "alcance_tipo": "localidad",
                "departamento": loc["departamento"],
                "localidad": loc["localidad"],
                "detalle": {
                    "tipo_medio": v["tipo_medio"],
                    "estado": v["estado"],
                    "fecha_desde": v["fecha_desde"],
                    "fecha_hasta": v["fecha_hasta"],
                    "antiguedad_dias": v["antiguedad_dias"],
                    "alerta": v["alerta"],
                    "link_material": v["link_material"],
                    "links_material": v["links_material"],
                },
            })

    for pieza in pauta_digital["piezas"]:
        if pieza["alcance_tipo"] is None:
            continue  # BARRIO/CIRCUITO/CODIGO_AUDIENCIA/OTRO/REGION: no aplican a la vista unificada por localidad/depto
        # en_60_localidades solo es la condición correcta para alcance_tipo=='localidad'
        # (ahí sí significa "esta Localidad puntual es una de las 60"). Para 'departamento'
        # y 'provincia' NO se filtra por en_60_localidades: esta es la vista unificada con
        # el ámbito etiquetado, no una vista por Localidad — una pieza DEPARTAMENTO sigue
        # entrando acá (con su Departamento a la vista) aunque ya no cuente para ningún
        # panel de Localidad puntual.
        if pieza["alcance_tipo"] == "localidad" and not pieza["en_60_localidades"]:
            continue
        items.append({
            "area_origen": "Pauta digital",
            "campana": pieza["campana"],
            "alcance_tipo": pieza["alcance_tipo"],
            "departamento": pieza["departamento"],
            "localidad": pieza["localidad"],
            # localidad_asignada + cod_contenido viajan acá (no solo en
            # pauta_digital.json) para que un futuro total en esta vista
            # pueda dedupear las filas expandidas por Departamento (ver
            # _dedup_pauta_global_por_cod_contenido) sin tener que volver a
            # cruzar con pauta_digital.json. None en piezas del histórico
            # (Medios Digitales.xlsx no trae COD. CONTENIDO) y en piezas sin
            # Localidad puntual (ambito departamento/provincia).
            "localidad_asignada": pieza.get("localidad_asignada"),
            "detalle": {
                "area_tematica": pieza["area_tematica"],
                "estado": pieza["estado"],
                "finalizacion": pieza["finalizacion"],
                "alcance": pieza["alcance"],
                "importe_gastado": pieza["importe_gastado"],
                "cod_contenido": pieza.get("cod_contenido"),
                "titulo_pieza": pieza["titulo_pieza"],
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

    # Mapas de forma oficial (mayúscula, sin tildes, tal como ya se muestra en
    # el resto del tablero) para resolver la geografía de Pauta RRSS_GLOBAL a
    # la grafía canónica del proyecto, sin depender de cómo venga tipeada en
    # el excel crudo.
    localidad_a_oficial = {}
    localidad_a_departamento_oficial = {}
    deptos_a_oficial = {}
    # Inversa de localidad_a_departamento_oficial: de Departamento (normalizado)
    # a la lista de sus localidades (normalizadas) dentro de las 60 — la usa
    # clasificar_geografia_pauta_global() para expandir una fila "TODAS LAS
    # LOCALIDADES" + Departamento puntual en una pieza por Localidad.
    departamento_a_localidades_normalizadas = {}
    for loc in localidades:
        n_loc = normalizar(loc["localidad"])
        n_depto = normalizar(loc["departamento"])
        localidad_a_oficial[n_loc] = loc["localidad"]
        localidad_a_departamento_oficial[n_loc] = loc["departamento"]
        deptos_a_oficial[n_depto] = loc["departamento"]
        departamento_a_localidades_normalizadas.setdefault(n_depto, []).append(n_loc)

    medios_tradicionales, movimientos_semana = cargar_medios_tradicionales()
    # Foto de la carga anterior (antes de sobreescribir) + fecha de generación,
    # que el front usa para el delta semanal y para detectar anomalías
    # (Vigente con FIN anterior a esta fecha).
    mt_previo_path = DATA_OUT / "medios_tradicionales.json"
    mt_previo = None
    if mt_previo_path.exists():
        with open(mt_previo_path, encoding="utf-8") as f:
            mt_previo = json.load(f)
    medios_tradicionales["generado_el"] = HOY.isoformat()
    medios_tradicionales["snapshot_anterior"] = snapshot_anterior_mt(mt_previo, medios_tradicionales)
    escribir_json("medios_tradicionales.json", medios_tradicionales)
    escribir_json("movimientos_semana.json", movimientos_semana)

    historico_medios = cargar_historico_medios()
    escribir_json("historico_medios.json", historico_medios)

    # Códigos del JSON ANTERIOR (antes de sobreescribirlo) para el chequeo de
    # bajas del punto 6: se lee acá, antes de escribir_json("pauta_digital.json"...).
    pauta_digital_anterior_path = DATA_OUT / "pauta_digital.json"
    codigos_previos = set()
    if pauta_digital_anterior_path.exists():
        with open(pauta_digital_anterior_path, encoding="utf-8") as f:
            piezas_anteriores = json.load(f)["piezas"]
        codigos_previos = {p["cod_contenido"] for p in piezas_anteriores if p.get("cod_contenido") is not None}

    piezas_historico = cargar_pauta_digital_historico(claves_60)
    piezas_global, excluidas_global, descartadas_dedup_global, metricas_global = cargar_pauta_digital_global(
        localidad_a_oficial, localidad_a_departamento_oficial, deptos_a_oficial,
        departamento_a_localidades_normalizadas,
    )
    print(
        f"  Pauta digital: {len(piezas_historico)} piezas histórico (<= {CORTE_HISTORICO_PAUTA_DIGITAL}) "
        f"+ {len(piezas_global)} piezas fuente nueva ({excluidas_global} excluidas por estar fuera de la provincia, "
        f"{descartadas_dedup_global} descartadas por dedup de COD. CONTENIDO tras expandir Departamentos)"
    )
    # --- Verificación (Pauta RRSS_GLOBAL.xlsx) — corre ANTES de escribir el
    # JSON, así un corte por pérdida de datos no esperada no llega a
    # sobreescribir el archivo anterior. -----------------------------------
    codigos_nuevos = {p["cod_contenido"] for p in piezas_global if p.get("cod_contenido") is not None}
    codigos_dados_de_baja = sorted(codigos_previos - codigos_nuevos, key=str)
    conteo_estados = Counter(p["estado"] for p in piezas_global)
    estados_no_mapeados = sorted(set(conteo_estados) - {"Vigente", "Finalizada", "Observada", "Programada", "S/D"})
    print("  --- Verificación Pauta Digital (Pauta RRSS_GLOBAL.xlsx) ---")
    print(f"  Filas descartadas como basura: {metricas_global['filas_descartadas']} de {metricas_global['filas_totales']} totales")
    print(f"  Filas reales tras filtro: {metricas_global['filas_reales']}")
    print(f"  Filas con COD. CONTENIDO: {metricas_global['filas_con_cod_contenido']}")
    print(f"  Códigos únicos con COD. CONTENIDO: {metricas_global['codigos_unicos_con_cod_contenido']}")
    print(f"  Filas colapsadas por dedup: {metricas_global['filas_colapsadas_por_dedup']}")
    print(f"  Total de piezas fuente nueva en el JSON final: {len(piezas_global)}")
    print(f"  Piezas por estado (directo de ESTADO crudo): {dict(conteo_estados)}")
    if estados_no_mapeados:
        print(f"  ⚠️  Estados fuera de ACTIVO/INACTIVO/OBSERVADO/PROGRAMADO/vacío, mostrados tal cual: {estados_no_mapeados}")
    if codigos_dados_de_baja:
        print(f"  Códigos dados de baja respecto al JSON anterior ({len(codigos_dados_de_baja)}): {codigos_dados_de_baja}")
        raise SystemExit(
            "Aparecieron bajas respecto al JSON anterior. Deteniendo la corrida sin "
            "escribir pauta_digital.json -- podría ser una pérdida de datos no esperada."
        )
    else:
        print("  Códigos dados de baja respecto al JSON anterior: 0")

    # generado_el: fecha de corte del dato. Una pieza Vigente (ESTADO=ACTIVO en la
    # fuente) con FIN anterior a esta fecha es una anomalía de la fuente
    # ("vencida sin renovar"), distinta de la que venció después de la carga.
    pauta_digital = {"generado_el": HOY.isoformat(), "piezas": piezas_historico + piezas_global}
    escribir_json("pauta_digital.json", pauta_digital)

    audiovisuales = cargar_audiovisuales()
    escribir_json("audiovisuales.json", audiovisuales)

    sms = cargar_sms(localidad_a_oficial, localidad_a_departamento_oficial)
    if sms is not None:
        escribir_json("sms.json", sms)
        print(
            f"  SMS: {len(sms['envios'])} envíos procesados "
            f"({len(sms['no_identificados'])} tokens no identificados, "
            f"{len(sms['excepciones_sin_resolver'])} excepciones sin resolver, "
            f"{len(sms['fuzzy_aplicados'])} por coincidencia aproximada)"
        )
    else:
        print("  SMS: no se encontró ningún archivo 'SMS_Looker*.xlsx' en Contexto/ -> sección omitida")

    contenido_organico = cargar_contenido_organico(localidad_a_oficial)
    if contenido_organico is not None:
        escribir_json("contenido_organico.json", contenido_organico)
        print(
            f"  Contenido Orgánico: {len(contenido_organico['publicaciones'])} publicaciones procesadas "
            f"({len(contenido_organico['no_identificados'])} tokens de LUGAR no identificados, "
            f"{len(contenido_organico['fuzzy_aplicados'])} por coincidencia aproximada, "
            f"{len(contenido_organico['lugares_con_link_excluidos'])} con link pegado en LUGAR)"
        )
    else:
        print("  Contenido Orgánico: no se encontró ningún archivo 'Publicaciones*GNO*.xlsx' en Contexto/ -> sección omitida")

    campanas = construir_campanas(medios_tradicionales, pauta_digital, audiovisuales)
    escribir_json("campanas.json", campanas)

    print("Listo.")


if __name__ == "__main__":
    main()
