#!/usr/bin/env python3
"""
Encuestas de Localidades (opinión pública): imagen de funcionarios,
aprobación, intención de voto, dirigentes locales y obras.

Sección NUEVA e INDEPENDIENTE del resto del tablero:
  - NO usa el universo fijo de 60 localidades (Localidades (1).xlsx) -> el
    universo de localidades lo define esta fuente tal cual aparece en su
    columna Localidad, sin cruzar contra nada más.
  - NO se integra al concepto de "Campaña" que unifica Medios
    tradicionales/Pauta Digital/Audiovisuales (construir_campanas() en
    generar_datos.py).
  - Por eso es un script aparte y no una función más dentro de
    generar_datos.py: ni la fuente ni las reglas de esta sección tienen
    relación con las demás áreas, y mezclarla ahí obligaría a arrastrar el
    universo de 60 localidades a un lugar donde no aplica.

Reutiliza (importa, no duplica) normalizar()/limpio()/fecha_iso()/
escribir_json()/CONTEXTO/DATA_OUT de generar_datos.py: mismo criterio de
normalización de texto y misma convención de escritura de JSON que el
resto del proyecto. No modifica ese archivo.

Fuente: Contexto/BASE_MAESTRA_FINAL.xlsx, hoja "Sheet1" (~3800 filas, 15
columnas). A diferencia de SMS_Looker*.xlsx / Publicaciones*GNO*.xlsx (que
llegan como export fechado y se buscan por glob), esta es una planilla
"maestro" de nombre fijo -mismo criterio que Audiovisuales.xlsx o
MAESTRO_TABLERO_COMUNICACION.xlsx- así que se lee directo por nombre.

El JSON de salida se regenera completo desde cero en cada corrida: nunca
se mergea con una versión anterior de data/encuestas_localidades.json.

Uso: python3 scripts/generar_encuestas_localidades.py
"""
import difflib
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generar_datos import CONTEXTO, DATA_OUT, escribir_json, fecha_iso, limpio, normalizar  # noqa: E402

FUENTE = CONTEXTO / "BASE_MAESTRA_FINAL.xlsx"
HOJA = "Sheet1"
FUENTE_LOCALIDADES_60 = CONTEXTO / "Localidades (1).xlsx"

TIPOS_PREGUNTA_SIMPLES = {"Imagen_Funcionario", "Aprobacion", "Reeleccion", "Problemas"}

# Conteos de una versión anterior del archivo (bastante más vieja que la
# corrida anterior de este mismo script), para detectar diferencias
# grandes en la corrida actual (pedido explícito de auditoría, no una
# validación que deba frenar el script si difiere: es esperable que el
# archivo se haya actualizado).
REFERENCIA_CONTEO_TIPO_PREGUNTA = {
    "Imagen_Funcionario": 480,
    "Aprobacion": 132,
    "Reeleccion": 108,
    "Problemas": 283,
    "Obras": 287,
    "Dirigentes_Locales": 1349,
    "Candidatos_Gobernador": 707,
    "Candidatos_Intendente": 27,
    "Otra": 427,
}

# Totales de la corrida INMEDIATA anterior de este script (no la referencia
# vieja de arriba), para poder distinguir "el archivo cambió un poco desde
# la última vez que lo corrimos" de "el archivo cambió desde hace dos
# versiones" -> pedido explícito de esta vuelta.
REFERENCIA_CORRIDA_ANTERIOR = {"total_filas": 3800, "localidades_unicas": 24}

# Umbral de similitud (difflib) para sospechar que dos localidades
# normalizadas distintas son en realidad la misma con un typo (ej. "VILLA
# DOLORES" / "VILLLA DOLORES", triple L). NO se unifican automáticamente
# -> solo se loguean para que el usuario confirme.
UMBRAL_SIMILITUD_TYPO_LOCALIDAD = 0.9

# Mismo mecanismo (difflib, mismo umbral por default) pero para nombres de
# persona (Dirigente / candidato) DENTRO de una misma localidad -> ver
# _detectar_posibles_typos_nombres(). Constante separada y configurable por
# si en el futuro conviene un umbral distinto al de localidades (nombres de
# persona tienen otra "forma" que nombres de lugar).
UMBRAL_SIMILITUD_TYPO_NOMBRES = 0.9


# ---------------------------------------------------------------------------
# Helpers de orden/colisión
# ---------------------------------------------------------------------------

def _clave_orden(fila):
    """(Orden_Agrupada, Orden_Categoria) para ordenar categorías dentro de
    una pregunta: Orden_Agrupada primero (agrupación gruesa, ej. Positiva/
    Regular/Negativa/No sabe), Orden_Categoria como desempate/orden fino
    dentro del grupo. Nulos van al final (no truncan ni rompen el sort)."""
    oa = fila.get("Orden_Agrupada")
    oc = fila.get("Orden_Categoria")
    oa = oa if oa is not None else float("inf")
    oc = oc if oc is not None else float("inf")
    return (oa, oc)


