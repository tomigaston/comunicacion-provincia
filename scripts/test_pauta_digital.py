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
    deptos_a_oficial = {}
    departamento_a_localidades_normalizadas = {}
    for loc in localidades:
        n_loc = g.normalizar(loc["localidad"])
        n_depto = g.normalizar(loc["departamento"])
        localidad_a_oficial[n_loc] = loc["localidad"]
        localidad_a_departamento_oficial[n_loc] = loc["departamento"]
        deptos_a_oficial[n_depto] = loc["departamento"]
        departamento_a_localidades_normalizadas.setdefault(n_depto, []).append(n_loc)
    return localidad_a_oficial, localidad_a_departamento_oficial, deptos_a_oficial, departamento_a_localidades_normalizadas


def caso_7_todas_las_localidades_con_departamento_se_expande(localidades, claves_60):
    """"TODAS LAS LOCALIDADES" + un Departamento puntual (no la provincia
    entera) debe expandirse a una pieza por cada Localidad de las 60 que cae
    en ese Departamento, con localidad_asignada seteada explícitamente —no
    ámbito provincia, y no una única pieza de ámbito departamento."""
    caso = "CASO 7 - TODAS LAS LOCALIDADES + Departamento puntual"
    (localidad_a_oficial, localidad_a_departamento_oficial, deptos_a_oficial,
     departamento_a_localidades_normalizadas) = _mapas_oficiales(localidades)
    n60 = set(localidad_a_oficial.keys())

    geo = g.clasificar_geografia_pauta_global(
        "DEPARTAMENTO RIO CUARTO, PROVINCIA DE CÓRDOBA, ARGENTINA", "TODAS LAS LOCALIDADES",
        n60, departamento_a_localidades_normalizadas,
    )
    if geo["ambito"] != "localidad_multiple":
        fallar(caso, f"esperaba ambito=localidad_multiple, salió {geo['ambito']!r}")
        return
    asignaciones = g._asignaciones_geograficas(
        geo, localidad_a_oficial, localidad_a_departamento_oficial, deptos_a_oficial
    )
    localidades_out = sorted(a["localidad"] for a in asignaciones)
    if localidades_out != ["RIO CUARTO", "VICUÑA MACKENNA"]:
        fallar(caso, f"esperaba ['RIO CUARTO', 'VICUÑA MACKENNA'], salió {localidades_out!r}")
    for a in asignaciones:
        if a["localidad_asignada"] != a["localidad"]:
            fallar(caso, f"localidad_asignada ({a['localidad_asignada']!r}) debería ser igual a localidad ({a['localidad']!r})")


def caso_8_todas_las_localidades_provincia_entera_se_expande_a_las_60(localidades, claves_60):
    """"TODAS LAS LOCALIDADES" SIN Departamento puntual (DEPARTAMENTO =
    "PROVINCIA DE CÓRDOBA, ARGENTINA") debe expandirse a las 60 localidades
    prioritarias completas -mismo patrón que CASO 7, pero sin acotar a un
    Departamento- con localidad_asignada seteada explícitamente y las
    métricas completas replicadas en cada una (sin prorratear)."""
    caso = "CASO 8 - TODAS LAS LOCALIDADES, provincia entera -> se expande a las 60"
    (localidad_a_oficial, localidad_a_departamento_oficial, deptos_a_oficial,
     departamento_a_localidades_normalizadas) = _mapas_oficiales(localidades)
    n60 = set(localidad_a_oficial.keys())

    geo = g.clasificar_geografia_pauta_global(
        "PROVINCIA DE CÓRDOBA, ARGENTINA", "TODAS LAS LOCALIDADES", n60, departamento_a_localidades_normalizadas
    )
    if geo["ambito"] != "localidad_multiple":
        fallar(caso, f"esperaba ambito=localidad_multiple, salió {geo['ambito']!r}")
        return
    if set(geo["localidades"]) != n60:
        fallar(caso, "esperaba las 60 localidades completas en geo['localidades'], salió otro conjunto")
    asignaciones = g._asignaciones_geograficas(
        geo, localidad_a_oficial, localidad_a_departamento_oficial, deptos_a_oficial
    )
    if len(asignaciones) != len(n60):
        fallar(caso, f"esperaba {len(n60)} asignaciones (una por Localidad de las 60), salió {len(asignaciones)}")
    for a in asignaciones:
        if a["localidad_asignada"] != a["localidad"]:
            fallar(caso, f"localidad_asignada ({a['localidad_asignada']!r}) debería ser igual a localidad ({a['localidad']!r})")


