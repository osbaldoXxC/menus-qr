import unittest
import math
from main import (
    InterpretRequest, interpret, _extract_budget_proposal,
    _safe_request_id, InterpretResponse
)


class TestR2Interpret(unittest.TestCase):
    def _post_like(self, payload):
        req = InterpretRequest.model_validate(payload)
        return interpret(req)

    def test_between_flavors_is_not_budget_range(self):
        result = self._post_like({'craving': {'text': 'Quiero sabor entre dulce y salado, sin chile'}})
        self.assertFalse(result.extracted.budget.ambiguous)
        self.assertIn('chile', result.extracted.excludedIngredients)

    def test_without_spending_is_not_an_ingredient_exclusion(self):
        result = self._post_like({'craving': {'text': 'Sin gastar más de 120 pesos, sin cebolla'}})
        self.assertNotIn('gastar', result.extracted.excludedIngredients)
        self.assertIn('cebolla', result.extracted.excludedIngredients)
        self.assertEqual(result.extracted.budget.amount, 120)

    def test_no_lleve_and_no_como_are_exclusion_proposals(self):
        for text, expected in [('algo que no lleve puerco', 'puerco'), ('no como carne', 'carne')]:
            result = self._post_like({'craving': {'text': text}})
            self.assertIn(expected, result.extracted.excludedIngredients)

    # --- baseline valid/empty ---
    def test_valid_request(self):
        r = self._post_like({
            'craving': {'text': 'tacos al pastor sin cebolla', 'tags': ['taco']},
            'restrictions': {'allergies': ['mani'], 'diet': 'none', 'excludedIngredients': []},
            'options': {'limit': 5, 'locale': 'es-MX', 'requestId': 'req_i1'}
        })
        self.assertEqual(r.requestId, 'req_i1')
        self.assertIsInstance(r.extracted.preferences, list)
        self.assertIn('mani', r.extracted.allergies)
        self.assertIsInstance(r.extracted.negations, list)
        self.assertIsInstance(r.extracted.excludedIngredients, list)

    def test_empty_request(self):
        r = self._post_like({'craving': {'text': '', 'tags': []}, 'restrictions': {}, 'options': {'limit': 5, 'requestId': 'req_empty'}})
        self.assertEqual(r.requestId, 'req_empty')
        self.assertTrue(r.ambiguous or r.confidence <= 0.7)
        self.assertEqual(r.extracted.allergies, [])
        self.assertNotEqual(r.extracted.intent, '')

    # --- unknown fields at all levels ---
    def test_unknown_fields_rejected_top_level(self):
        with self.assertRaises(Exception):
            InterpretRequest.model_validate({'craving': {'text': 'x'}, 'unknownField': 'y'})

    def test_unknown_fields_rejected_craving(self):
        with self.assertRaises(Exception):
            InterpretRequest.model_validate({'craving': {'text': 'x', 'hack': 1}})

    def test_unknown_fields_rejected_restrictions(self):
        with self.assertRaises(Exception):
            InterpretRequest.model_validate({'craving': {'text': 'x'}, 'restrictions': {'allergies': [], 'extra': 'no'}})

    def test_unknown_fields_rejected_options(self):
        with self.assertRaises(Exception):
            InterpretRequest.model_validate({'craving': {'text': 'x'}, 'options': {'limit': 5, 'debug': True}})

    # --- explicit restrictions, negations, allergies/exclusions ---
    def test_explicit_restrictions_preserved(self):
        r = self._post_like({'craving': {'text': 'algo rico'}, 'restrictions': {'allergies': ['gluten'], 'diet': 'vegetarian', 'excludedIngredients': ['queso']}, 'options': {'limit': 3, 'requestId': 'req_r'}})
        self.assertIn('gluten', r.extracted.allergies)
        self.assertEqual(r.extracted.diet, 'vegetarian')
        self.assertIn('queso', r.extracted.excludedIngredients)

    def test_negations_extracted(self):
        r = self._post_like({'craving': {'text': 'quiero tacos sin cebolla y sin cilantro'}, 'restrictions': {}, 'options': {'limit': 5, 'requestId': 'req_n'}})
        joined = ' '.join(r.extracted.negations + r.extracted.excludedIngredients)
        self.assertTrue('cebolla' in joined or 'cilantro' in joined)

    def test_complex_negations(self):
        r = self._post_like({'craving': {'text': 'no quiero carne, sin gluten y evitar lacteos'}, 'restrictions': {}, 'options': {'limit': 5, 'requestId': 'req_cn'}})
        joined = ' '.join([str(x).lower() for x in (r.extracted.negations + r.extracted.excludedIngredients)])
        self.assertTrue(len(r.extracted.negations) >= 1 or len(r.extracted.excludedIngredients) >= 1)
        self.assertTrue(any(k in joined for k in ['carne', 'gluten', 'lacteos', 'lacteo']))

    def test_allergies_and_exclusions_simultaneous(self):
        r = self._post_like({
            'craving': {'text': 'pasta sin ajo'},
            'restrictions': {'allergies': ['mani', 'lacteos'], 'excludedIngredients': ['cebolla'], 'diet': 'vegan'},
            'options': {'limit': 5, 'requestId': 'req_sim'}}
        )
        self.assertTrue({'mani', 'lacteos'}.issubset(set(r.extracted.allergies)))
        self.assertIn('cebolla', r.extracted.excludedIngredients)
        self.assertEqual(r.extracted.diet, 'vegan')
        self.assertNotIn('gluten', r.extracted.allergies)

    # --- contradictions / conservative behavior ---
    def test_contradiction_explicit_vs_inferred_text_does_not_weaken_explicit(self):
        r = self._post_like({
            'craving': {'text': 'quiero algo con carne y tocino'},
            'restrictions': {'diet': 'vegetarian', 'allergies': ['mani']},
            'options': {'limit': 5, 'requestId': 'req_contra'}}
        )
        self.assertEqual(r.extracted.diet, 'vegetarian')
        self.assertIn('mani', r.extracted.allergies)
        self.assertIsInstance(r.extracted.budget.ambiguous, bool)

    def test_contradictory_diets_text_vs_structured_keeps_structured(self):
        r = self._post_like({
            'craving': {'text': 'quiero opciones veganas con queso'},
            'restrictions': {'diet': 'vegan'},
            'options': {'limit': 5, 'requestId': 'req_dietc'}}
        )
        self.assertEqual(r.extracted.diet, 'vegan')

    # --- budget ambiguity/formats/per-person ---
    def test_budget_ambiguous_range(self):
        b = _extract_budget_proposal('quiero algo entre 50 y 100 pesos')
        self.assertTrue(b.ambiguous)
        self.assertIsNone(b.amount)

    def test_budget_per_person(self):
        b = _extract_budget_proposal('presupuesto $80 por persona')
        self.assertTrue(b.perPerson is True)
        self.assertFalse(b.amount is not None and b.ambiguous)

    def test_budget_multiple_amounts_ambiguous(self):
        b = _extract_budget_proposal('tengo $50 o $100 mxn')
        self.assertTrue(b.ambiguous)
        self.assertIsNone(b.amount)

    def test_budget_explicit_mxn_format(self):
        b = _extract_budget_proposal('presupuesto 120 mxn')
        self.assertEqual(b.currency, 'MXN')
        if b.amount is not None:
            self.assertEqual(b.amount, 120.0)
            self.assertFalse(b.ambiguous)

    def test_budget_text_mentions_money_no_amount(self):
        b = _extract_budget_proposal('algo barato en pesos')
        self.assertTrue(b.ambiguous or b.amount is None)
        self.assertTrue(b.confidence <= 0.75)

    # --- requestId absent/valid/invalid-ish ---
    def test_request_id_propagated(self):
        r = self._post_like({'craving': {'text': 'sopa'}, 'restrictions': {}, 'options': {'limit': 5, 'requestId': 'req_fixed_123'}})
        self.assertEqual(r.requestId, 'req_fixed_123')

    def test_request_id_absent_generates_safe(self):
        r = self._post_like({'craving': {'text': 'sopa'}, 'restrictions': {}, 'options': {'limit': 5}})
        self.assertIsInstance(r.requestId, str)
        self.assertTrue(len(r.requestId) > 0)

    def test_request_id_invalid_type_rejected(self):
        with self.assertRaises(Exception):
            InterpretRequest.model_validate({'craving': {'text': 'x'}, 'options': {'requestId': 12345}})

    def test_safe_request_id_helper(self):
        self.assertEqual(_safe_request_id('abc-123'), 'abc-123')
        gen = _safe_request_id('')
        self.assertTrue(gen.startswith('ml_'))
        gen2 = _safe_request_id(None)
        self.assertTrue(len(gen2) > 0)

    # --- limits / long / incomplete ---
    def test_text_length_limit_rejected(self):
        with self.assertRaises(Exception):
            InterpretRequest.model_validate({'craving': {'text': 'a' * 501, 'tags': []}, 'restrictions': {}, 'options': {'limit': 5}})

    def test_very_long_tag_list_handled(self):
        tags = [f't{i}' for i in range(50)]
        r = self._post_like({'craving': {'text': 'tacos', 'tags': tags}, 'restrictions': {}, 'options': {'limit': 5, 'requestId': 'req_tags'}})
        self.assertIsInstance(r.extracted.preferences, list)

    def test_limit_bounds_rejected(self):
        with self.assertRaises(Exception):
            InterpretRequest.model_validate({'craving': {'text': 'x'}, 'restrictions': {}, 'options': {'limit': 0}})
        with self.assertRaises(Exception):
            InterpretRequest.model_validate({'craving': {'text': 'x'}, 'restrictions': {}, 'options': {'limit': 11}})

    def test_missing_optional_sections_still_valid(self):
        r = self._post_like({'options': {'requestId': 'req_min'}})
        self.assertEqual(r.requestId, 'req_min')
        self.assertEqual(r.extracted.intent, 'recommendation')

    def test_incomplete_restrictions_fields_tolerated_by_defaults(self):
        r = self._post_like({'craving': {'text': 'pizza'}, 'restrictions': {'diet': 'none'}, 'options': {'requestId': 'req_ir'}})
        self.assertEqual(r.extracted.diet, 'none')
        self.assertEqual(r.extracted.allergies, [])

    def test_no_inference_confirms_unknown_safety(self):
        r = self._post_like({'craving': {'text': 'quiero una hamburguesa'}, 'restrictions': {}, 'options': {'requestId': 'req_safe'}})
        self.assertEqual(r.extracted.allergies, [])
        self.assertIsInstance(r.extracted.budget.ambiguous, bool)

    # =========================================================================
    # R2 TERCER CORTE - Objetivo A: ampliación de pruebas de interpretación
    # Conservadurismo ante ambigüedad/contradicción; ninguna inferencia convierte
    # una restricción desconocida en una condición de seguridad confirmada.
    # =========================================================================

    # --- contradicciones explícitas vs inferidas ---
    def test_contradiction_explicit_allergy_vs_text_mention_keeps_explicit(self):
        r = self._post_like({'craving': {'text': 'quiero algo con mani'}, 'restrictions': {'allergies': ['mani'], 'diet': 'none'}, 'options': {'requestId': 'req_c1'}})
        # la mención en texto no elimina la alergia explícita
        self.assertIn('mani', r.extracted.allergies)

    def test_inferred_text_does_not_create_safety_claim(self):
        # sin info de restricciones, la extracción no afirma compatibilidad
        r = self._post_like({'craving': {'text': 'tacos de res'}, 'restrictions': {}, 'options': {'requestId': 'req_c2'}})
        d = r.extracted.model_dump()
        # no existen campos que afirmen "seguro" o "compatible"
        self.assertFalse(any(k in d for k in ('safe', 'compatible', 'verified', 'compatible_segun_datos', 'allergenFree')))
        self.assertEqual(r.extracted.allergies, [])

    def test_diet_not_inferred_from_text_when_structured_none(self):
        r = self._post_like({'craving': {'text': 'algo rico'}, 'restrictions': {'diet': 'none'}, 'options': {'requestId': 'req_c3'}})
        self.assertEqual(r.extracted.diet, 'none')

    def test_diet_normalization_variants(self):
        cases = {'vegetariana': 'vegetarian', 'Vegetarian': 'vegetarian', 'vegana': 'vegan', 'Vegan': 'vegan', 'sin-gluten': 'sin_gluten', 'gluten_free': 'gluten_free'}
        for raw, expected in cases.items():
            r = self._post_like({'craving': {'text': 'x'}, 'restrictions': {'diet': raw}, 'options': {'requestId': 'req_dn'}})
            self.assertEqual(r.extracted.diet, expected, f'diet {raw!r} -> {expected!r}')

    def test_contradictory_diets_structured_wins_over_text(self):
        r = self._post_like({'craving': {'text': 'quiero opciones veganas pero con queso y huevo'}, 'restrictions': {'diet': 'vegetarian'}, 'options': {'requestId': 'req_c4'}})
        self.assertEqual(r.extracted.diet, 'vegetarian')

    # --- negaciones complejas / significado conservado ---
    def test_multiple_comma_negations_preserved(self):
        r = self._post_like({'craving': {'text': 'sin cebolla, sin cilantro, sin ajo'}, 'restrictions': {}, 'options': {'requestId': 'req_n2'}})
        joined = set(str(x).lower() for x in (r.extracted.negations + r.extracted.excludedIngredients))
        self.assertTrue({'cebolla', 'cilantro', 'ajo'}.issubset(joined))

    def test_negation_term_appears_in_exclusions(self):
        r = self._post_like({'craving': {'text': 'sin cerdo'}, 'restrictions': {}, 'options': {'requestId': 'req_n3'}})
        joined = ' '.join(str(x).lower() for x in (r.extracted.negations + r.extracted.excludedIngredients))
        self.assertIn('cerdo', joined)

    def test_allergies_and_exclusions_simultaneous_expanded(self):
        r = self._post_like({'craving': {'text': 'pasta sin ajo y sin queso'}, 'restrictions': {'allergies': ['mani', 'lacteos'], 'excludedIngredients': ['cebolla'], 'diet': 'vegan'}, 'options': {'limit': 5, 'requestId': 'req_sim2'}})
        self.assertTrue({'mani', 'lacteos'}.issubset(set(r.extracted.allergies)))
        self.assertIn('cebolla', r.extracted.excludedIngredients)
        self.assertEqual(r.extracted.diet, 'vegan')

    # --- presupuesto: formatos, por persona, ambigüedad, fuera de rango ---
    def test_budget_dollar_format(self):
        b = _extract_budget_proposal('$80')
        self.assertFalse(b.ambiguous)
        self.assertEqual(b.amount, 80.0)
        self.assertEqual(b.currency, 'MXN')

    def test_budget_peso_word_format(self):
        b = _extract_budget_proposal('80 pesos')
        self.assertFalse(b.ambiguous)
        self.assertEqual(b.amount, 80.0)
        self.assertEqual(b.currency, 'MXN')

    def test_budget_decimal_format(self):
        b = _extract_budget_proposal('$80.50')
        self.assertFalse(b.ambiguous)
        self.assertEqual(b.amount, 80.5)

    def test_budget_mxn_prefix_format(self):
        b = _extract_budget_proposal('mxn 120')
        self.assertEqual(b.currency, 'MXN')
        self.assertFalse(b.ambiguous)
        self.assertEqual(b.amount, 120.0)

    def test_budget_per_person_various_phrasings(self):
        for phrase in ['por persona', 'por cabeza', 'cada quien', 'c/u', 'por integrante']:
            b = _extract_budget_proposal('presupuesto $80 ' + phrase)
            self.assertTrue(b.perPerson is True, f'perPerson para {phrase!r}')

    def test_budget_range_with_dash_ambiguous(self):
        b = _extract_budget_proposal('presupuesto 50-100 pesos')
        self.assertTrue(b.ambiguous)
        self.assertIsNone(b.amount)

    def test_budget_out_of_bounds_amount_none(self):
        b = _extract_budget_proposal('$500000')
        self.assertIsNone(b.amount)

    def test_budget_absent_when_no_money_context(self):
        b = _extract_budget_proposal('quiero unos tacos ricos')
        self.assertIsNone(b.amount)
        self.assertIsNone(b.currency)

    # --- requestId: ausente/válido/inválido/límites ---
    def test_request_id_too_long_sanitized_not_echoed(self):
        # un requestId que excede 128 no se rechaza en el modelo, pero el endpoint
        # lo sanea conservadoramente (no lo devuelve tal cual) -> el backend lo
        # descartaría por mismatch. Documenta el comportamiento real.
        long_id = 'a' * 129
        r = self._post_like({'craving': {'text': 'x'}, 'restrictions': {}, 'options': {'limit': 5, 'requestId': long_id}})
        self.assertNotEqual(r.requestId, long_id)
        self.assertTrue(len(r.requestId) <= 128)

    def test_request_id_exactly_128_accepted(self):
        rid = 'r' * 128
        r = self._post_like({'craving': {'text': 'x'}, 'restrictions': {}, 'options': {'limit': 5, 'requestId': rid}})
        self.assertEqual(r.requestId, rid)

    # --- entradas excesivamente largas / límites ---
    def test_text_exactly_500_accepted(self):
        r = self._post_like({'craving': {'text': 'a' * 500, 'tags': []}, 'restrictions': {}, 'options': {'requestId': 'req_len'}})
        self.assertEqual(r.requestId, 'req_len')

    def test_long_allergies_list_capped(self):
        allergies = [f'a{i}' for i in range(30)]
        r = self._post_like({'craving': {'text': 'x'}, 'restrictions': {'allergies': allergies}, 'options': {'requestId': 'req_la'}})
        self.assertLessEqual(len(r.extracted.allergies), 20)

    def test_long_excluded_ingredients_capped(self):
        exc = [f'ing{i}' for i in range(30)]
        r = self._post_like({'craving': {'text': 'x'}, 'restrictions': {'excludedIngredients': exc}, 'options': {'requestId': 'req_le'}})
        self.assertLessEqual(len(r.extracted.excludedIngredients), 20)

    # --- campos desconocidos en todos los niveles (refuerzo) ---
    def test_unknown_field_in_restrictions_budget_like_rejected(self):
        with self.assertRaises(Exception):
            InterpretRequest.model_validate({'craving': {'text': 'x'}, 'restrictions': {'budgetFoo': 1}, 'options': {'limit': 5}})

    def test_unknown_field_in_extracted_not_possible_via_strict_model(self):
        # el modelo de respuesta es estricto; interpret() no puede añadir campos de seguridad
        r = self._post_like({'craving': {'text': 'x'}, 'restrictions': {}, 'options': {'requestId': 'req_strict'}})
        self.assertEqual(set(r.extracted.model_dump().keys()), {'intent', 'preferences', 'allergies', 'diet', 'excludedIngredients', 'budget', 'entities', 'negations'})

    # --- ambigüedad marcada ante ausencia total de info ---
    def test_fully_empty_input_marks_ambiguous(self):
        r = self._post_like({'craving': {'text': '', 'tags': []}, 'restrictions': {}, 'options': {'limit': 5, 'requestId': 'req_emp'}})
        self.assertTrue(r.ambiguous)
        self.assertLessEqual(r.confidence, 0.5)

    def test_response_shape_strict_no_extra_top_level(self):
        r = self._post_like({'craving': {'text': 'tacos'}, 'restrictions': {}, 'options': {'requestId': 'req_shape'}})
        self.assertEqual(set(r.model_dump().keys()), {'requestId', 'extracted', 'confidence', 'ambiguous', 'meta'})


if __name__ == '__main__':
    unittest.main()