def _armar_categorias(filas, colisiones_log, contexto_log):
    """filas: lista de dicts de una misma pregunta (ya en orden de aparición
    del excel), cada uno con Categoria_Respuesta/Porcentaje/Orden_Categoria/
    Orden_Agrupada. Devuelve {categoria: pct} ordenado por _clave_orden().

    Si una misma categoría aparece más de una vez dentro del grupo (no
    debería, pero la fuente real trae algunos casos -> ver reporte):
      - todas las apariciones con el mismo pct -> fila duplicada
        inofensiva, se colapsa sin más (no hay info que perder).
      - con pct distinto entre apariciones -> colisión real: guardar TODOS
        los valores sin avisar pisaría datos en silencio. Se conserva el
        PRIMER valor visto (orden de aparición en el excel, determinístico)
        y se dejan registrados TODOS los valores vistos en colisiones_log
        para auditoría manual.
    """
    valor, orden, vistos = {}, {}, defaultdict(list)
    for fila in filas:
        cat = fila["Categoria_Respuesta"]
        pct = fila["Porcentaje"]
        if cat not in valor:
            valor[cat] = pct
            orden[cat] = _clave_orden(fila)
        vistos[cat].append(pct)

    for cat, pcts in vistos.items():
        if len(set(pcts)) > 1:
            colisiones_log.append({**contexto_log, "categoria": cat, "valores_vistos": pcts, "valor_usado": valor[cat]})

    return {cat: valor[cat] for cat in sorted(valor, key=lambda c: orden[c])}


def _armar_candidatos(filas, colisiones_log, contexto_log):
    """Igual criterio de colisión que _armar_categorias(), pero para listas
    de candidato/pct (Candidatos_Gobernador/Intendente) en vez de dict de
    categorías: devuelve [{"candidato":.., "pct":..}] ordenado por pct
    descendente."""
    valor, vistos = {}, defaultdict(list)
    for fila in filas:
        cand = fila["Categoria_Respuesta"]
        pct = fila["Porcentaje"]
        if cand not in valor:
            valor[cand] = pct
        vistos[cand].append(pct)

    for cand, pcts in vistos.items():
        if len(set(pcts)) > 1:
            colisiones_log.append({**contexto_log, "candidato": cand, "valores_vistos": pcts, "valor_usado": valor[cand]})

    ordenados = sorted(valor.items(), key=lambda kv: -(kv[1] if kv[1] is not None else float("-inf")))
    return [{"candidato": cand, "pct": pct} for cand, pct in ordenados]


