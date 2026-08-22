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


def main():
    df = cargar_df_historico()
    _localidades, claves_60 = g.cargar_localidades()

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

    if FALLAS:
        print(f"FALLÓ el test de matching de Pauta Digital ({len(FALLAS)} problema(s)):\n")
        for f in FALLAS:
            print(f"  - {f}")
        return 1

    print("OK — los 5 casos de regresión de matching de Pauta Digital pasan.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