def caso_9_dedup_por_cod_contenido_corre_despues_de_expandir(localidades, claves_60):
    """El dedup por COD. CONTENIDO opera sobre (Campaña, Título,
    localidad_asignada) DESPUÉS de expandir "TODAS LAS LOCALIDADES"+
    Departamento: una pieza que ya tiene fila propia apuntando directo a una
    Localidad no debe duplicarse ahí solo porque ADEMÁS tiene una fila
    "TODAS LAS LOCALIDADES" de su Departamento con el mismo COD. CONTENIDO.
    Dos piezas con el mismo COD. CONTENIDO pero Campaña/Título distintos
    (código reutilizado, caso real de los datos) NO deben fusionarse."""
    caso = "CASO 9 - dedup COD. CONTENIDO post-expansión"
    piezas = [
        {"cod_contenido": "X1", "campana": "C", "titulo_pieza": "T", "localidad_asignada": "RIO CUARTO"},
        {"cod_contenido": "X1", "campana": "C", "titulo_pieza": "T", "localidad_asignada": "RIO CUARTO"},
        {"cod_contenido": "X1", "campana": "C", "titulo_pieza": "T", "localidad_asignada": "VICUÑA MACKENNA"},
        {"cod_contenido": "X1", "campana": "OTRA CAMPAÑA", "titulo_pieza": "OTRO TITULO", "localidad_asignada": "RIO CUARTO"},
        {"cod_contenido": None, "campana": "C", "titulo_pieza": "T", "localidad_asignada": None},
        {"cod_contenido": None, "campana": "C", "titulo_pieza": "T", "localidad_asignada": None},
    ]
    resultado, descartadas = g._dedup_pauta_global_por_cod_contenido(piezas)
    if descartadas != 1:
        fallar(caso, f"esperaba 1 pieza descartada (el duplicado exacto RIO CUARTO), salió {descartadas}")
    if len(resultado) != 5:
        fallar(caso, f"esperaba 5 piezas tras dedup, salió {len(resultado)}")
    claves = [(p["cod_contenido"], p["campana"], p["titulo_pieza"], p["localidad_asignada"]) for p in resultado]
    if claves.count(("X1", "C", "T", "RIO CUARTO")) != 1:
        fallar(caso, "el duplicado exacto (mismo COD./Campaña/Título/Localidad) no se descartó")
    if claves.count(("X1", "C", "T", "VICUÑA MACKENNA")) != 1:
        fallar(caso, "la pieza de otra Localidad se descartó y no debía")
    if claves.count(("X1", "OTRA CAMPAÑA", "OTRO TITULO", "RIO CUARTO")) != 1:
        fallar(caso, "la pieza con mismo COD. CONTENIDO pero Campaña/Título distintos no debía fusionarse")
    if sum(1 for p in resultado if p["cod_contenido"] is None) != 2:
        fallar(caso, "las piezas sin COD. CONTENIDO (None) no deben descartarse por esta regla")


def caso_10_dedup_gana_fecha_envio_mas_reciente():
    """Confirmado 06/09/2026, caso real detectado en Pauta RRSS_GLOBAL.xlsx
    (COD. CONTENIDO A06049, "Escuchá 'Acueducto en Villa Carlos Paz' (Video)"):
    entre dos filas que comparten clave de dedup, gana la de FECHA DE ENVÍO
    más reciente -ya no "la primera vista"-, aunque ambas tengan el mismo
    ESTADO (acá INACTIVO en las dos, así que el tiebreak de CASO 11 ni entra
    en juego)."""
    caso = "CASO 10 - dedup gana FECHA DE ENVÍO más reciente"
    vieja = {
        "cod_contenido": "A06049", "campana": "AGENDA MLL",
        "titulo_pieza": "Escuchá \"Acueducto en Villa Carlos Paz\" (Video)",
        "localidad_asignada": "VILLA CARLOS PAZ", "plataforma": "Meta",
        "_dedup_fecha_envio_ts": pd.Timestamp("2026-08-14"), "_dedup_estado_activo": False,
    }
    nueva = {
        "cod_contenido": "A06049", "campana": "AGENDA MLL",
        "titulo_pieza": "Escuchá \"Acueducto en Villa Carlos Paz\" (Video)",
        "localidad_asignada": "VILLA CARLOS PAZ", "plataforma": "Youtube",
        "_dedup_fecha_envio_ts": pd.Timestamp("2026-08-20"), "_dedup_estado_activo": False,
    }
    for orden, piezas in (("vieja primero", [vieja, nueva]), ("nueva primero", [nueva, vieja])):
        resultado, descartadas = g._dedup_pauta_global_por_cod_contenido([dict(p) for p in piezas])
        if descartadas != 1:
            fallar(caso, f"({orden}) esperaba 1 descartada, salió {descartadas}")
        if len(resultado) != 1 or resultado[0]["plataforma"] != "Youtube":
            fallar(caso, f"({orden}) esperaba que gane la fila del 20/08 (Youtube), salió {resultado}")