def _numero_limpio(v):
    """float que representa un entero (ej. 77.0) -> int; cualquier otro
    numérico -> se deja tal cual; None/NaN -> None."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


# ---------------------------------------------------------------------------
# Casos_Totales: un único valor por Localidad+Fecha (moda; empate -> máximo)
# ---------------------------------------------------------------------------

def _resolver_casos_totales(filas_por_ronda):
    """filas_por_ronda: {(localidad_norm, fecha): [valores Casos_Totales de
    sus filas]}. Devuelve (dict {(localidad_norm, fecha): valor_final},
    lista de inconsistencias para auditoría). Regla acordada con el
    usuario: moda de los valores vistos; empate entre dos o más -> el
    MÁXIMO de los empatados."""
    resultado, inconsistencias = {}, []
    for clave, valores_crudos in filas_por_ronda.items():
        valores = [v for v in valores_crudos if v is not None and not pd.isna(v)]
        if not valores:
            resultado[clave] = None
            continue
        conteo = Counter(valores)
        frecuencia_max = max(conteo.values())
        empatados = [v for v, c in conteo.items() if c == frecuencia_max]
        elegido = _numero_limpio(max(empatados))
        resultado[clave] = elegido
        if len(conteo) > 1:
            inconsistencias.append({
                "localidad": clave[0],
                "fecha": clave[1],
                "valores_vistos": sorted(((_numero_limpio(v), c) for v, c in conteo.items())),
                "valor_elegido": elegido,
            })
    return resultado, inconsistencias


# ---------------------------------------------------------------------------
# Detección (no unificación) de posibles typos -> localidades y nombres
# ---------------------------------------------------------------------------

def _pares_similares(claves, umbral):
    """Compara cada par de strings distintos de `claves` por similitud de
    texto (difflib.SequenceMatcher) -> lista de (a, b, similitud) para los
    pares que superan `umbral`. Core compartido por los tres detectores de
    typos de este script (localidad, dirigente, candidato): NO decide nada
    por su cuenta, solo señala candidatos para que el usuario confirme."""
    claves = sorted(claves)
    pares = []
    for i in range(len(claves)):
        for j in range(i + 1, len(claves)):
            a, b = claves[i], claves[j]
            ratio = difflib.SequenceMatcher(None, a, b).ratio()
            if ratio >= umbral:
                pares.append((a, b, round(ratio, 3)))
    return pares


def _detectar_posibles_typos_localidad(conteo_por_localidad_norm):
    """Candidatas a ser la misma localidad con un typo de un carácter (ej.
    "VILLA DOLORES" / "VILLLA DOLORES"). Se NO unifican acá: solo se
    devuelven para que el usuario confirme."""
    hallazgos = []
    for a, b, ratio in _pares_similares(conteo_por_localidad_norm, UMBRAL_SIMILITUD_TYPO_LOCALIDAD):
        hallazgos.append({
            "localidad_a": a, "filas_a": conteo_por_localidad_norm[a],
            "localidad_b": b, "filas_b": conteo_por_localidad_norm[b],
            "similitud": ratio,
        })
    return hallazgos


def _detectar_posibles_typos_nombres(apariciones_por_nombre, umbral=UMBRAL_SIMILITUD_TYPO_NOMBRES):
    """apariciones_por_nombre: {nombre: [contexto, ...]}, YA acotado a una
    sola localidad (nunca se cruzan nombres entre localidades distintas:
    ahí sí puede haber apellidos repetidos de personas distintas que no
    tienen nada que ver entre sí). Cada "contexto" es un dict con dónde
    apareció ese nombre (fecha + tipo_pregunta/cargo), para que el usuario
    pueda ir directo a revisar el caso. Misma lógica que
    _detectar_posibles_typos_localidad(): NO unifica, solo reporta."""
    hallazgos = []
    for a, b, ratio in _pares_similares(apariciones_por_nombre, umbral):
        hallazgos.append({
            "nombre_a": a, "apariciones_a": apariciones_por_nombre[a],
            "nombre_b": b, "apariciones_b": apariciones_por_nombre[b],
            "similitud": ratio,
        })
    return hallazgos


# ---------------------------------------------------------------------------
# Nombre de localidad "bonito" (grafía oficial de las 60, o Title Case)
# ---------------------------------------------------------------------------

def _cargar_grafia_oficial_60():
    """{localidad_normalizada: grafía_oficial} desde Localidades (1).xlsx —
    la misma fuente que ya usa el resto del proyecto para las 60 localidades
    prioritarias (ver cargar_localidades() en generar_datos.py). Esta
    sección NO se restringe a esas 60 (universo propio, ver cabecera del
    archivo) -> este diccionario se usa solo para tomar la grafía "bonita"
    (con tildes) cuando una localidad de acá coincide con una de las 60,
    nunca para filtrar ni excluir nada."""
    df = pd.read_excel(FUENTE_LOCALIDADES_60, sheet_name="Hoja1")
    oficial_por_norm = {}
    for loc in df["Localidad"]:
        oficial_por_norm.setdefault(normalizar(loc), str(loc).strip())
    return oficial_por_norm


# ---------------------------------------------------------------------------
# Carga principal
# ---------------------------------------------------------------------------

def cargar_encuestas_localidades():
    if not FUENTE.exists():
        raise RuntimeError(
            f"No se encontró {FUENTE}. Esta fuente no tiene glob de export fechado "
            "(a diferencia de SMS/GNO): se espera un único archivo BASE_MAESTRA_FINAL.xlsx en Contexto/."
        )

    df = pd.read_excel(FUENTE, sheet_name=HOJA)
    total_filas_leidas = len(df)

    conteo_tipo_pregunta = df["Tipo_Pregunta"].value_counts().to_dict()

    # Normalización de Localidad: mismo criterio que el resto del proyecto
    # (normalizar() de generar_datos.py -> NFKD sin diacríticos, upper,
    # espacios colapsados). Se agrupa por esta forma normalizada, que es
    # también la KEY del JSON de salida (no cambia). El nombre "bonito"
    # para mostrar (campo nombre_localidad) se resuelve aparte -> ver
    # CAMBIO 3 / _cargar_grafia_oficial_60() más abajo.
    df["_localidad_norm"] = df["Localidad"].apply(normalizar)

    conteo_por_localidad_norm = df.groupby("_localidad_norm").size().to_dict()
    posibles_typos_localidad = _detectar_posibles_typos_localidad(conteo_por_localidad_norm)

    # Un solo raw de Localidad por forma normalizada (verificado: en la
    # fuente real cada localidad normalizada tiene una única grafía cruda,
    # sin variantes) -> insumo del fallback Title Case de nombre_localidad.
    localidad_norm_a_raw = df.groupby("_localidad_norm")["Localidad"].first().apply(lambda s: str(s).strip()).to_dict()
    grafia_oficial_60 = _cargar_grafia_oficial_60()

    # Filas limpias (NaN -> None, numpy -> nativo) en orden original del
    # excel, ya con Fecha como 'YYYY-MM-DD'. Se arma como lista de dicts
    # una sola vez acá para no re-limpiar en cada paso siguiente.
    filas = []
    for _, row in df.iterrows():
        filas.append({
            "localidad_norm": row["_localidad_norm"],
            "fecha": fecha_iso(row["Fecha"]),
            "casos_totales": limpio(row["Casos_Totales"]),
            "tipo_pregunta": limpio(row["Tipo_Pregunta"]),
            "pregunta_normalizada": limpio(row["Pregunta_Normalizada"]),
            "escenario": limpio(row["Escenario"]),
            "dirigente": limpio(row["Dirigente"]),
            "nombre_obra": limpio(row["Nombre_Obra"]),
            "Categoria_Respuesta": limpio(row["Categoria_Respuesta"]),
            "Porcentaje": limpio(row["Porcentaje"]),
            "pregunta_original": limpio(row["Pregunta_Original"]),
            "Orden_Categoria": limpio(row["Orden_Categoria"]),
            "Categoria_Agrupada": limpio(row["Categoria_Agrupada"]),
            "Orden_Agrupada": limpio(row["Orden_Agrupada"]),
        })

    # --- Casos_Totales: un valor por (localidad, fecha) --------------------
    casos_totales_crudos = defaultdict(list)
    for f in filas:
        casos_totales_crudos[(f["localidad_norm"], f["fecha"])].append(f["casos_totales"])
    casos_totales_por_ronda, inconsistencias_casos_totales = _resolver_casos_totales(casos_totales_crudos)

    # --- Agrupar filas por (localidad, fecha) para armar cada ronda -------
    filas_por_ronda = defaultdict(list)
    for f in filas:
        filas_por_ronda[(f["localidad_norm"], f["fecha"])].append(f)

    colisiones_categorias = []
    colisiones_candidatos = []
    dirigentes_sin_nombre = []
    obras_sin_nombre_excluidas = []

    # Apariciones de nombre de Dirigente / candidato, acumuladas por
    # localidad a lo largo de TODAS sus rondas -> insumo de los detectores
    # de typos de nombre (CAMBIO 2). {localidad_norm: {nombre: [contexto,...]}}
    dirigente_apariciones_por_loc = defaultdict(lambda: defaultdict(list))
    candidato_apariciones_por_loc = defaultdict(lambda: defaultdict(list))

    localidades = {}
    for (localidad_norm, fecha), filas_ronda in filas_por_ronda.items():
        contexto_log_base = {"localidad": localidad_norm, "fecha": fecha}

        # 1) Imagen_Funcionario / Aprobacion / Reeleccion / Problemas ->
        # un solo dict "preguntas", agrupado por Pregunta_Normalizada (no
        # hay colisión de ese nombre entre estos 4 tipos, confirmado contra
        # la fuente real).
        simples = [f for f in filas_ronda if f["tipo_pregunta"] in TIPOS_PREGUNTA_SIMPLES]
        por_pregunta = defaultdict(list)
        for f in simples:
            por_pregunta[f["pregunta_normalizada"]].append(f)
        preguntas = {
            preg: _armar_categorias(fs, colisiones_categorias, {**contexto_log_base, "pregunta_normalizada": preg})
            for preg, fs in por_pregunta.items()
        }

        # 2) Obras -> array, cada obra con sus preguntas anidadas por
        # Pregunta_Normalizada (corrección del usuario: NO aplanar, una
        # obra puede tener más de una pregunta con categorías repetidas).
        # Nombre_Obra viene NULL en una porción de estas filas en la fuente
        # real (ver reporte) -> mismo criterio que Dirigentes_Locales sin
        # Dirigente: se EXCLUYEN del array (no hay nombre con el que armar
        # la entrada) y se registran en obras_sin_nombre_excluidas para
        # revisión manual. Ya NO se usa Pregunta_Original como fallback de
        # nombre (eso generaba entradas de "obra" artificiales -> se sacó a
        # pedido del usuario).
        obras_rows = [f for f in filas_ronda if f["tipo_pregunta"] == "Obras"]
        obras_por_nombre = {}
        orden_obras = []
        for f in obras_rows:
            if f["nombre_obra"] is None:
                obras_sin_nombre_excluidas.append({**contexto_log_base, "pregunta_original": f["pregunta_original"]})
                continue
            nombre = f["nombre_obra"]
            if nombre not in obras_por_nombre:
                obras_por_nombre[nombre] = defaultdict(list)
                orden_obras.append(nombre)
            obras_por_nombre[nombre][f["pregunta_normalizada"]].append(f)

        obras = []
        for nombre in orden_obras:
            preguntas_obra = {
                preg: _armar_categorias(
                    fs, colisiones_categorias,
                    {**contexto_log_base, "obra": nombre, "pregunta_normalizada": preg},
                )
                for preg, fs in obras_por_nombre[nombre].items()
            }
            obras.append({"nombre_obra": nombre, "preguntas": preguntas_obra})

        # 3) Dirigentes_Locales -> array, uno por Dirigente. ~7% de estas
        # filas en la fuente real no traen Dirigente (viene NULL, el nombre
        # quedó pegado en Pregunta_Original en su lugar, ver reporte) -> se
        # excluyen del array (no hay nombre con el que armar la entrada) y
        # se registran en dirigentes_sin_nombre para revisión manual, no se
        # descartan en silencio.
        dirigentes_rows = [f for f in filas_ronda if f["tipo_pregunta"] == "Dirigentes_Locales"]
        por_dirigente = defaultdict(list)
        orden_dirigentes = []
        for f in dirigentes_rows:
            if f["dirigente"] is None:
                dirigentes_sin_nombre.append({**contexto_log_base, "pregunta_original": f["pregunta_original"]})
                continue
            if f["dirigente"] not in por_dirigente:
                orden_dirigentes.append(f["dirigente"])
            por_dirigente[f["dirigente"]].append(f)

        # CAMBIO 2: una sola aparición por (dirigente, ronda) -> insumo del
        # detector de typos por localidad (ver _detectar_posibles_typos_nombres).
        # "origen" (CAMBIO 4) identifica el pool de procedencia cuando se
        # combina con nombres de candidato en el detector cruzado.
        for nombre_dirigente in orden_dirigentes:
            dirigente_apariciones_por_loc[localidad_norm][nombre_dirigente].append({"fecha": fecha, "origen": "dirigente"})

        dirigentes = [
            {
                "nombre": nombre,
                "categorias": _armar_categorias(
                    por_dirigente[nombre], colisiones_categorias, {**contexto_log_base, "dirigente": nombre}
                ),
            }
            for nombre in orden_dirigentes
        ]

        # 4) Candidatos_Gobernador -> dict por Escenario tal cual viene.
        gobernador_rows = [f for f in filas_ronda if f["tipo_pregunta"] == "Candidatos_Gobernador"]
        por_escenario_gob = defaultdict(list)
        orden_escenarios_gob = []
        for f in gobernador_rows:
            clave = f["escenario"] or "Escenario único"
            if clave not in por_escenario_gob:
                orden_escenarios_gob.append(clave)
            por_escenario_gob[clave].append(f)
        candidatos_gobernador = {
            esc: _armar_candidatos(fs, colisiones_candidatos, {**contexto_log_base, "escenario": esc, "cargo": "gobernador"})
            for esc, fs in ((e, por_escenario_gob[e]) for e in orden_escenarios_gob)
        }
        for esc, fs in por_escenario_gob.items():
            for cand in {f["Categoria_Respuesta"] for f in fs}:
                candidato_apariciones_por_loc[localidad_norm][cand].append(
                    {"fecha": fecha, "cargo": "gobernador", "escenario": esc, "origen": "candidato"}
                )

        # 5) Candidatos_Intendente -> CORRECCIÓN vs. el handoff original:
        # esta fuente real SÍ trae Escenario poblado para Candidatos_Intendente
        # (24 de 27 filas; ver reporte) -> se trata igual que
        # Candidatos_Gobernador (dict por Escenario), no como array plano.
        # Las filas sin Escenario (ronda de un solo escenario) van bajo la
        # clave "Escenario único".
        intendente_rows = [f for f in filas_ronda if f["tipo_pregunta"] == "Candidatos_Intendente"]
        por_escenario_int = defaultdict(list)
        orden_escenarios_int = []
        for f in intendente_rows:
            clave = f["escenario"] or "Escenario único"
            if clave not in por_escenario_int:
                orden_escenarios_int.append(clave)
            por_escenario_int[clave].append(f)
        candidatos_intendente = {
            esc: _armar_candidatos(fs, colisiones_candidatos, {**contexto_log_base, "escenario": esc, "cargo": "intendente"})
            for esc, fs in ((e, por_escenario_int[e]) for e in orden_escenarios_int)
        }
        for esc, fs in por_escenario_int.items():
            for cand in {f["Categoria_Respuesta"] for f in fs}:
                candidato_apariciones_por_loc[localidad_norm][cand].append(
                    {"fecha": fecha, "cargo": "intendente", "escenario": esc, "origen": "candidato"}
                )

        # 6) Otra -> array por Pregunta_Original.
        otras_rows = [f for f in filas_ronda if f["tipo_pregunta"] == "Otra"]
        por_pregunta_original = defaultdict(list)
        orden_otras = []
        for f in otras_rows:
            if f["pregunta_original"] not in por_pregunta_original:
                orden_otras.append(f["pregunta_original"])
            por_pregunta_original[f["pregunta_original"]].append(f)
        otras_preguntas = [
            {
                "pregunta_original": preg,
                "categorias": _armar_categorias(
                    por_pregunta_original[preg], colisiones_categorias, {**contexto_log_base, "pregunta_original": preg}
                ),
            }
            for preg in orden_otras
        ]

        ronda = {
            "fecha": fecha,
            "casos_totales": casos_totales_por_ronda.get((localidad_norm, fecha)),
            "preguntas": preguntas,
            "obras": obras,
            "dirigentes": dirigentes,
            "candidatos_gobernador": candidatos_gobernador,
            "candidatos_intendente": candidatos_intendente,
            "otras_preguntas": otras_preguntas,
        }

        localidades.setdefault(localidad_norm, []).append(ronda)

    # CAMBIO 3 (+ CAMBIO 5): nombre_localidad -> grafía oficial de las 60 si
    # matchea; si no, el raw de BASE_MAESTRA_FINAL.xlsx pasado a upper().
    # Ya NO se usa Title Case en el fallback (CAMBIO 5): Localidades (1).xlsx
    # también guarda sus 60 en ALL CAPS sin tildes, así que Title Case solo
    # en el fallback dejaba a esas 3 localidades con un estilo distinto
    # (mixto) al de las otras 21 (mayúscula) -> ahora las 24 quedan
    # consistentes en mayúscula, con tilde si el raw de la fuente la trae.
    localidades_matcheadas_60 = {}
    localidades_fallback_upper = {}
    for localidad_norm in localidades:
        if localidad_norm in grafia_oficial_60:
            localidades_matcheadas_60[localidad_norm] = grafia_oficial_60[localidad_norm]
        else:
            localidades_fallback_upper[localidad_norm] = localidad_norm_a_raw.get(localidad_norm, localidad_norm).upper()

    salida = {}
    for localidad_norm, rondas in localidades.items():
        rondas_ordenadas = sorted(rondas, key=lambda r: r["fecha"] or "")
        nombre_bonito = localidades_matcheadas_60.get(localidad_norm) or localidades_fallback_upper[localidad_norm]
        salida[localidad_norm] = {
            "nombre_localidad": nombre_bonito,
            "cantidad_rondas": len(rondas_ordenadas),
            "tiene_comparativo": len(rondas_ordenadas) > 1,
            "rondas": rondas_ordenadas,
        }

    # CAMBIO 2: typos de nombre de Dirigente / candidato, DENTRO de cada
    # localidad por separado (nunca se cruzan nombres entre localidades
    # distintas). Candidatos_Gobernador y Candidatos_Intendente se tratan
    # JUNTOS (mismo pool de nombres por localidad, distinguibles por el
    # campo "cargo" en cada aparición) -> decisión tomada por simplicidad,
    # ver reporte.
    posibles_typos_dirigentes = []
    for localidad_norm, apariciones in dirigente_apariciones_por_loc.items():
        for hallazgo in _detectar_posibles_typos_nombres(apariciones):
            posibles_typos_dirigentes.append({"localidad": localidad_norm, **hallazgo})

    posibles_typos_candidatos = []
    for localidad_norm, apariciones in candidato_apariciones_por_loc.items():
        for hallazgo in _detectar_posibles_typos_nombres(apariciones):
            posibles_typos_candidatos.append({"localidad": localidad_norm, **hallazgo})

    # CAMBIO 4: detector ADICIONAL (no reemplaza a los dos de arriba) sobre
    # el pool COMBINADO dirigente + candidato de cada localidad. Necesario
    # porque los dos casos reales que motivaron CAMBIO 2 cruzan categoría
    # ("Fernando Rambaldi" en Dirigentes_Locales vs "Fernando Ramdaldi" en
    # Candidatos_Intendente) -> (a) y (b) por separado nunca los iban a
    # detectar, cada aparición ya trae "origen" (dirigente/candidato) para
    # que el hallazgo muestre de qué pool viene cada nombre comparado.
    posibles_typos_cruzados_dirigente_candidato = []
    localidades_con_nombres = set(dirigente_apariciones_por_loc) | set(candidato_apariciones_por_loc)
    for localidad_norm in localidades_con_nombres:
        apariciones_combinadas = defaultdict(list)
        for nombre, aps in dirigente_apariciones_por_loc.get(localidad_norm, {}).items():
            apariciones_combinadas[nombre].extend(aps)
        for nombre, aps in candidato_apariciones_por_loc.get(localidad_norm, {}).items():
            apariciones_combinadas[nombre].extend(aps)
        for hallazgo in _detectar_posibles_typos_nombres(apariciones_combinadas):
            posibles_typos_cruzados_dirigente_candidato.append({"localidad": localidad_norm, **hallazgo})

    auditoria = {
        "total_filas_leidas": total_filas_leidas,
        "localidades_unicas": len(conteo_por_localidad_norm),
        "conteo_tipo_pregunta": conteo_tipo_pregunta,
        "inconsistencias_casos_totales": inconsistencias_casos_totales,
        "posibles_typos_localidad": posibles_typos_localidad,
        "posibles_typos_dirigentes": posibles_typos_dirigentes,
        "posibles_typos_candidatos": posibles_typos_candidatos,
        "posibles_typos_cruzados_dirigente_candidato": posibles_typos_cruzados_dirigente_candidato,
        "colisiones_categorias": colisiones_categorias,
        "colisiones_candidatos": colisiones_candidatos,
        "dirigentes_sin_nombre": dirigentes_sin_nombre,
        "obras_sin_nombre_excluidas": obras_sin_nombre_excluidas,
        "localidades_matcheadas_60": localidades_matcheadas_60,
        "localidades_fallback_upper": localidades_fallback_upper,
        "escenario_poblado_candidatos_intendente": int(sum(1 for f in filas if f["tipo_pregunta"] == "Candidatos_Intendente" and f["escenario"] is not None)),
        "escenario_total_candidatos_intendente": int(sum(1 for f in filas if f["tipo_pregunta"] == "Candidatos_Intendente")),
    }

    return salida, auditoria


def _imprimir_reporte(auditoria):
    print(f"  Encuestas de Localidades: {auditoria['total_filas_leidas']} filas leídas, "
          f"{auditoria['localidades_unicas']} localidades únicas (normalizadas)")

    dif_filas = auditoria["total_filas_leidas"] - REFERENCIA_CORRIDA_ANTERIOR["total_filas"]
    dif_locs = auditoria["localidades_unicas"] - REFERENCIA_CORRIDA_ANTERIOR["localidades_unicas"]
    if dif_filas or dif_locs:
        print(f"  ⚠️  Cambió respecto a la corrida anterior de este script: "
              f"{REFERENCIA_CORRIDA_ANTERIOR['total_filas']} -> {auditoria['total_filas_leidas']} filas "
              f"({dif_filas:+d}), {REFERENCIA_CORRIDA_ANTERIOR['localidades_unicas']} -> {auditoria['localidades_unicas']} "
              f"localidades ({dif_locs:+d})")
    else:
        print(f"  Igual que la corrida anterior de este script ({REFERENCIA_CORRIDA_ANTERIOR['total_filas']} filas, "
              f"{REFERENCIA_CORRIDA_ANTERIOR['localidades_unicas']} localidades) -> la fuente no cambió.")

    print("  Conteo por Tipo_Pregunta (vs. referencia de una versión anterior):")
    for tipo, referencia in REFERENCIA_CONTEO_TIPO_PREGUNTA.items():
        actual = auditoria["conteo_tipo_pregunta"].get(tipo, 0)
        marca = "  ⚠️ DIFERENCIA GRANDE" if abs(actual - referencia) > referencia * 0.3 else ""
        print(f"    {tipo}: {actual} (referencia: {referencia}){marca}")
    tipos_nuevos = set(auditoria["conteo_tipo_pregunta"]) - set(REFERENCIA_CONTEO_TIPO_PREGUNTA)
    if tipos_nuevos:
        print(f"  ⚠️  Tipo_Pregunta no visto en la referencia: {sorted(tipos_nuevos)}")

    if auditoria["inconsistencias_casos_totales"]:
        print(f"  ⚠️  Casos_Totales con más de un valor distinto en {len(auditoria['inconsistencias_casos_totales'])} ronda(s) "
              "(resuelto por moda; empate -> máximo):")
        for inc in auditoria["inconsistencias_casos_totales"]:
            print(f"    {inc['localidad']} / {inc['fecha']}: valores vistos {inc['valores_vistos']} -> elegido {inc['valor_elegido']}")
    else:
        print("  Casos_Totales: sin inconsistencias (un solo valor por Localidad+Fecha en toda la fuente)")

    if auditoria["posibles_typos_localidad"]:
        print(f"  ⚠️  Posibles typos/duplicados de Localidad (NO unificados, quedan separados en el JSON):")
        for h in auditoria["posibles_typos_localidad"]:
            print(f"    {h['localidad_a']!r} ({h['filas_a']} filas) vs {h['localidad_b']!r} ({h['filas_b']} filas) -> similitud {h['similitud']}")
    else:
        print("  Sin posibles typos de Localidad detectados (umbral de similitud "
              f"{UMBRAL_SIMILITUD_TYPO_LOCALIDAD})")

    print(f"  Candidatos_Intendente: Escenario poblado en {auditoria['escenario_poblado_candidatos_intendente']}/"
          f"{auditoria['escenario_total_candidatos_intendente']} filas -> tratado como dict por Escenario "
          "(igual que Candidatos_Gobernador), NO como array plano del handoff original.")

    if auditoria["colisiones_categorias"]:
        print(f"  ⚠️  {len(auditoria['colisiones_categorias'])} colisión(es) categoría/pct dentro de un mismo grupo "
              "(se conservó el primer valor visto, ver detalle abajo):")
        for c in auditoria["colisiones_categorias"]:
            print(f"    {c}")

    if auditoria["colisiones_candidatos"]:
        print(f"  ⚠️  {len(auditoria['colisiones_candidatos'])} colisión(es) candidato/pct dentro de un mismo escenario "
              "(se conservó el primer valor visto, ver detalle abajo):")
        for c in auditoria["colisiones_candidatos"]:
            print(f"    {c}")

    if auditoria["dirigentes_sin_nombre"]:
        print(f"  ⚠️  {len(auditoria['dirigentes_sin_nombre'])} fila(s) de Dirigentes_Locales sin Dirigente (nombre "
              "quedó pegado en Pregunta_Original) -> excluidas del array 'dirigentes', ver detalle abajo:")
        for d in auditoria["dirigentes_sin_nombre"]:
            print(f"    {d}")

    if auditoria["obras_sin_nombre_excluidas"]:
        print(f"  ⚠️  {len(auditoria['obras_sin_nombre_excluidas'])} fila(s) de Obras sin Nombre_Obra -> excluidas del "
              "array 'obras' (mismo criterio que Dirigentes_Locales sin Dirigente), ver detalle abajo:")
        for o in auditoria["obras_sin_nombre_excluidas"]:
            print(f"    {o}")
    else:
        print("  Obras: todas las filas traen Nombre_Obra, ninguna excluida.")

    if auditoria["posibles_typos_dirigentes"]:
        print(f"  ⚠️  {len(auditoria['posibles_typos_dirigentes'])} posible(s) typo de nombre de Dirigente DENTRO de "
              "una misma localidad (NO unificados, ver detalle abajo):")
        for h in auditoria["posibles_typos_dirigentes"]:
            print(f"    {h}")
    else:
        print(f"  Sin posibles typos de nombre de Dirigente detectados dentro de una misma localidad "
              f"(umbral {UMBRAL_SIMILITUD_TYPO_NOMBRES})")

    if auditoria["posibles_typos_candidatos"]:
        print(f"  ⚠️  {len(auditoria['posibles_typos_candidatos'])} posible(s) typo de nombre de candidato "
              "(Candidatos_Gobernador + Candidatos_Intendente juntos) DENTRO de una misma localidad "
              "(NO unificados, ver detalle abajo):")
        for h in auditoria["posibles_typos_candidatos"]:
            print(f"    {h}")
    else:
        print(f"  Sin posibles typos de nombre de candidato detectados dentro de una misma localidad "
              f"(umbral {UMBRAL_SIMILITUD_TYPO_NOMBRES})")

    if auditoria["posibles_typos_cruzados_dirigente_candidato"]:
        print(f"  ⚠️  {len(auditoria['posibles_typos_cruzados_dirigente_candidato'])} posible(s) typo CRUZADO "
              "dirigente↔candidato (mismo pool combinado) DENTRO de una misma localidad (NO unificados, ver detalle abajo):")
        for h in auditoria["posibles_typos_cruzados_dirigente_candidato"]:
            print(f"    {h}")
    else:
        print(f"  Sin posibles typos cruzados dirigente↔candidato detectados dentro de una misma localidad "
              f"(umbral {UMBRAL_SIMILITUD_TYPO_NOMBRES})")

    print(f"  nombre_localidad: {len(auditoria['localidades_matcheadas_60'])} matchearon grafía oficial de las 60 "
          f"-> {len(auditoria['localidades_fallback_upper'])} con fallback upper() sobre el raw de la fuente:")
    for norm, nombre in auditoria["localidades_fallback_upper"].items():
        print(f"    {norm!r} -> {nombre!r} (upper() del raw, no está en las 60)")


def main():
    print("Generando Encuestas de Localidades...")
    salida, auditoria = cargar_encuestas_localidades()
    escribir_json("encuestas_localidades.json", salida)
    _imprimir_reporte(auditoria)

    # No se tuvo acceso al encuestas_metadata.json real del proyecto
    # tablero-electoral para espejarlo -> se deja constancia acá y en el
    # reporte. Solo se genera el campo pedido explícitamente por el usuario.
    escribir_json("localidades_metadata.json", {"umbral_variacion_pp": 2.5})
    print("  localidades_metadata.json: generado con el campo mínimo pedido "
          "(no se pudo comparar contra encuestas_metadata.json del proyecto tablero-electoral -> sin acceso a ese archivo)")

    print("Listo.")


if __name__ == "__main__":
    main()
