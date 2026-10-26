#!/usr/bin/env python3
"""
Test de regresión del matching de Pauta Digital contra Localidad/Departamento.

Nace de un bug real: piezas de Pauta Digital aparecían en paneles de
Localidad a las que no correspondían (una con Alcance_Detectado=PROVINCIA
colándose en Alta Gracia, otra de Anisacate —Alcance_Detectado=OTRO, ni
siquiera una de las 60 localidades oficiales— también en Alta Gracia). La
causa era que el filtro por Localidad comparaba texto crudo sin mirar
Alcance_Detectado/alcance_tipo — concretamente, filas OTRO de barrios sueltos
de Córdoba (Valle Escondido, Parque Latino, etc.) cuya columna Localidad
decía "CORDOBA" quedaban marcadas en_60_localidades=True y se colaban en el
panel de la propia Córdoba (ver CASO 6 más abajo). El fix vive en:
  - scripts/generar_datos.py: clasificar_alcance_historico() (en_60_localidades
    y alcance_tipo a partir de Alcance_Detectado, no de texto libre).
  - pages/localidades/[localidad].js: filtro piezasPauta.
  - pages/localidades/index.js: cálculo de pautaPorLocalidad.

Actualización posterior: se eliminó por completo la excepción de "Pauta
Digital se muestra también a nivel Departamento". Nueva regla, sin
excepciones: una pieza se atribuye a una Localidad SOLO si su Localidad
puntual es una de las 60. Alcance_Detectado=DEPARTAMENTO ya no propaga
en_60_localidades=True a ninguna Localidad (ver CASO 4, invertido).

Actualización 26/10/2026 (reglas D1-D7 del manual metodológico): la fuente
nueva ya no tiene ámbito departamento (D1: lo que no es una de las 60, un
circuito de Capital o TODAS LAS LOCALIDADES con alguna de las 60 queda fuera),
alias VILLA SANTA ROSA DE RIO (D2), COD. CONTENIDO solo informativo (D3),
clave de duplicados D4 con desempate B2, freno de bajas por campaña + título
(D5 + B1) y fecha de control por PD_FECHA_CONTROL. Casos 7-11 y 15-21.

Cualquier cambio futuro a la lógica de alcance_detectado / alcance_tipo /
en_60_localidades (en generar_datos.py o en los dos archivos de pages/
listados arriba) DEBE correr este test antes de mergear:

    python3 scripts/test_pauta_digital.py

Nota de diseño: los primeros 5 casos referencian códigos de pieza puntuales
del histórico (Medios Digitales.xlsx). Todos tienen Finalización posterior a
CORTE_HISTORICO_PAUTA_DIGITAL, así que cargar_pauta_digital_historico() ya
NO los incluye en data/pauta_digital.json (quedaron cubiertos por la fuente
nueva, Pauta RRSS_GLOBAL.xlsx) — ni ese JSON ni cargar_pauta_digital_historico()
sirven para probarlos. La regla de atribución geográfica que este test
verifica es independiente de ese corte por fecha, así que en vez de eso el
test lee el excel fuente directamente y llama a clasificar_alcance_historico(),
la misma función pura que usa la generación real (única fuente de verdad,
no una copia que se pueda desincronizar).
"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generar_datos as g  # noqa: E402

FALLAS = []


def fallar(caso, mensaje):
    FALLAS.append(f"[{caso}] {mensaje}")


def cargar_df_historico():
    return pd.read_excel(g.CONTEXTO / "Medios Digitales.xlsx", sheet_name="Pauta Digital Curada")


def fila_por_codigo(df, codigo):
    """Busca la única fila cuyo 'Nombre del anuncio' contiene `codigo`."""
    coincidencias = df[df["Nombre del anuncio"].astype(str).str.contains(codigo, na=False)]
    if len(coincidencias) == 0:
        raise AssertionError(f"No se encontró ninguna fila con el código {codigo!r} en Medios Digitales.xlsx")
    if len(coincidencias) > 1:
        raise AssertionError(f"El código {codigo!r} matchea {len(coincidencias)} filas, se esperaba 1 sola")
    return coincidencias.iloc[0]


def filas_por(df, alcance_detectado, columna, valor):
    """Todas las filas con Alcance_Detectado y una columna geográfica dados
    (comparación normalizada: sin tildes/mayúsculas)."""
    col = "Alcance_Detectado (auditoría)"
    mask = (df[col] == alcance_detectado) & (
        df[columna].apply(lambda v: g.normalizar(v) == g.normalizar(valor))
    )
    filas = df[mask]
    if len(filas) == 0:
        raise AssertionError(
            f"No se encontró ninguna fila con Alcance_Detectado={alcance_detectado!r} "
            f"y {columna}={valor!r} en Medios Digitales.xlsx"
        )
    return filas


def clasificar_fila(row, claves_60):
    """Reproduce lo que arma cargar_pauta_digital_historico() para una fila,
    saltando el filtro por Finalización/CORTE_HISTORICO_PAUTA_DIGITAL (ver
    nota de diseño arriba)."""
    alcance_detectado = g.limpio(row["Alcance_Detectado (auditoría)"])
    depto = g.limpio(row["Departamento"])
    loc = g.limpio(row["Localidad"])
    en_60, alcance_tipo = g.clasificar_alcance_historico(alcance_detectado, depto, loc, claves_60)
    return {
        "nombre_anuncio": g.limpio(row["Nombre del anuncio"]),
        "alcance_detectado": alcance_detectado,
        "alcance_tipo": alcance_tipo,
        "en_60_localidades": en_60,
        "departamento": depto,
        "localidad": loc,
    }


def aplica_a_localidad(pieza, localidad, departamento):
    """Replica EXACTAMENTE la regla de atribución de pages/localidades/[localidad].js
    (piezasPauta) y pages/localidades/index.js (pautaPorLocalidad). Sin excepciones:
    una pieza se atribuye a una Localidad SOLO si su Localidad puntual es una de las
    60 y coincide con `localidad` — nunca por Departamento en común. Si tocás el
    filtro en esos archivos, actualizá esta función en paralelo."""
    if not pieza["en_60_localidades"]:
        return False
    return pieza["alcance_tipo"] == "localidad" and g.normalizar(pieza["localidad"]) == g.normalizar(localidad)


def caso_1_provincia_no_se_atribuye(df, claves_60):
    caso = "CASO 1 - PROVINCIA"
    pieza = clasificar_fila(fila_por_codigo(df, "A05817"), claves_60)

    if pieza["alcance_detectado"] != "PROVINCIA":
        fallar(caso, f"esperaba alcance_detectado=PROVINCIA, salió {pieza['alcance_detectado']!r}")
    if pieza["alcance_tipo"] != "provincia":
        fallar(caso, f"esperaba alcance_tipo=provincia, salió {pieza['alcance_tipo']!r}")
    if aplica_a_localidad(pieza, "ALTA GRACIA", "SANTA MARIA"):
        fallar(caso, f"{pieza['nombre_anuncio']!r} (PROVINCIA) aparece en Alta Gracia y no debería")


def caso_2_otro_no_se_atribuye(df, claves_60):
    caso = "CASO 2 - OTRO"
    pieza = clasificar_fila(fila_por_codigo(df, "A05860"), claves_60)

    if pieza["alcance_detectado"] != "OTRO":
        fallar(caso, f"esperaba alcance_detectado=OTRO, salió {pieza['alcance_detectado']!r}")
    if pieza["alcance_tipo"] is not None:
        fallar(caso, f"esperaba alcance_tipo=None (OTRO ausente de ALCANCE_A_TIPO), salió {pieza['alcance_tipo']!r}")
    if pieza["en_60_localidades"] is not False:
        fallar(caso, f"esperaba en_60_localidades=False, salió {pieza['en_60_localidades']!r}")
    if aplica_a_localidad(pieza, "ALTA GRACIA", "SANTA MARIA"):
        fallar(caso, f"{pieza['nombre_anuncio']!r} (OTRO, Anisacate) aparece en Alta Gracia y no debería")
    if aplica_a_localidad(pieza, "MALAGUEÑO", "SANTA MARIA"):
        fallar(caso, f"{pieza['nombre_anuncio']!r} (OTRO, Anisacate) aparece en Malagueño y no debería")


def caso_3_localidad_solo_en_su_localidad(df, claves_60):
    caso = "CASO 3 - LOCALIDAD puntual"
    pieza = clasificar_fila(fila_por_codigo(df, "A05834"), claves_60)

    if pieza["alcance_tipo"] != "localidad":
        fallar(caso, f"esperaba alcance_tipo=localidad, salió {pieza['alcance_tipo']!r}")
    if pieza["en_60_localidades"] is not True:
        fallar(caso, f"esperaba en_60_localidades=True, salió {pieza['en_60_localidades']!r}")
    if not aplica_a_localidad(pieza, "SALDAN", "COLON"):
        fallar(caso, f"{pieza['nombre_anuncio']!r} (LOCALIDAD=Saldán) no aparece en Saldán y debería")
    if aplica_a_localidad(pieza, "VILLA ALLENDE", "COLON"):
        fallar(
            caso,
            f"{pieza['nombre_anuncio']!r} (LOCALIDAD=Saldán) aparece en Villa Allende "
            "(mismo depto, otra localidad) y no debería",
        )


def caso_4_departamento_no_se_propaga(df, claves_60):
    """OBSOLETO desde el cambio "sin excepción de Departamento": antes este
    caso verificaba que una fila DEPARTAMENTO=SANTA MARIA se propagara a
    Alta Gracia y Malagüeño (mismo depto). La regla se invirtió: ahora
    Alcance_Detectado=DEPARTAMENTO nunca da en_60_localidades=True, así que
    esas filas no se atribuyen a NINGUNA Localidad, ni siquiera a las de su
    propio Departamento."""
    caso = "CASO 4 - DEPARTAMENTO NO se propaga"
    filas = filas_por(df, "DEPARTAMENTO", "Departamento", "SANTA MARIA")
    for _, row in filas.iterrows():
        pieza = clasificar_fila(row, claves_60)
        if pieza["alcance_tipo"] != "departamento":
            fallar(caso, f"{pieza['nombre_anuncio']!r}: esperaba alcance_tipo=departamento, salió {pieza['alcance_tipo']!r}")
            continue
        if pieza["en_60_localidades"] is not False:
            fallar(
                caso,
                f"{pieza['nombre_anuncio']!r} (DEPARTAMENTO=Santa María) "
                f"esperaba en_60_localidades=False, salió {pieza['en_60_localidades']!r}",
            )
            continue
        if aplica_a_localidad(pieza, "ALTA GRACIA", "SANTA MARIA"):
            fallar(caso, f"{pieza['nombre_anuncio']!r} (DEPARTAMENTO=Santa María) aparece en Alta Gracia y no debería")
        if aplica_a_localidad(pieza, "MALAGUEÑO", "SANTA MARIA"):
            fallar(caso, f"{pieza['nombre_anuncio']!r} (DEPARTAMENTO=Santa María) aparece en Malagueño y no debería")


def caso_6_otro_barrio_cordoba_no_se_atribuye(df, claves_60):
    """No es uno de los 5 casos pedidos, pero es el ÚNICO de los seis que
    efectivamente distingue el código viejo (buggy) del nuevo: confirmado
    mockeando la fórmula pre-fix de en_60/alcance_tipo y viendo que los otros
    5 casos siguen pasando igual (Anisacate/Freyre nunca calzan con el texto
    de ninguna de las 60, así que ambas fórmulas ya daban en_60=False para
    esos códigos puntuales; PROVINCIA y DEPARTAMENTO ya estaban bien guardados
    en el filtro del frontend antes del fix). El leak real que arreglamos
    —y que este caso reproduce— eran filas Alcance_Detectado=OTRO de barrios
    sueltos de Córdoba (Valle Escondido, Parque Latino, etc.) cuya columna
    Localidad crudamente decía "CORDOBA": bajo la lógica vieja, esa igualdad
    de texto alcanzaba para marcarlas en_60_localidades=True y colarlas en el
    panel de la propia Córdoba."""
    caso = "CASO 6 - OTRO con Localidad=CORDOBA"
    filas = filas_por(df, "OTRO", "Localidad", "CORDOBA")
    for _, row in filas.iterrows():
        pieza = clasificar_fila(row, claves_60)
        if pieza["en_60_localidades"] is not False:
            fallar(
                caso,
                f"{pieza['nombre_anuncio']!r} (OTRO, Localidad=CORDOBA) "
                f"esperaba en_60_localidades=False, salió {pieza['en_60_localidades']!r}",
            )
            continue
        if aplica_a_localidad(pieza, "CORDOBA", "CAPITAL"):
            fallar(caso, f"{pieza['nombre_anuncio']!r} (OTRO, Localidad=CORDOBA) aparece en Córdoba y no debería")


def _mapas_oficiales(localidades):
    """Replica los mapas que arma main() en generar_datos.py para resolver
    Pauta RRSS_GLOBAL a forma oficial — ver scripts/generar_datos.py."""
    localidad_a_oficial = {}
    localidad_a_departamento_oficial = {}
    departamento_a_localidades_normalizadas = {}
    for loc in localidades:
        n_loc = g.normalizar(loc["localidad"])
        n_depto = g.normalizar(loc["departamento"])
        localidad_a_oficial[n_loc] = loc["localidad"]
        localidad_a_departamento_oficial[n_loc] = loc["departamento"]
        departamento_a_localidades_normalizadas.setdefault(n_depto, []).append(n_loc)
    return localidad_a_oficial, localidad_a_departamento_oficial, departamento_a_localidades_normalizadas


PROV = "PROVINCIA DE CÓRDOBA, ARGENTINA"


def _geo(localidades, depto, loc):
    l2o, _, d2l = _mapas_oficiales(localidades)
    return g.clasificar_geografia_pauta_global(depto, loc, set(l2o), d2l)


def caso_7_todas_las_localidades_con_departamento_se_expande(localidades, claves_60):
    """"TODAS LAS LOCALIDADES" + un Departamento puntual (no la provincia
    entera) debe expandirse a una pieza por cada Localidad de las 60 que cae
    en ese Departamento, con localidad_asignada seteada explícitamente."""
    caso = "CASO 7 - TODAS LAS LOCALIDADES + Departamento puntual"
    l2o, l2d, _ = _mapas_oficiales(localidades)
    geo = _geo(localidades, "DEPARTAMENTO RIO CUARTO, " + PROV, "TODAS LAS LOCALIDADES")
    if geo.get("ambito") != "localidad_multiple" or geo.get("sub_ambito") != "multiple_depto":
        fallar(caso, f"esperaba localidad_multiple/multiple_depto, salió {geo!r}")
        return
    asignaciones = g._asignaciones_geograficas(geo, l2o, l2d)
    localidades_out = sorted(a["localidad"] for a in asignaciones)
    if localidades_out != ["RIO CUARTO", "VICUÑA MACKENNA"]:
        fallar(caso, f"esperaba ['RIO CUARTO', 'VICUÑA MACKENNA'], salió {localidades_out!r}")
    for a in asignaciones:
        if a["localidad_asignada"] != a["localidad"]:
            fallar(caso, f"localidad_asignada ({a['localidad_asignada']!r}) debería ser igual a localidad ({a['localidad']!r})")


def caso_8_todas_las_localidades_provincia_entera_se_expande_a_las_60(localidades, claves_60):
    """"TODAS LAS LOCALIDADES" SIN Departamento puntual -> las 60 completas
    (multiple_provincia), métricas replicadas sin prorratear."""
    caso = "CASO 8 - TODAS LAS LOCALIDADES, provincia entera -> se expande a las 60"
    l2o, l2d, _ = _mapas_oficiales(localidades)
    geo = _geo(localidades, PROV, "TODAS LAS LOCALIDADES")
    if geo.get("sub_ambito") != "multiple_provincia" or set(geo.get("localidades", [])) != set(l2o):
        fallar(caso, f"esperaba multiple_provincia con las 60, salió {geo.get('sub_ambito')!r}")
        return
    if len(g._asignaciones_geograficas(geo, l2o, l2d)) != len(l2o):
        fallar(caso, "esperaba una asignación por cada una de las 60")


def _entrada(clave_extra=None, **kw):
    """Entrada sintética con la clave D4 armada por clave_dedup_pauta_global()."""
    base = dict(campana="Campaña X", titulo="Spot 1", plataforma="Meta", localidad="RIO CUARTO",
                inicio="2026-10-01", fin="2026-10-31", link="https://drive.google.com/x", tipo="REEL", audiencia="30 a 60")
    base.update(clave_extra or {})
    pieza = {
        "_dedup_clave": g.clave_dedup_pauta_global(
            base["campana"], base["titulo"], base["plataforma"], base["localidad"], base["inicio"], base["fin"],
            base["link"], base["tipo"], base["audiencia"]),
        "_dedup_dirigida": True, "_dedup_fecha_envio_ts": None, "_dedup_estado_activo": False,
    }
    pieza.update(kw)
    return pieza


def caso_9_dedup_clave_d4():
    """D4 (26/10/2026): misma pieza si coinciden CAMPAÑA, TITULO, PLATAFORMA,
    localidad asignada, INICIO, FIN, LINK MATERIAL, TIPO DE MATERIAL y
    AUDIENCIA, normalizados (espacios, mayúsculas, tildes); vacío = vacío.
    COD. CONTENIDO no entra (D3)."""
    caso = "CASO 9 - clave de duplicados D4"
    iguales = [
        ("idéntica", {}),
        ("normalización: espacios/mayúsculas/tildes", {"campana": "  CAMPAÑA   x ", "titulo": "spot 1", "plataforma": "META",
                                                        "tipo": " reel", "audiencia": "30  A 60"}),
        ("normalización: tildes", {"campana": "Campana X"}),
    ]
    for nombre, cambio in iguales:
        res, desc = g._dedup_pauta_global([_entrada(cod_contenido="A1"), _entrada(cambio, cod_contenido="A2")])
        if len(desc) != 1:
            fallar(caso, f"({nombre}) esperaba 1 descartada aunque los COD difieran, salió {len(desc)}")
    for campo, valor in [("campana", "Otra"), ("titulo", "Spot 2"), ("plataforma", "Youtube"), ("localidad", "VICUÑA MACKENNA"),
                         ("inicio", "2026-10-02"), ("fin", "2026-11-01"), ("link", "https://drive.google.com/y"),
                         ("tipo", "CARRUSEL"), ("audiencia", "18 a 30")]:
        res, desc = g._dedup_pauta_global([_entrada(), _entrada({campo: valor})])
        if desc:
            fallar(caso, f"un {campo} distinto no debía unificar, salió {len(desc)} descartada(s)")
    vacias = dict(link=None, tipo=None, audiencia=None)
    res, desc = g._dedup_pauta_global([_entrada(vacias), _entrada(dict(link="", tipo=float("nan"), audiencia="  "))])
    if len(desc) != 1:
        fallar(caso, f"vacío debía coincidir con vacío (None, '', NaN, espacios), salió {len(desc)} descartada(s)")
    res, desc = g._dedup_pauta_global([_entrada(vacias), _entrada()])
    if desc:
        fallar(caso, "vacío no debía coincidir con un valor cargado")
    a, b = _entrada(), _entrada()
    a["inversion"] = 100; b["inversion"] = 50
    res, desc = g._dedup_pauta_global([a, b])
    if len(res) != 1 or res[0]["inversion"] != 100:
        fallar(caso, f"las métricas nunca se suman: esperaba conservar la primera tal cual, salió {res}")


def caso_10_dedup_gana_fecha_envio_mas_reciente():
    """Entre entradas con la misma clave D4 (las dos dirigidas), gana la de
    FECHA DE ENVÍO más reciente, sin importar el orden."""
    caso = "CASO 10 - dedup gana FECHA DE ENVÍO más reciente"
    vieja = _entrada(_dedup_fecha_envio_ts=pd.Timestamp("2026-08-14"), plataforma_cruda="vieja")
    nueva = _entrada(_dedup_fecha_envio_ts=pd.Timestamp("2026-08-20"), plataforma_cruda="nueva")
    for orden, piezas in (("vieja primero", [vieja, nueva]), ("nueva primero", [nueva, vieja])):
        res, desc = g._dedup_pauta_global([dict(p) for p in piezas])
        if len(res) != 1 or res[0]["plataforma_cruda"] != "nueva":
            fallar(caso, f"({orden}) esperaba que gane la del 20/08, salió {res}")
        if g.motivo_desempate(res[0], desc[0][0]) != "FECHA DE ENVÍO más reciente":
            fallar(caso, f"({orden}) motivo inesperado {g.motivo_desempate(res[0], desc[0][0])!r}")


def caso_11_dedup_tiebreak_estado_activo():
    """Empate en FECHA DE ENVÍO -> gana ESTADO=ACTIVO; si sigue el empate,
    la primera de la planilla."""
    caso = "CASO 11 - dedup tiebreak ESTADO=ACTIVO y primera de la planilla"
    inactiva = _entrada(_dedup_estado_activo=False, marca="inactiva")
    activa = _entrada(_dedup_estado_activo=True, marca="activa")
    for orden, piezas in (("inactiva primero", [inactiva, activa]), ("activa primero", [activa, inactiva])):
        res, _ = g._dedup_pauta_global([dict(p) for p in piezas])
        if len(res) != 1 or res[0]["marca"] != "activa":
            fallar(caso, f"({orden}) esperaba que gane la ACTIVO, salió {res}")
    res, desc = g._dedup_pauta_global([_entrada(marca="primera"), _entrada(marca="segunda")])
    if res[0]["marca"] != "primera" or g.motivo_desempate(res[0], desc[0][0]) != "primera de la planilla":
        fallar(caso, "en empate total debía quedar la primera de la planilla")


def caso_15_d1_universo(localidades, claves_60):
    """D1: entran localidad de las 60, circuito de Capital, TODAS + depto con
    alguna de las 60 y TODAS + provincia; sale todo lo demás, con motivo."""
    caso = "CASO 15 - D1 universo"
    esperados = [
        (PROV, "FREYRE, DEPARTAMENTO SAN JUSTO, " + PROV, "localidad_fuera_de_las_60"),
        ("DEPARTAMENTO SAN JUSTO, " + PROV, "BRINKMANN, DEPARTAMENTO SAN JUSTO", "localidad_fuera_de_las_60"),
        ("DEPARTAMENTO CAPITAL, " + PROV, "Todas las localidades", "localidad_fuera_de_las_60"),
        ("DEPARTAMENTO CAPITAL, " + PROV, "10 - CENTRO", "localidad_fuera_de_las_60"),
        ("DEPARTAMENTO INVENTADO, " + PROV, "TODAS LAS LOCALIDADES", "departamento_sin_localidades_de_las_60"),
        ("Provincia de Santa Fe", "ROSARIO", "fuera_de_cordoba"),
        ("DEPARTAMENTO CAPITAL, " + PROV, None, "pendiente_sin_localidad"),
        ("DEPARTAMENTO CAPITAL, " + PROV, "   ", "pendiente_sin_localidad"),
    ]
    for depto, loc, motivo in esperados:
        geo = _geo(localidades, depto, loc)
        if not geo["excluida"] or geo.get("motivo") != motivo:
            fallar(caso, f"({depto!r}, {loc!r}) esperaba fuera por {motivo}, salió {geo!r}")
    entran = [
        ("DEPARTAMENTO CAPITAL, " + PROV, "010A - CABILDO", "circuito_capital"),
        ("DEPARTAMENTO CAPITAL, " + PROV, "CÓRDOBA CAPITAL, DEPARTAMENTO CAPITAL", "localidad_directa"),
        ("DEPARTAMENTO DE SAN JUSTO, " + PROV, "SAN FRANCISCO, DEPARTAMENTO DE SAN JUSTO", "localidad_directa"),
        ("DEPARTAMENTO DE COLÓN, " + PROV, "TODAS LAS LOCALIDADES", "multiple_depto"),
        (PROV, "TODAS LAS LOCALIDADES", "multiple_provincia"),
    ]
    for depto, loc, sub in entran:
        geo = _geo(localidades, depto, loc)
        if geo["excluida"] or geo["sub_ambito"] != sub:
            fallar(caso, f"({depto!r}, {loc!r}) esperaba entrar como {sub}, salió {geo!r}")
        if geo.get("sub_ambito") == "departamento":
            fallar(caso, "el ámbito departamento ya no existe")


def caso_16_d2_alias_villa_santa_rosa(localidades, claves_60):
    """D2: "VILLA SANTA ROSA DE RIO" -> VILLA SANTA ROSA solo con DEPARTAMENTO
    Río Primero; con otro departamento queda fuera de las 60."""
    caso = "CASO 16 - D2 alias Villa Santa Rosa"
    geo = _geo(localidades, "DEPARTAMENTO DE RÍO PRIMERO, " + PROV, "VILLA SANTA ROSA DE RIO, DEPARTAMENTO DE RÍO PRIMERO")
    if geo.get("excluida") or geo.get("localidad") != "VILLA SANTA ROSA" or geo.get("alias_aplicado") != "VILLA SANTA ROSA DE RIO":
        fallar(caso, f"con Río Primero esperaba VILLA SANTA ROSA por alias, salió {geo!r}")
    geo = _geo(localidades, "DEPARTAMENTO CALAMUCHITA, " + PROV, "VILLA SANTA ROSA DE RIO")
    if not geo.get("excluida"):
        fallar(caso, f"con otro departamento el alias no aplica, salió {geo!r}")
    if set(g.ALIAS_LOCALIDAD_PAUTA_GLOBAL) != {"CORDOBA CAPITAL", "VILLA SANTA ROSA DE RIO"}:
        fallar(caso, f"no debe haber otros alias, hay {sorted(g.ALIAS_LOCALIDAD_PAUTA_GLOBAL)}")


def caso_17_d3_cod_provisional_a_real():
    """D3: una pieza que tenía un COD provisional (texto compuesto) y ahora
    trae un A##### no se duplica ni cuenta como baja."""
    caso = "CASO 17 - D3 COD provisional -> real"
    anterior = [{"fuente": "global", "campana": "APROSS MÁS CERCA", "titulo_pieza": "Entrega de Audífonos",
                 "sub_ambito": "localidad_directa", "cod_contenido": "APROSS MÁS CERCA-Entrega de Audífonos-SALUD-..."}]
    nueva = [{"campana": "APROSS MAS CERCA", "titulo_pieza": "Entrega de audífonos", "cod_contenido": "A07001"}]
    bajas, salidas = g.freno_bajas_pauta_global(anterior, nueva)
    if bajas or salidas:
        fallar(caso, f"el cambio de COD no es baja ni salida, salió bajas={bajas} salidas={salidas}")
    res, desc = g._dedup_pauta_global([_entrada(cod_contenido="APROSS-…"), _entrada(cod_contenido="A07001")])
    if len(res) != 1:
        fallar(caso, f"dos entradas iguales salvo el COD son una sola pieza, salieron {len(res)}")