def caso_11_dedup_tiebreak_estado_activo():
    """Si dos filas empatan en FECHA DE ENVÍO, gana la que tenga
    ESTADO=ACTIVO en el excel crudo, contra cualquier otro valor (INACTIVO,
    vacío, etc.)."""
    caso = "CASO 11 - dedup tiebreak ESTADO=ACTIVO en empate de fecha"
    inactiva = {
        "cod_contenido": "X2", "campana": "C", "titulo_pieza": "T", "localidad_asignada": "RIO CUARTO",
        "plataforma": "Meta",
        "_dedup_fecha_envio_ts": pd.Timestamp("2026-08-14"), "_dedup_estado_activo": False,
    }
    activa = {
        "cod_contenido": "X2", "campana": "C", "titulo_pieza": "T", "localidad_asignada": "RIO CUARTO",
        "plataforma": "Google",
        "_dedup_fecha_envio_ts": pd.Timestamp("2026-08-14"), "_dedup_estado_activo": True,
    }
    for orden, piezas in (("inactiva primero", [inactiva, activa]), ("activa primero", [activa, inactiva])):
        resultado, descartadas = g._dedup_pauta_global_por_cod_contenido([dict(p) for p in piezas])
        if descartadas != 1:
            fallar(caso, f"({orden}) esperaba 1 descartada, salió {descartadas}")
        if len(resultado) != 1 or resultado[0]["plataforma"] != "Google":
            fallar(caso, f"({orden}) esperaba que gane la fila ESTADO=ACTIVO (Google), salió {resultado}")


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


def caso_12_programado_es_categoria_propia_sin_alerta():
    """ESTADO=PROGRAMADO (11/10/2026): se expone como "Programada" (no Vigente
    ni Finalizada), y una pieza con INICIO futuro no genera antigüedad ni
    alerta. Vacío -> S/D y valores desconocidos se muestran tal cual."""
    assert g.estado_pauta_digital_desde_crudo("PROGRAMADO") == "Programada"
    assert g.estado_pauta_digital_desde_crudo("programado ") == "Programada"
    assert g.estado_pauta_digital_desde_crudo(None) == "S/D"
    assert g.estado_pauta_digital_desde_crudo("PAUSADO") == "PAUSADO"
    futuro = pd.Timestamp(g.HOY) + pd.Timedelta(days=3)
    assert g.antiguedad_y_alerta_pauta_digital("Vigente", futuro, 30, 50) == (None, None)
    pasado = pd.Timestamp(g.HOY) - pd.Timedelta(days=60)
    assert g.antiguedad_y_alerta_pauta_digital("Vigente", pasado, 30, 50) == (60, "🔴")


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
        caso_9_dedup_por_cod_contenido_corre_despues_de_expandir,
    ):
        try:
            caso(localidades, claves_60)
        except AssertionError as e:
            FALLAS.append(f"[{caso.__name__}] {e}")

    for caso in (
        caso_10_dedup_gana_fecha_envio_mas_reciente,
        caso_11_dedup_tiebreak_estado_activo,
        caso_12_programado_es_categoria_propia_sin_alerta,
        caso_13_estado_audiovisual,
        caso_14_bordes_de_alerta_30_50,
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

    print("OK — los 14 casos de regresión de matching de Pauta Digital pasan.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
