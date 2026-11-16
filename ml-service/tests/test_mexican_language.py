import unittest
from linguistic import REGISTRY, analyze
from main import InterpretRequest, interpret, _extract_budget_proposal, _requested_spice


class MexicanSpanishTests(unittest.TestCase):
    def concepts(self, text):
        return {m['concept'] for m in analyze(text)['mentions']}

    def test_registry_is_versioned_and_has_structured_relations(self):
        self.assertNotEqual(REGISTRY['version'], 'unavailable')
        self.assertGreaterEqual(len(REGISTRY['concepts']), 50)
        self.assertGreaterEqual(sum(len(v) for c in REGISTRY['concepts'] for v in c['forms'].values()), 250)
        shrimp = next(c for c in REGISTRY['concepts'] if c['id'] == 'camaron')
        self.assertIn({'type':'related_not_equivalent','target':'langostino'}, shrimp['relations'])
        self.assertIn({'type':'subcategory_of','target':'mariscos'}, shrimp['relations'])

    def test_representative_expressions_and_morphology(self):
        examples = {
            'Quiero unos camaronsitos':'camaron', 'Algo bien enchiloso':'picante',
            'Que pique machín':'picante', 'Que no pique nadita':'picante',
            'Un caldito':'caldo', 'Algo bien llenador':'llenador',
            'Traigo 80 varos':'dinero', 'No más de cien pesos':'maximo',
            'Algo bara':'economico', 'Sin nada de puerco':'cerdo',
            'No como carne, pero sí pescado':'pescado', 'No lleve leche':'leche',
            'Un pollito con verduras':'pollo', 'Un postrecito frío':'postre',
            'Quiero algo dulce, pero no empalagoso':'empalagoso'
        }
        for text, expected in examples.items():
            with self.subTest(text=text): self.assertIn(expected, self.concepts(text))

    def test_negation_permission_exception_and_ambiguous_typo(self):
        def role(text, concept):
            return next(m['role'] for m in analyze(text)['mentions'] if m['concept'] == concept)
        self.assertEqual(role('Quiero chile','chile'),'mentioned')
        self.assertEqual(role('Sin chile','chile'),'excluded')
        self.assertEqual(role('Que no pique nadita','picante'),'excluded')
        self.assertEqual(role('No me molesta que pique','picante'),'permitted')
        self.assertEqual(role('No como carne, pero sí pescado','carne'),'excluded')
        self.assertEqual(role('No como carne, pero sí pescado','pescado'),'exception')
        self.assertEqual(role('Sin camaronsitos','camaron'),'ambiguous')
        self.assertEqual(role('Quiero una tortita','torta'),'ambiguous')
        self.assertFalse(_requested_spice('No me molesta que pique'))
        self.assertTrue(_requested_spice('Quiero algo bien picosón'))

    def test_budget_exact_versus_approximate_and_original_text(self):
        self.assertEqual(_extract_budget_proposal('Traigo 80 varos').amount,80)
        self.assertEqual(_extract_budget_proposal('No más de cien pesos').amount,100)
        self.assertEqual(_extract_budget_proposal('No quiero gastar más de 100 varos').amount,100)
        self.assertTrue(_extract_budget_proposal('Como unos 100 pesos').ambiguous)
        self.assertTrue(_extract_budget_proposal('No más de ciento veinte pesos').ambiguous)
        self.assertIsNone(_extract_budget_proposal('No más de ciento veinte pesos').amount)
        text = 'Quiero unos camaronsitos'
        result = interpret(InterpretRequest.model_validate({'craving': {'text':text}}))
        self.assertEqual(result.meta['linguistic']['normalizedText'],text.lower())
        self.assertIn('camaron',result.extracted.preferences)
        excluded = interpret(InterpretRequest.model_validate({'craving': {'text':'Sin nada de puerco'}}))
        self.assertIn('puerco', excluded.extracted.excludedIngredients)
        self.assertNotIn('nada', excluded.extracted.excludedIngredients)

if __name__ == '__main__':
    unittest.main()