def caso_18_b1_freno_de_bajas():
    """D5 + B1: el freno compara CAMPAÑA + TÍTULO normalizados solo contra
    las piezas anteriores que siguen dentro del universo; las que eran solo
    departamento son salidas por cambio de regla, no bajas."""
    caso = "CASO 18 - B1 freno de bajas"
    anterior = [
        {"fuente": "global", "campana": "C", "titulo_pieza": "Sigue", "sub_ambito": "multiple_depto"},
        {"fuente": "global", "campana": "C", "titulo_pieza": "Solo depto", "sub_ambito": "departamento", "estado": "Finalizada"},
        {"fuente": "global", "campana": "C", "titulo_pieza": "Desaparece", "sub_ambito": "localidad_directa"},
        {"fuente": "historico", "campana": "H", "titulo_pieza": "Histórico", "sub_ambito": "departamento"},
    ]
    nueva = [{"campana": "c", "titulo_pieza": " SIGUE "}]
    bajas, salidas = g.freno_bajas_pauta_global(anterior, nueva)
    if set(bajas) != {("C", "DESAPARECE")}:
        fallar(caso, f"esperaba una sola baja real (C, DESAPARECE), salió {sorted(bajas)}")
    if set(salidas) != {("C", "SOLO DEPTO")}:
        fallar(caso, f"esperaba una salida por cambio de regla (C, SOLO DEPTO), salió {sorted(salidas)}")


