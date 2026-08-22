#!/usr/bin/env python3
"""
Test de regresión de la lógica de matching de SMS (sección "5. SMS" de
generar_datos.py). Es sintético a propósito — no depende de ningún
SMS_Looker*.xlsx real — para poder correr en cualquier momento, incluso antes
de que llegue el primer export real, y para aislar la lógica pura de
matching de la lectura de Excel (mismo espíritu que test_pauta_digital.py).

Cubre: match exacto contra las 60, las excepciones hardcodeadas (simples,
split en 3, y la que apunta directo a un Departamento), el token suelto
"CAPITAL", fuzzy fallback (incluso dentro de una excepción, cuando la grafía
oficial del Nomenclador difiere del valor hardcodeado), "no identificado", y
el split de AUDIENCIA (separadores + limpieza de paréntesis).

Correr con:
    python3 scripts/test_sms.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generar_datos as g  # noqa: E402

FALLAS = []


def check(nombre, cond, detalle=""):
    if not cond:
        FALLAS.append(f"{nombre}: {detalle}")


# --- Padrón sintético (no es el real, solo para probar la lógica) ----------

LOCALIDAD_A_OFICIAL = {
    g.normalizar(x): x for x in [
        "CORDOBA", "VILLA CARLOS PAZ", "VILLA DEL TOTORAL", "LA CARLOTA", "LABOULAYE",
        "RIO CUARTO", "VILLA MARIA", "SAN FRANCISCO",
    ]
}
LOCALIDAD_A_DEPARTAMENTO_OFICIAL = {
    g.normalizar("CORDOBA"): "CAPITAL",
    g.normalizar("VILLA CARLOS PAZ"): "PUNILLA",
    g.normalizar("VILLA DEL TOTORAL"): "TOTORAL",
    g.normalizar("LA CARLOTA"): "JUAREZ CELMAN",
    g.normalizar("LABOULAYE"): "ROQUE SAENZ PEÑA",
    g.normalizar("RIO CUARTO"): "RIO CUARTO",
    g.normalizar("VILLA MARIA"): "GENERAL SAN MARTIN",
    g.normalizar("SAN FRANCISCO"): "SAN JUSTO",
}
DEPTOS_A_OFICIAL = {
    g.normalizar(x): x for x in [
        "CAPITAL", "PUNILLA", "TOTORAL", "JUAREZ CELMAN", "ROQUE SAENZ PEÑA",
        "RIO CUARTO", "GENERAL SAN MARTIN", "SAN JUSTO", "CALAMUCHITA", "MARCOS JUAREZ",
        "CRUZ DEL EJE", "SANTA MARIA", "UNION",
    ]
}
# Nomenclador Maestro sintético: toda la provincia, incluye localidades fuera
# de las 60 y una grafía oficial con sufijo (Corral de Bustos - Ifflinger)
# para probar que el fuzzy fallback la sigue resolviendo.
LOCALIDAD_A_DEPTO_NOMENCLADOR = dict(LOCALIDAD_A_DEPARTAMENTO_OFICIAL)
LOCALIDAD_A_DEPTO_NOMENCLADOR.update({
    g.normalizar("VILLA CIUDAD PARQUE LOS REARTES"): "CALAMUCHITA",
    g.normalizar("TANINGA"): "CRUZ DEL EJE",
    g.normalizar("LOS GIGANTES"): "PUNILLA",
    g.normalizar("CERRO BLANCO"): "SANTA MARIA",
    g.normalizar("CORRAL DE BUSTOS - IFFLINGER"): "MARCOS JUAREZ",
    g.normalizar("CANALS"): "UNION",
})

MAPAS = (LOCALIDAD_A_OFICIAL, LOCALIDAD_A_DEPTO_NOMENCLADOR, LOCALIDAD_A_DEPARTAMENTO_OFICIAL, DEPTOS_A_OFICIAL)


def resolver(token):
    fuzzy_log = []
    excepciones_sin_resolver_log = []
    return g._resolver_token_audiencia(token, MAPAS, fuzzy_log, excepciones_sin_resolver_log)


def caso_match_exacto_en_60():
    r = resolver("RIO CUARTO")
    check(
        "match exacto en 60",
        r == [{"tipo": "localidad", "departamento": "RIO CUARTO", "localidad": "RIO CUARTO", "matcheo": "exacto"}],
        r,
    )


def caso_excepcion_simple_en_60():
    r = resolver("Carlos Paz")
    check(
        "excepcion CARLOS PAZ -> localidad en 60",
        r == [{"tipo": "localidad", "departamento": "PUNILLA", "localidad": "VILLA CARLOS PAZ", "matcheo": "excepcion"}],
        r,
    )


def caso_excepcion_fuera_de_60_cae_a_depto():
    r = resolver("Villa Ciudad Parque")
    check(
        "excepcion VILLA CIUDAD PARQUE -> Departamento (no está en las 60)",
        r == [{"tipo": "departamento", "departamento": "CALAMUCHITA", "localidad": None, "matcheo": "excepcion"}],
        r,
    )


def caso_excepcion_split_en_3():
    r = resolver("La Carlota Laboulaye Canals")
    esperado = [
        {"tipo": "localidad", "departamento": "JUAREZ CELMAN", "localidad": "LA CARLOTA", "matcheo": "excepcion"},
        {"tipo": "localidad", "departamento": "ROQUE SAENZ PEÑA", "localidad": "LABOULAYE", "matcheo": "excepcion"},
        {"tipo": "departamento", "departamento": "UNION", "localidad": None, "matcheo": "excepcion"},
    ]
    check("LA CARLOTA LABOULAYE CANALS -> split en 3, sin prorrateo", r == esperado, r)


def caso_excepcion_excluida_del_universo():
    # B° LA FLORESTA es un barrio de la ciudad de Córdoba -> queda AFUERA del
    # universo del tablero (los barrios van a otro proyecto aparte), no se le
    # inventa un Departamento. Debe devolver lista vacía, no un alcance.
    r = resolver("B° La Floresta")
    check(
        "B° LA FLORESTA -> excluida del universo (lista vacía, no Departamento)",
        r == [],
        r,
    )


def caso_token_suelto_capital():
    r = resolver("CAPITAL")
    check(
        "token suelto CAPITAL -> Departamento Capital entero",
        r == [{"tipo": "departamento", "departamento": "CAPITAL", "localidad": None, "matcheo": "capital_suelto"}],
        r,
    )


def caso_excepcion_con_fuzzy_fallback():
    # La excepción hardcodeada dice "CORRAL DE BUSTOS", pero el Nomenclador
    # Maestro (sintético acá) tiene el nombre oficial con sufijo. Debe
    # resolver igual por fuzzy internamente (se ve en fuzzy_aplicados), sin
    # perderse en excepcion_sin_resolver. El "matcheo" del alcance se etiqueta
    # como "excepcion" -no "fuzzy"- porque de cara al usuario la resolución
    # sigue siendo la confirmada a mano; el detalle de que necesitó fuzzy
    # puertas adentro queda igual auditable en fuzzy_aplicados.
    fuzzy_log = []
    r = g._resolver_token_audiencia("Corral de Bustos", MAPAS, fuzzy_log, [])
    check(
        "excepcion con grafía distinta a la oficial -> resuelve por fuzzy, no se pierde",
        r == [{"tipo": "departamento", "departamento": "MARCOS JUAREZ", "localidad": None, "matcheo": "excepcion"}],
        r,
    )
    check("el fuzzy interno queda auditable en fuzzy_aplicados", len(fuzzy_log) == 1, fuzzy_log)


def caso_excepcion_sin_resolver_se_loguea():
    # Monkeypatch temporal: una excepción que apunta a un lugar que no existe
    # en ningún padrón (ni siquiera por fuzzy) -> debe devolver matcheo
    # "excepcion_sin_resolver" y quedar registrada aparte, no perderse en
    # silencio (esto simula el padrón real cambiando después de hardcodear
    # una excepción).
    original = dict(g.EXCEPCIONES_AUDIENCIA_SMS)
    g.EXCEPCIONES_AUDIENCIA_SMS["ALDEA FANTASMA"] = [("localidad", "LUGAR QUE NO EXISTE EN NINGUN PADRON")]
    try:
        excepciones_sin_resolver = []
        r = g._resolver_token_audiencia("Aldea Fantasma", MAPAS, [], excepciones_sin_resolver)
    finally:
        g.EXCEPCIONES_AUDIENCIA_SMS.clear()
        g.EXCEPCIONES_AUDIENCIA_SMS.update(original)

    check(
        "excepcion que ya no resuelve -> matcheo excepcion_sin_resolver, con departamento None",
        r == [{"tipo": "departamento", "departamento": None, "localidad": None, "matcheo": "excepcion_sin_resolver"}],
        r,
    )
    check("queda logueada en excepciones_sin_resolver, no se pierde en silencio", len(excepciones_sin_resolver) == 1, excepciones_sin_resolver)


def caso_fuzzy_puro_sin_excepcion():
    r = resolver("RIO CUARTOO")  # typo leve, sin excepción hardcodeada
    check(
        "typo leve sobre una de las 60 -> fuzzy",
        r is not None and r[0]["matcheo"] == "fuzzy" and r[0]["localidad"] == "RIO CUARTO",
        r,
    )


def caso_no_identificado():
    r = resolver("ALDEA INEXISTENTE XYZ123")
    check("token sin ningún match -> None (no identificado)", r is None, r)


def caso_dividir_audiencia():
    tokens = g._dividir_audiencia("Rio Cuarto (25-45) - Villa Maria, San Francisco\nLaboulaye")
    check(
        "dividir_audiencia: separa por ' - ', ',', '\\n' y limpia paréntesis",
        tokens == ["Rio Cuarto", "Villa Maria", "San Francisco", "Laboulaye"],
        tokens,
    )


def caso_fila_multi_localidad_sin_prorrateo():
    alcances = []
    for tok in g._dividir_audiencia("Rio Cuarto - Villa Maria"):
        alcances.extend(resolver(tok) or [])
    check("fila con 2 localidades en AUDIENCIA -> 2 alcances, sin repartir cantidad", len(alcances) == 2, alcances)


def main():
    for caso in (
        caso_match_exacto_en_60,
        caso_excepcion_simple_en_60,
        caso_excepcion_fuera_de_60_cae_a_depto,
        caso_excepcion_split_en_3,
        caso_excepcion_excluida_del_universo,
        caso_token_suelto_capital,
        caso_excepcion_con_fuzzy_fallback,
        caso_excepcion_sin_resolver_se_loguea,
        caso_fuzzy_puro_sin_excepcion,
        caso_no_identificado,
        caso_dividir_audiencia,
        caso_fila_multi_localidad_sin_prorrateo,
    ):
        try:
            caso()
        except Exception as e:  # noqa: BLE001 - test runner, se quiere ver cualquier falla
            FALLAS.append(f"[{caso.__name__}] excepción: {e}")

    if FALLAS:
        print(f"FALLÓ el test de matching de SMS ({len(FALLAS)} problema(s)):\n")
        for f in FALLAS:
            print(f"  - {f}")
        return 1

    print("OK — los 12 casos de regresión de matching de SMS pasan.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
