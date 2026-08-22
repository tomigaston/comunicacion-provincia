#!/usr/bin/env python3
"""
Test de regresión de la lógica de matching de SMS (sección "5. SMS" de
generar_datos.py). Es sintético a propósito — no depende de ningún
SMS_Looker*.xlsx real — para poder correr en cualquier momento, incluso antes
de que llegue el primer export real, y para aislar la lógica pura de
matching de la lectura de Excel (mismo espíritu que test_pauta_digital.py).

Desde el cambio de regla del 22/08/2026, SMS ya no tiene ningún alcance de
tipo "departamento" (mismo criterio que Pauta Digital y Contenido Orgánico):
un token o resuelve exacto/fuzzy a una de las 60 localidades prioritarias, o
no genera ningún alcance. Estos tests cubren: match exacto contra las 60, las
excepciones hardcodeadas (simples, split en 3, y las que quedan "excluir"
por no ser una de las 60), el token suelto "CAPITAL", fuzzy fallback (incluso
dentro de una excepción), "no identificado", y el split de AUDIENCIA
(separadores + limpieza de paréntesis).

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
# Ya no hace falta un Nomenclador Maestro sintético: sin alcance de tipo
# "departamento", el universo de matching de SMS es solo las 60.

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

MAPAS = (LOCALIDAD_A_OFICIAL, LOCALIDAD_A_DEPARTAMENTO_OFICIAL)


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


def caso_excepcion_fuera_de_60_sin_alcance():
    # VILLA CIUDAD PARQUE (LOS REARTES) no es una de las 60 -> hardcodeada
    # "excluir" directo, ya no cae a Departamento. Debe devolver lista vacía.
    r = resolver("Villa Ciudad Parque")
    check(
        "excepcion VILLA CIUDAD PARQUE -> sin alcance (no está en las 60)",
        r == [],
        r,
    )


def caso_excepcion_split_en_3():
    # CANALS no es una de las 60 -> queda "excluir" dentro del split; LA
    # CARLOTA y LABOULAYE sí son de las 60 -> se mantienen. 2 alcances, no 3.
    r = resolver("La Carlota Laboulaye Canals")
    esperado = [
        {"tipo": "localidad", "departamento": "JUAREZ CELMAN", "localidad": "LA CARLOTA", "matcheo": "excepcion"},
        {"tipo": "localidad", "departamento": "ROQUE SAENZ PEÑA", "localidad": "LABOULAYE", "matcheo": "excepcion"},
    ]
    check("LA CARLOTA LABOULAYE CANALS -> split en 3, CANALS sin alcance", r == esperado, r)


def caso_excepcion_excluida_del_universo():
    # B° LA FLORESTA es un barrio de la ciudad de Córdoba -> queda AFUERA del
    # universo del tablero (los barrios van a otro proyecto aparte). Debe
    # devolver lista vacía, no un alcance.
    r = resolver("B° La Floresta")
    check(
        "B° LA FLORESTA -> excluida del universo (lista vacía)",
        r == [],
        r,
    )


def caso_token_suelto_capital():
    r = resolver("CAPITAL")
    check(
        "token suelto CAPITAL -> localidad CORDOBA (una de las 60), no Departamento",
        r == [{"tipo": "localidad", "departamento": "CAPITAL", "localidad": "CORDOBA", "matcheo": "capital_suelto"}],
        r,
    )


def caso_excepcion_con_fuzzy_fallback():
    # Una excepción hardcodeada puede apuntar a un nombre con una grafía
    # levemente distinta a la oficial de las 60 -> debe resolver igual por
    # fuzzy internamente (se ve en fuzzy_aplicados), sin perderse en
    # excepcion_sin_resolver. El "matcheo" del alcance se etiqueta como
    # "excepcion" -no "fuzzy"- porque de cara al usuario la resolución sigue
    # siendo la confirmada a mano; el detalle de que necesitó fuzzy puertas
    # adentro queda igual auditable en fuzzy_aplicados.
    original = dict(g.EXCEPCIONES_AUDIENCIA_SMS)
    g.EXCEPCIONES_AUDIENCIA_SMS["TEST FUZZY EXCEPCION"] = [("localidad", "RIO CUARTOO")]  # typo a propósito
    try:
        fuzzy_log = []
        r = g._resolver_token_audiencia("Test Fuzzy Excepcion", MAPAS, fuzzy_log, [])
    finally:
        g.EXCEPCIONES_AUDIENCIA_SMS.clear()
        g.EXCEPCIONES_AUDIENCIA_SMS.update(original)

    check(
        "excepcion con grafía distinta a la de las 60 -> resuelve por fuzzy, no se pierde",
        r == [{"tipo": "localidad", "departamento": "RIO CUARTO", "localidad": "RIO CUARTO", "matcheo": "excepcion"}],
        r,
    )
    check("el fuzzy interno queda auditable en fuzzy_aplicados", len(fuzzy_log) == 1, fuzzy_log)


def caso_excepcion_sin_resolver_se_loguea():
    # Monkeypatch temporal: una excepción "localidad" que apunta a un lugar
    # que no existe entre las 60, ni por fuzzy -> debe devolver lista vacía
    # (ya no hay Departamento a dónde caer) y quedar registrada aparte en
    # excepciones_sin_resolver, no perderse en silencio.
    original = dict(g.EXCEPCIONES_AUDIENCIA_SMS)
    g.EXCEPCIONES_AUDIENCIA_SMS["ALDEA FANTASMA"] = [("localidad", "LUGAR QUE NO EXISTE EN NINGUN PADRON")]
    try:
        excepciones_sin_resolver = []
        r = g._resolver_token_audiencia("Aldea Fantasma", MAPAS, [], excepciones_sin_resolver)
    finally:
        g.EXCEPCIONES_AUDIENCIA_SMS.clear()
        g.EXCEPCIONES_AUDIENCIA_SMS.update(original)

    check(
        "excepcion que ya no resuelve -> sin alcance (no departamento fallback)",
        r == [],
        r,
    )
    check(
        "queda logueada en excepciones_sin_resolver, no se pierde en silencio",
        excepciones_sin_resolver == [{
            "token_audiencia": "Aldea Fantasma",
            "excepcion_apunta_a": "LUGAR QUE NO EXISTE EN NINGUN PADRON",
        }],
        excepciones_sin_resolver,
    )


def caso_excepcion_excluir_no_intenta_fuzzy():
    # LOS GIGANTES: confirmado que no es una de las 60 -> "excluir" hardcodeado
    # directo, SIN pasar por exacto/fuzzy. Regresión real detectada el
    # 22/08/2026: antes de este cambio, "LOS GIGANTES" fuzzy-matcheaba a "LOS
    # CISNES" (un lugar real en otro departamento, sin ninguna relación)
    # cuando se intentaba resolver por nombre. "excluir" evita ese riesgo de
    # raíz: ni siquiera lo intenta.
    fuzzy_log = []
    excepciones_sin_resolver = []
    r = g._resolver_token_audiencia("Los Gigantes", MAPAS, fuzzy_log, excepciones_sin_resolver)
    check("excluir -> lista vacía, sin alcance", r == [], r)
    check("no dispara ningún intento de fuzzy", len(fuzzy_log) == 0, fuzzy_log)
    check(
        "no se loguea en excepciones_sin_resolver -> es comportamiento esperado, no una anomalía",
        len(excepciones_sin_resolver) == 0,
        excepciones_sin_resolver,
    )


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


def caso_token_confirmado_sin_lugar_no_se_lista():
    # TOKENS_CONFIRMADOS_SIN_LUGAR_SMS no cambia la resolución (sigue sin
    # generar alcance -_resolver_token_audiencia devuelve None igual-), solo
    # se usa en cargar_sms() para filtrar qué entra a no_identificados. Acá
    # se prueba únicamente el helper puro de esa decisión.
    check(
        "token ya confirmado (ej. HUINCA RENANCÓ) -> no se vuelve a listar",
        g._token_confirmado_sin_lugar("Huinca Renancó"),
        g._token_confirmado_sin_lugar("Huinca Renancó"),
    )
    check(
        "token nuevo, no confirmado todavía -> sí se lista",
        not g._token_confirmado_sin_lugar("ALDEA INEXISTENTE XYZ123"),
        g._token_confirmado_sin_lugar("ALDEA INEXISTENTE XYZ123"),
    )
    check(
        "sigue sin generar alcance aunque esté confirmado (la resolución no cambia)",
        resolver("Huinca Renancó") is None,
        resolver("Huinca Renancó"),
    )


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
        caso_excepcion_fuera_de_60_sin_alcance,
        caso_excepcion_split_en_3,
        caso_excepcion_excluida_del_universo,
        caso_token_suelto_capital,
        caso_excepcion_con_fuzzy_fallback,
        caso_excepcion_sin_resolver_se_loguea,
        caso_excepcion_excluir_no_intenta_fuzzy,
        caso_fuzzy_puro_sin_excepcion,
        caso_no_identificado,
        caso_token_confirmado_sin_lugar_no_se_lista,
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

    print("OK — los 14 casos de regresión de matching de SMS pasan.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