def caso_19_b2_dirigida_gana_a_provincial():
    """B2: en un mismo grupo D4 gana la entrada dirigida sobre la provincial
    repartida, antes de mirar FECHA DE ENVÍO."""
    caso = "CASO 19 - B2 dirigida antes que provincial"
    provincial = _entrada(_dedup_dirigida=False, _dedup_fecha_envio_ts=pd.Timestamp("2026-09-30"), _dedup_estado_activo=True, marca="prov")
    dirigida = _entrada(_dedup_dirigida=True, _dedup_fecha_envio_ts=pd.Timestamp("2026-08-01"), marca="dir")
    for orden, piezas in (("provincial primero", [provincial, dirigida]), ("dirigida primero", [dirigida, provincial])):
        res, desc = g._dedup_pauta_global([dict(p) for p in piezas])
        if len(res) != 1 or res[0]["marca"] != "dir":
            fallar(caso, f"({orden}) esperaba que gane la dirigida, salió {res}")
        elif g.motivo_desempate(res[0], desc[0][0]) != "entrada dirigida antes que provincial repartida":
            fallar(caso, f"({orden}) motivo inesperado")


def caso_20_fecha_por_variable_de_entorno():
    """PD_FECHA_CONTROL (ISO) fija la fecha de control; sin la variable, hoy."""
    caso = "CASO 20 - PD_FECHA_CONTROL"
    import os, subprocess
    script = Path(__file__).resolve().parent
    codigo = f"import sys; sys.path.insert(0, {str(script)!r}); import generar_datos as g; print(g.HOY.isoformat())"
    env = dict(os.environ, PD_FECHA_CONTROL="2026-01-02")
    salida = subprocess.run([sys.executable, "-c", codigo], env=env, capture_output=True, text=True).stdout.strip()
    if salida != "2026-01-02":
        fallar(caso, f"con PD_FECHA_CONTROL=2026-01-02 esperaba HOY=2026-01-02, salió {salida!r}")
    env.pop("PD_FECHA_CONTROL")
    salida = subprocess.run([sys.executable, "-c", codigo], env=env, capture_output=True, text=True).stdout.strip()
    from datetime import date
    if salida != date.today().isoformat():
        fallar(caso, f"sin la variable esperaba hoy, salió {salida!r}")


