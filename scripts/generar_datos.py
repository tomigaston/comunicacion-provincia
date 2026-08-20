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
    caidos_df = pd.read_excel(xls, sheet_name="Caidos")
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

        # en_60_localidades (y por lo tanto la atribución a una Localidad o
        # Departamento puntual) depende de Alcance_Detectado, no del texto
        # crudo de Localidad/Departamento: una fila OTRO/REGION/CIRCUITO/
        # CODIGO_AUDIENCIA nunca se atribuye a una Localidad ni Departamento
        # aunque su columna Localidad diga, por texto, el nombre de una de
        # las 60 (ej. "CORDOBA" en filas OTRO de barrios sueltos).
        #
        # Aparte (no algo que este chequeo cambie, ya se daba antes): una fila
        # LOCALIDAD cuya Localidad no es una de las 60 oficiales tampoco entra,
        # aunque su Departamento sí tenga localidades prioritarias —hoy 44
        # filas del histórico (Freyre, Miramar, Brinkmann, Chancaní y otras
        # menores). No se las reasigna al Departamento: el dato ya viene
        # acotado a una localidad puntual que no es una de las 60, así que no
        # corresponde inflar el conteo departamental con ellas. Queda anotado
        # acá para que la caída de conteo no parezca un misterio.
        en_60 = False
        if alcance_detectado in ("LOCALIDAD", "CAPITAL", "BARRIO"):
            en_60 = bool(loc) and (normalizar(depto), normalizar(loc)) in claves_60
        elif alcance_detectado == "DEPARTAMENTO" and depto:
            en_60 = any(normalizar(depto) == d for d, _ in claves_60)
        elif alcance_detectado == "PROVINCIA":
            en_60 = True  # provincia entera siempre aplica al universo

        piezas.append({
            "fuente": "historico",
            "codigo_pieza": parseo["codigo_pieza"],
            "nombre_anuncio": limpio(row["Nombre del anuncio"]),
            "titulo_pieza": extraer_titulo_pieza(row["Nombre del anuncio"]),
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
            "finalizacion": finalizacion,
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


def clasificar_geografia_pauta_global(depto_raw, loc_raw, localidades_60_normalizadas):
    """Reglas de clasificación de LOCALIDAD / SUBCIRCUITO, en este orden:
    1) DEPARTAMENTO sin "CÓRDOBA" (ej. Santa Fe, Entre Ríos) -> excluida.
    2) Código de subcircuito de Capital (ej. "010A - CABILDO") -> localidad
       Córdoba (Capital no distingue circuito en este tablero).
    3) "TODAS LAS LOCALIDADES" -> ámbito provincia.
    4) "X, DEPARTAMENTO, PROVINCIA..." -> candidata = texto antes de la
       primera coma; si matchea una de las 60 -> ámbito localidad; si no
       -> fallback a ámbito departamento (NO se crea localidad nueva).
    5) Vacío pero con DEPARTAMENTO -> ámbito departamento.
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
        }

    if loc_str == "TODAS LAS LOCALIDADES":
        return {"excluida": False, "ambito": "provincia", "localidad": None, "departamento": None}

    if loc_str:
        candidata = loc_str.split(",")[0].strip()
        n_candidata = normalizar(candidata)
        n_candidata = ALIAS_LOCALIDAD_PAUTA_GLOBAL.get(n_candidata, n_candidata)
        if n_candidata in localidades_60_normalizadas:
            return {"excluida": False, "ambito": "localidad", "localidad": n_candidata, "departamento": None}
        # Existe pero no es una de las 60 -> fallback a Departamento, regla
        # fija del proyecto: nunca se crea una localidad nueva.
        return {"excluida": False, "ambito": "departamento", "localidad": None, "departamento": depto_candidato}

    if depto_candidato:
        return {"excluida": False, "ambito": "departamento", "localidad": None, "departamento": depto_candidato}

    return {"excluida": False, "ambito": None, "localidad": None, "departamento": None}


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


def cargar_pauta_digital_global(localidad_a_oficial, localidad_a_departamento_oficial, deptos_a_oficial):
    """Fuente nueva, reemplaza a Medios Digitales.xlsx de acá en adelante
    (desde el 3/7/2026). No se fuerza al esquema del histórico —Planificado/
    Ejecutado quedan separados por plataforma (Meta/Google), ver Tarea 5."""
    df = pd.read_excel(CONTEXTO / "Pauta RRSS_GLOBAL.xlsx", sheet_name="GLOBAL_ImportRange")
    localidades_60_normalizadas = set(localidad_a_oficial.keys())
    mapa_campanas = construir_mapa_formas_canonicas(df["CAMPAÑA"])
    mapa_plataformas = construir_mapa_formas_canonicas(df["PLATAFORMA"])
    mapa_tipos_pauta = construir_mapa_formas_canonicas(df["TIPO DE PAUTA"])

    piezas = []
    excluidas = 0
    for _, row in df.iterrows():
        geo = clasificar_geografia_pauta_global(
            row["DEPARTAMENTO"], row["LOCALIDAD / SUBCIRCUITO"], localidades_60_normalizadas
        )
        if geo["excluida"]:
            excluidas += 1
            continue

        if geo["ambito"] == "localidad":
            localidad = localidad_a_oficial[geo["localidad"]]
            departamento = localidad_a_departamento_oficial[geo["localidad"]]
        elif geo["ambito"] == "departamento":
            localidad = None
            departamento = deptos_a_oficial.get(normalizar(geo["departamento"]), geo["departamento"])
        else:
            localidad = None
            departamento = None

        link_material = limpiar_link(row["LINK MATERIAL"])
        link_ig = limpiar_link(row["IG"])
        link_fb = limpiar_link(row["FB"])
        link_yt = limpiar_link(row["YT"])

        campana = _forma_canonica(mapa_campanas, limpio(row["CAMPAÑA"]))
        plataforma = _forma_canonica(mapa_plataformas, limpio(row["PLATAFORMA"]))
        tipo_pauta = _forma_canonica(mapa_tipos_pauta, limpio(row["TIPO DE PAUTA"]))

        piezas.append({
            "fuente": "global",
            "codigo_pieza": None,
            "nombre_anuncio": limpio(row["TITULO DE LA PIEZA"]),
            "titulo_pieza": limpio(row["TITULO DE LA PIEZA"]),
            "area_tematica": limpio(row["EJE"]),
            "ministerio": limpio(row["MINISTERIO"]),
            "campana": campana,
            "alcance_detectado": {"localidad": "LOCALIDAD", "departamento": "DEPARTAMENTO", "provincia": "PROVINCIA"}.get(geo["ambito"]),
            "alcance_tipo": geo["ambito"],
            "en_60_localidades": True,
            "departamento": departamento,
            "localidad": localidad,
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
            "fecha_creacion": fecha_iso(row["FECHA DE ENVÍO"]),
            "finalizacion": fecha_iso(row["FIN"]),
            "estado": estado_por_fecha(row["FIN"]),
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
            "visualizaciones_planificadas_google": limpio(row["Visualizaciones Planificadas GOOGLE"]),
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
            "links_material": [l for l in (link_material, link_ig, link_fb, link_yt) if l],
        })

    return piezas, excluidas


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

    # Mapas de forma oficial (mayúscula, sin tildes, tal como ya se muestra en
    # el resto del tablero) para resolver la geografía de Pauta RRSS_GLOBAL a
    # la grafía canónica del proyecto, sin depender de cómo venga tipeada en
    # el excel crudo.
    localidad_a_oficial = {}
    localidad_a_departamento_oficial = {}
    deptos_a_oficial = {}
    for loc in localidades:
        n_loc = normalizar(loc["localidad"])
        localidad_a_oficial[n_loc] = loc["localidad"]
        localidad_a_departamento_oficial[n_loc] = loc["departamento"]
        deptos_a_oficial[normalizar(loc["departamento"])] = loc["departamento"]

    medios_tradicionales, movimientos_semana = cargar_medios_tradicionales()
    escribir_json("medios_tradicionales.json", medios_tradicionales)
    escribir_json("movimientos_semana.json", movimientos_semana)

    historico_medios = cargar_historico_medios()
    escribir_json("historico_medios.json", historico_medios)

    piezas_historico = cargar_pauta_digital_historico(claves_60)
    piezas_global, excluidas_global = cargar_pauta_digital_global(
        localidad_a_oficial, localidad_a_departamento_oficial, deptos_a_oficial
    )
    print(
        f"  Pauta digital: {len(piezas_historico)} piezas histórico (<= {CORTE_HISTORICO_PAUTA_DIGITAL}) "
        f"+ {len(piezas_global)} piezas fuente nueva ({excluidas_global} excluidas por estar fuera de la provincia)"
    )
    pauta_digital = {"piezas": piezas_historico + piezas_global}
    escribir_json("pauta_digital.json", pauta_digital)

    audiovisuales = cargar_audiovisuales()
    escribir_json("audiovisuales.json", audiovisuales)

    campanas = construir_campanas(medios_tradicionales, pauta_digital, audiovisuales)
    escribir_json("campanas.json", campanas)

    print("Listo.")


if __name__ == "__main__":
    main()
