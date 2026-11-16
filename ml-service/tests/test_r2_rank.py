import unittest
import math
from main import RankRequest, rank, RankItem


class TestR2Rank(unittest.TestCase):
    def _rank(self, payload):
        req = RankRequest.model_validate(payload)
        return rank(req)

    def test_shrimp_prioritized_and_chicken_is_partial(self):
        result = self._rank({'requestId':'shrimp', 'craving':{'text':'Quiero camarones'}, 'candidates':[
            {'id':'chicken', 'nombre':'Pollo asado', 'ingredientes_principales':['pollo']},
            {'id':'shrimp', 'nombre':'Camarones al limón', 'ingredientes_principales':['camarones']}]})
        self.assertEqual([item.dishId for item in result.ranked], ['shrimp','chicken'])
        self.assertLess(result.ranked[1].score, result.ranked[0].score)
        self.assertIn('No consta camarón en los datos del menú; coincidencia parcial.', result.ranked[1].reasons)

    def test_spicy_chicken_prefers_declared_spice_over_plain_chicken(self):
        result = self._rank({'requestId': 'spice', 'craving': {'text': 'Tengo ganas de comer pollo, pero quiero que pique bastante.'},
            'candidates': [
                {'id': 'plain', 'nombre': 'Pollo al horno', 'ingredientes_principales': ['pollo'], 'nivel_picante': 0},
                {'id': 'hot', 'nombre': 'Pollo con verduras', 'ingredientes_principales': ['pollo', 'chile'], 'nivel_picante': 3},
            ]})
        self.assertEqual(result.ranked[0].dishId, 'hot')
        self.assertIn('Nivel de picante declarado en el menú.', result.ranked[0].reasons)
        self.assertEqual({x.dishId for x in result.ranked}, {'hot', 'plain'})

    def test_spicy_request_rates_unspiced_chicken_as_partial(self):
        result = self._rank({'requestId': 'spicy-exact', 'craving': {'text': 'Quiero pollo que pique bastante'},
            'candidates': [
                {'id': 'plain', 'nombre': 'Pollo asado', 'ingredientes_principales': ['pollo'], 'nivel_picante': 0},
                {'id': 'hot', 'nombre': 'Pollo asado', 'ingredientes_principales': ['pollo'], 'nivel_picante': 4},
            ]})
        hot, plain = result.ranked
        self.assertEqual((hot.dishId, plain.dishId), ('hot', 'plain'))
        self.assertLessEqual(plain.score, 0.495)
        self.assertGreater(hot.score, plain.score)
        self.assertIn('El menú declara nivel de picante 0; coincidencia parcial.', plain.reasons)

    def test_negated_spicy_does_not_prefer_heat(self):
        result = self._rank({'requestId': 'not-spicy', 'craving': {'text': 'Quiero pollo sin picante'},
            'candidates': [
                {'id': 'plain', 'nombre': 'Pollo', 'nivel_picante': 0},
                {'id': 'hot', 'nombre': 'Pollo', 'nivel_picante': 4},
            ]})
        self.assertEqual(result.ranked[0].dishId, 'hot')  # equal relevance uses deterministic ID, no spice bonus
        self.assertNotIn('Nivel de picante declarado en el menú.', result.ranked[0].reasons)

    def test_spice_preference_does_not_invent_a_level(self):
        result = self._rank({'requestId': 'unknown-spice', 'craving': {'text': 'algo picoso'},
            'candidates': [{'id': 'unknown', 'nombre': 'Pollo picante'}]})
        self.assertNotIn('Nivel de picante declarado en el menú.', result.ranked[0].reasons)

    # --- baseline ---
    def test_valid_candidates(self):
        r = self._rank({'requestId': 'req_r1', 'craving': {'text': 'taco pastor'}, 'candidates': [
            {'id': 'a', 'nombre': 'Taco al pastor', 'descripcion': 'cerdo adobado'},
            {'id': 'b', 'nombre': 'Ensalada', 'descripcion': 'lechuga'}
        ], 'options': {'limit': 5}})
        ids = [x.dishId for x in r.ranked]
        self.assertEqual(set(ids), {'a', 'b'})
        self.assertTrue(all(0 <= x.score <= 1 for x in r.ranked))
        self.assertTrue(all(isinstance(x.reasons, list) for x in r.ranked))

    def test_empty_candidates(self):
        r = self._rank({'requestId': 'req_r0', 'candidates': [], 'options': {'limit': 5}})
        self.assertEqual(r.ranked, [])

    def test_single_candidate(self):
        r = self._rank({'requestId': 'req_r1s', 'craving': {'text': 'sopa'}, 'candidates': [{'id': 'x', 'nombre': 'Sopa de pollo'}], 'options': {'limit': 5}})
        self.assertEqual([x.dishId for x in r.ranked], ['x'])

    # --- duplicates / missing ids / manipulated / external ---
    def test_duplicate_ids_ignored(self):
        r = self._rank({'requestId': 'req_dup', 'craving': {'text': 'taco'}, 'candidates': [
            {'id': 'a', 'nombre': 'Taco'}, {'id': 'a', 'nombre': 'Taco duplicado'}, {'id': 'b', 'nombre': 'Sopa'}
        ], 'options': {'limit': 5}})
        ids = [x.dishId for x in r.ranked]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(set(ids).issubset({'a', 'b'}))

    def test_candidates_without_identifier_filtered(self):
        r = self._rank({'requestId': 'req_bad', 'candidates': [{'id': '', 'nombre': 'bad'}, {'id': 'ok', 'nombre': 'Bueno'}], 'options': {'limit': 5}})
        self.assertEqual([x.dishId for x in r.ranked], ['ok'])

    def test_manipulated_extra_fields_rejected_top(self):
        with self.assertRaises(Exception):
            RankRequest.model_validate({'requestId': 'req_x', 'candidates': [{'id': 'a'}], 'options': {'limit': 5}, 'injected': True})

    def test_manipulated_extra_candidate_fields_rejected(self):
        with self.assertRaises(Exception):
            RankRequest.model_validate({'requestId': 'req_cx', 'candidates': [{'id': 'a', 'hack': True}], 'options': {'limit': 5}})

    def test_unknown_fields_rejected_options_craving(self):
        with self.assertRaises(Exception):
            RankRequest.model_validate({'requestId': 'req_o', 'candidates': [{'id': 'a'}], 'options': {'limit': 5, 'x': 1}})
        with self.assertRaises(Exception):
            RankRequest.model_validate({'requestId': 'req_c', 'candidates': [{'id': 'a'}], 'craving': {'text': 'x', 'bad': 1}})

    def test_only_returns_received_candidates_no_external(self):
        r = self._rank({'requestId': 'req_sub', 'craving': {'text': 'taco'}, 'candidates': [{'id': 'only1', 'nombre': 'Taco'}], 'options': {'limit': 5}})
        self.assertTrue(set(x.dishId for x in r.ranked).issubset({'only1'}))
        self.assertNotIn('external', [x.dishId for x in r.ranked])

    # --- scores/reasons bounds ---
    def test_scores_bounded_and_finite(self):
        r = self._rank({'requestId': 'req_s', 'craving': {'text': 'taco'}, 'candidates': [{'id': 'a', 'nombre': 'Taco'}], 'options': {'limit': 5}})
        for it in r.ranked:
            self.assertTrue(math.isfinite(it.score))
            self.assertTrue(0.0 <= it.score <= 0.99)
            self.assertTrue(math.isfinite(it.confidence))

    def test_reasons_nonempty_and_bounded(self):
        r = self._rank({'requestId': 'req_re', 'craving': {'text': 'taco'}, 'candidates': [{'id': 'a', 'nombre': 'Taco'}], 'options': {'limit': 5}})
        for it in r.ranked:
            self.assertIsInstance(it.reasons, list)
            self.assertTrue(len(it.reasons) >= 1)
            self.assertTrue(all(isinstance(x, str) and len(x) <= 240 for x in it.reasons))

    # --- limits / determinism / caps ---
    def test_limit_respected(self):
        cands = [{'id': str(i), 'nombre': f'P {i} taco'} for i in range(10)]
        r = self._rank({'requestId': 'req_lim', 'craving': {'text': 'taco'}, 'candidates': cands, 'options': {'limit': 3}})
        self.assertLessEqual(len(r.ranked), 3)

    def test_max_candidates_capped(self):
        cands = [{'id': str(i), 'nombre': f'Platillo {i}'} for i in range(250)]
        r = self._rank({'requestId': 'req_rcap', 'craving': {'text': 'platillo'}, 'candidates': cands, 'options': {'limit': 10}})
        self.assertLessEqual(r.meta.get('candidateCount', 0), 200)
        self.assertLessEqual(len(r.ranked), 10)

    def test_deterministic_order(self):
        payload = {'requestId': 'req_det', 'craving': {'text': ''}, 'candidates': [
            {'id': 'b', 'nombre': 'Mismo'}, {'id': 'a', 'nombre': 'Mismo'}, {'id': 'c', 'nombre': 'Mismo'}
        ], 'options': {'limit': 5}}
        r1 = [x.dishId for x in self._rank(payload).ranked]
        r2 = [x.dishId for x in self._rank(payload).ranked]
        self.assertEqual(r1, r2)

    # --- requestId / restrictions / incomplete ---
    def test_request_id_required_and_bounded(self):
        with self.assertRaises(Exception):
            RankRequest.model_validate({'requestId': '', 'candidates': [{'id': 'a'}]})
        with self.assertRaises(Exception):
            RankRequest.model_validate({'candidates': [{'id': 'a'}]})

    def test_explicit_restrictions_payload_accepted(self):
        r = self._rank({'requestId': 'req_res', 'craving': {'text': 'algo'}, 'restrictions': {'allergies': ['mani'], 'diet': 'none', 'excludedIngredients': ['queso']}, 'candidates': [{'id': 'a', 'nombre': 'Taco'}], 'options': {'limit': 5}})
        self.assertEqual([x.dishId for x in r.ranked], ['a'])

    def test_incomplete_optional_candidate_fields_ok(self):
        r = self._rank({'requestId': 'req_inc', 'candidates': [{'id': 'a'}], 'options': {'limit': 5}})
        self.assertEqual([x.dishId for x in r.ranked], ['a'])

    def test_response_never_includes_authoritative_extra_fields(self):
        r = self._rank({'requestId': 'req_auth', 'craving': {'text': 'taco'}, 'candidates': [{'id': 'a', 'nombre': 'Taco', 'precio': 50.0}], 'options': {'limit': 5}})
        for it in r.ranked:
            d = it.model_dump() if hasattr(it, 'model_dump') else it.dict()
            self.assertEqual(set(d.keys()), {'dishId', 'score', 'confidence', 'reasons'})

    # =========================================================================
    # R2 TERCER CORTE - Objetivo B: ampliación de pruebas de ranking
    # Ranking limitado estrictamente a candidatos; ML nunca devuelve info
    # autoritativa de platillos ni agrega candidatos.
    # =========================================================================

    # --- scores: siempre acotados y finitos (incluso sin texto) ---
    def test_scores_bounded_empty_text(self):
        r = self._rank({'requestId': 'req_be', 'craving': {'text': ''}, 'candidates': [{'id': 'a'}, {'id': 'b'}, {'id': 'c'}], 'options': {'limit': 5}})
        self.assertTrue(len(r.ranked) >= 1)
        for it in r.ranked:
            self.assertTrue(math.isfinite(it.score))
            self.assertTrue(0.0 <= it.score <= 0.99)
            self.assertTrue(math.isfinite(it.confidence))

    # --- razones: nunca vacías, máximo 3, acotadas a 240 ---
    def test_reasons_count_and_length_bounded(self):
        r = self._rank({'requestId': 'req_r2', 'craving': {'text': 'taco pastor'}, 'candidates': [{'id': 'a', 'nombre': 'Taco al pastor', 'descripcion': 'cerdo'}], 'options': {'limit': 5}})
        for it in r.ranked:
            self.assertIsInstance(it.reasons, list)
            self.assertTrue(1 <= len(it.reasons) <= 3)
            self.assertTrue(all(isinstance(x, str) and len(x) <= 240 for x in it.reasons))

    # --- candidatos externos / extraídos nunca agregados ---
    def test_ranked_subset_with_extracted_preferences(self):
        r = self._rank({'requestId': 'req_ext', 'craving': {'text': 'taco'}, 'candidates': [{'id': 'only1', 'nombre': 'Taco'}], 'options': {'limit': 5}, 'extracted': {'intent': 'recommendation', 'preferences': ['external', 'taco'], 'allergies': [], 'diet': 'none', 'excludedIngredients': [], 'entities': [], 'negations': []}})
        ids = [x.dishId for x in r.ranked]
        self.assertTrue(set(ids).issubset({'only1'}))
        self.assertNotIn('external', ids)

    # --- límites de salida y bounds ---
    def test_limit_zero_rejected_in_rank(self):
        with self.assertRaises(Exception):
            RankRequest.model_validate({'requestId': 'req_l0', 'candidates': [{'id': 'a'}], 'options': {'limit': 0}})

    def test_limit_eleven_rejected_in_rank(self):
        with self.assertRaises(Exception):
            RankRequest.model_validate({'requestId': 'req_l11', 'candidates': [{'id': 'a'}], 'options': {'limit': 11}})

    # --- requestId: bounds y eco ---
    def test_rank_request_id_too_long_rejected(self):
        with self.assertRaises(Exception):
            RankRequest.model_validate({'requestId': 'a' * 129, 'candidates': [{'id': 'a'}], 'options': {'limit': 5}})

    def test_rank_request_id_exactly_128_accepted(self):
        rid = 'r' * 128
        r = self._rank({'requestId': rid, 'candidates': [{'id': 'a'}], 'options': {'limit': 5}})
        self.assertEqual(r.requestId, rid)

    def test_rank_request_id_echoed_in_response(self):
        r = self._rank({'requestId': 'req_echo', 'candidates': [{'id': 'a'}], 'options': {'limit': 5}})
        self.assertEqual(r.requestId, 'req_echo')

    # --- meta con conteos ---
    def test_meta_has_counts(self):
        r = self._rank({'requestId': 'req_meta', 'craving': {'text': 'taco'}, 'candidates': [{'id': 'a'}, {'id': 'b'}], 'options': {'limit': 5}})
        self.assertEqual(r.meta.get('candidateCount'), 2)
        self.assertEqual(r.meta.get('returned'), len(r.ranked))

    # --- ordenamiento determinista: tiebreak por nombre luego id ---
    def test_deterministic_tiebreak_by_name_then_id(self):
        payload = {'requestId': 'req_tb', 'craving': {'text': ''}, 'candidates': [
            {'id': 'b', 'nombre': 'Mismo'}, {'id': 'a', 'nombre': 'Mismo'}, {'id': 'c', 'nombre': 'Mismo'}
        ], 'options': {'limit': 5}}
        r1 = [x.dishId for x in self._rank(payload).ranked]
        r2 = [x.dishId for x in self._rank(payload).ranked]
        self.assertEqual(r1, r2)
        self.assertEqual(r1, ['a', 'b', 'c'])

    # --- texto vacío ranquea todos los candidatos (sin filtrado por relevancia) ---
    def test_empty_text_ranks_all_candidates(self):
        r = self._rank({'requestId': 'req_all', 'craving': {'text': ''}, 'candidates': [{'id': 'a'}, {'id': 'b'}, {'id': 'c'}], 'options': {'limit': 5}})
        self.assertEqual(len(r.ranked), 3)

    # --- forma estricta de respuesta y de cada item ---
    def test_rank_response_shape_strict(self):
        r = self._rank({'requestId': 'req_shape2', 'craving': {'text': 'taco'}, 'candidates': [{'id': 'a', 'nombre': 'Taco'}], 'options': {'limit': 5}})
        self.assertEqual(set(r.model_dump().keys()), {'requestId', 'ranked', 'meta'})
        for it in r.ranked:
            self.assertEqual(set(it.model_dump().keys()), {'dishId', 'score', 'confidence', 'reasons'})

    # --- candidatos duplicados conservan el primero ---
    def test_duplicate_keeps_first_occurrence(self):
        r = self._rank({'requestId': 'req_dup2', 'craving': {'text': 'taco'}, 'candidates': [
            {'id': 'a', 'nombre': 'Taco Uno'}, {'id': 'a', 'nombre': 'Taco Dos'}, {'id': 'b', 'nombre': 'Sopa'}
        ], 'options': {'limit': 5}})
        ids = [x.dishId for x in r.ranked]
        self.assertEqual(ids.count('a'), 1)
        self.assertTrue(set(ids).issubset({'a', 'b'}))

    # --- sin candidatos con identifier inválido se filtran ---
    def test_multiple_empty_id_candidates_filtered(self):
        r = self._rank({'requestId': 'req_ws', 'craving': {'text': 'taco'}, 'candidates': [{'id': '', 'nombre': 'bad1'}, {'id': '', 'nombre': 'bad2'}, {'id': 'ok', 'nombre': 'Bueno'}], 'options': {'limit': 5}})
        ids = [x.dishId for x in r.ranked]
        self.assertEqual(ids, ['ok'])

    # --- respuesta limitada a candidatos recibidos aunque el texto coincida con IDs externos ---
    def test_response_limited_to_received_even_if_text_mentions_others(self):
        r = self._rank({'requestId': 'req_lim2', 'craving': {'text': 'quiero el platillo zzz_invented'}, 'candidates': [{'id': 'a', 'nombre': 'Taco'}], 'options': {'limit': 5}})
        self.assertTrue(set(x.dishId for x in r.ranked).issubset({'a'}))
        self.assertNotIn('zzz_invented', [x.dishId for x in r.ranked])


if __name__ == '__main__':
    unittest.main()