def caso_21_columna_faltante_se_nombra():
    """Si falta una columna (o cambia su encabezado), la carga se corta
    diciendo cuál."""
    caso = "CASO 21 - validación de columnas"
    columnas = [c for c in g.COLUMNAS_PAUTA_GLOBAL if c != "INICIO "] + ["INICIO"]
    try:
        g.validar_columnas_pauta_global(columnas)
        fallar(caso, "esperaba que se corte la carga")
    except SystemExit as e:
        if "'INICIO '" not in str(e) or "'INICIO'" not in str(e):
            fallar(caso, f"el mensaje debe nombrar la columna y cómo viene escrita, salió {e}")
    g.validar_columnas_pauta_global(g.COLUMNAS_PAUTA_GLOBAL + ["COLUMNA NUEVA"])


def caso_5_localidad_fuera_de_60_no_se_atribuye(df, claves_60):
    caso = "CASO 5 - Localidad fuera de las 60"
    filas = filas_por(df, "LOCALIDAD", "Localidad", "FREYRE")
    localidades_san_justo = ["SAN FRANCISCO", "ARROYITO", "MORTEROS", "LAS VARILLAS"]
    for _, row in filas.iterrows():
        pieza = clasificar_fila(row, claves_60)
        if pieza["en_60_localidades"] is not False:
            fallar(
                caso,
                f"{pieza['nombre_anuncio']!r} (LOCALIDAD=Freyre, fuera de las 60) "
                f"esperaba en_60_localidades=False, salió {pieza['en_60_localidades']!r}",
            )
            continue
        for localidad in localidades_san_justo:
            if aplica_a_localidad(pieza, localidad, "SAN JUSTO"):
                fallar(
                    caso,
                    f"{pieza['nombre_anuncio']!r} (LOCALIDAD=Freyre) aparece en {localidad} "
                    "(depto San Justo) y no debería",
                )


def caso_12_programado_es_categoria_propia():
    """ESTADO=PROGRAMADO (11/10/2026): se expone como "Programada" (no Vigente
    ni Finalizada). Vacío -> S/D y valores desconocidos se muestran tal cual."""
    assert g.estado_pauta_digital_desde_crudo("PROGRAMADO") == "Programada"
    assert g.estado_pauta_digital_desde_crudo("programado ") == "Programada"
    assert g.estado_pauta_digital_desde_crudo(None) == "S/D"
    assert g.estado_pauta_digital_desde_crudo("PAUSADO") == "PAUSADO"


def caso_13_estado_audiovisual():
    """Audiovisuales (11/10/2026): INICIO>hoy Programada; INICIO<=hoy<=FIN
    Vigente; FIN<hoy Finalizada; sin fechas S/D; sin INICIO usa solo FIN."""
    d = lambda n: (pd.Timestamp(g.HOY) + pd.Timedelta(days=n)).strftime("%Y-%m-%d")
    assert g.estado_audiovisual(d(3), d(10)) == "Programada"
    assert g.estado_audiovisual(d(-3), d(10)) == "Vigente"
    assert g.estado_audiovisual(d(-3), d(0)) == "Vigente"
    assert g.estado_audiovisual(d(-10), d(-1)) == "Finalizada"
    assert g.estado_audiovisual(None, None) == "S/D"
    assert g.estado_audiovisual(None, d(5)) == "Vigente"
    assert g.estado_audiovisual(None, d(-5)) == "Finalizada"


def caso_14_bordes_de_alerta_30_50():
    """Borde único 30/50 (spec 11/10/2026): 29 -> 🟢, 30 -> 🟡, 49 -> 🟡, 50 -> 🔴."""
    assert g.calcular_alerta(0, 30, 50) == "🟢"
    assert g.calcular_alerta(29, 30, 50) == "🟢"
    assert g.calcular_alerta(30, 30, 50) == "🟡"
    assert g.calcular_alerta(49, 30, 50) == "🟡"
    assert g.calcular_alerta(50, 30, 50) == "🔴"
    assert g.calcular_alerta(None, 30, 50) is None


def main():
    df = cargar_df_historico()
    localidades, claves_60 = g.cargar_localidades()

    for caso in (
        caso_1_provincia_no_se_atribuye,
        caso_2_otro_no_se_atribuye,
        caso_3_localidad_solo_en_su_localidad,
        caso_4_departamento_no_se_propaga,
        caso_5_localidad_fuera_de_60_no_se_atribuye,
        caso_6_otro_barrio_cordoba_no_se_atribuye,
    ):
        try:
            caso(df, claves_60)
        except AssertionError as e:
            FALLAS.append(f"[{caso.__name__}] {e}")

    for caso in (
        caso_7_todas_las_localidades_con_departamento_se_expande,
        caso_8_todas_las_localidades_provincia_entera_se_expande_a_las_60,
        caso_15_d1_universo,
        caso_16_d2_alias_villa_santa_rosa,
    ):
        try:
            caso(localidades, claves_60)
        except AssertionError as e:
            FALLAS.append(f"[{caso.__name__}] {e}")

    for caso in (
        caso_9_dedup_clave_d4,
        caso_10_dedup_gana_fecha_envio_mas_reciente,
        caso_11_dedup_tiebreak_estado_activo,
        caso_12_programado_es_categoria_propia,
        caso_13_estado_audiovisual,
        caso_14_bordes_de_alerta_30_50,
        caso_17_d3_cod_provisional_a_real,
        caso_18_b1_freno_de_bajas,
        caso_19_b2_dirigida_gana_a_provincial,
        caso_20_fecha_por_variable_de_entorno,
        caso_21_columna_faltante_se_nombra,
    ):
        try:
            caso()
        except AssertionError as e:
            FALLAS.append(f"[{caso.__name__}] {e}")

    if FALLAS:
        print(f"FALLÓ el test de matching de Pauta Digital ({len(FALLAS)} problema(s)):\n")
        for f in FALLAS:
            print(f"  - {f}")
        return 1

    print("OK — los 21 casos de regresión de Pauta Digital pasan.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
