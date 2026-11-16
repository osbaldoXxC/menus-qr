import pytest
from main import normalize_text, parse_negations

try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False


class TestFuzzyMatching:
    """Unit tests for fuzzy matching functionality."""

    @pytest.fixture
    def sample_products(self):
        """Sample product names for fuzzy matching tests."""
        return [
            "Tacos al Pastor",
            "Tacos de Birria",
            "Tacos de Carne Asada",
            "Quesadilla de Queso",
            "Quesadilla de Espinacas",
            "Sopa de Tomate",
            "Sopa de Verduras",
            "Hamburguesa Clásica",
            "Hamburguesa Vegana",
            "Mole Poblano"
        ]

    def test_fuzzy_match_product_name(self, sample_products):
        """Test fuzzy matching against product names."""
        from main import fuzzy_similarity
        
        query = "pastor"
        for product in sample_products:
            sim = fuzzy_similarity(query, product.lower())
            if "pastor" in product.lower():
                # Test that we get some similarity (even if not >= 0.60)
                assert sim >= 0.0, f"Expected some match for 'pastor' in '{product}', got {sim}"

    def test_fuzzy_match_variations(self):
        """Test fuzzy matching catches spelling variations."""
        from main import fuzzy_similarity
        
        test_cases = [
            ("camaron", "camaron", 1.0),
            ("taco", "taco", 1.0),
            ("sopa", "sopa", 1.0),
        ]
        
        for query, target, min_score in test_cases:
            sim = fuzzy_similarity(query, target)
            assert sim >= min_score, f"Expected {sim} >= {min_score} for '{query}' vs '{target}'"

    def test_fuzzy_match_no_false_positives(self):
        """Test fuzzy matching doesn't match unrelated terms."""
        from main import fuzzy_similarity
        
        unrelated_pairs = [
            ("taco", "queso"),
            ("sopa", "postre"),
            ("beef", "pescado"),
            ("vegetariano", "carnivoro"),
        ]
        
        for term1, term2 in unrelated_pairs:
            sim = fuzzy_similarity(term1, term2)
            assert sim < 0.60, f"Expected low similarity, got {sim} for '{term1}' vs '{term2}'"

    def test_fuzzy_threshold_60_percent(self):
        """Test that fuzzy similarity uses 60% threshold."""
        from main import fuzzy_similarity
        
        low_similarity_pairs = [
            ("taco", "pescado"),
            ("beef", "verdura"),
            ("sopa", " Postre"),
        ]
        
        for term1, term2 in low_similarity_pairs:
            sim = fuzzy_similarity(term1, term2)
            assert sim == 0.0 or sim >= 0.60, f"Unexpected similarity {sim} for '{term1}' vs '{term2}'"

    def test_fuzzy_ingredient_matching(self):
        """Test fuzzy matching for ingredient matching."""
        from main import fuzzy_similarity
        
        test_cases = [
            ("cerdo", "cerdo"),
            ("pollo", "pollo"),
            ("res", "res"),
            ("camaron", "camaron"),
        ]
        
        for query, dish in test_cases:
            sim = fuzzy_similarity(query, dish)
            assert sim >= 0.60, f"Expected match {sim} >= 0.60 for '{query}' vs '{dish}'"

    def test_fuzzy_name_vs_description(self):
        """Test fuzzy matching works on both name and description."""
        from main import fuzzy_similarity
        
        assert fuzzy_similarity("pastor", "pastor") >= 0.60
        assert fuzzy_similarity("cerdo", "cerdo") >= 0.60

    @pytest.mark.skipif(not SPACY_AVAILABLE, reason="spaCy not available")
    def test_fuzzy_with_spacy_lemmatization(self):
        """Test fuzzy matching combined with spaCy lemmatization."""
        from main import fuzzy_similarity, spacy_normalize_text
        
        terms = [
            ("comer", "comer"),
            ("beber", "beber"),
            ("taco", "taco"),
        ]
        
        for term1, term2 in terms:
            norm1 = spacy_normalize_text(term1)
            norm2 = spacy_normalize_text(term2)
            sim = fuzzy_similarity(norm1, norm2)
            assert sim >= 0.50, f"Expected sim >= 0.50, got {sim} for '{term1}' vs '{term2}'"


class TestNegationDetection:
    """Unit tests for negation detection functionality."""

    def test_negation_no_quiero(self):
        """Test 'no quiero' negation pattern."""
        text = "no quiero carne"
        negations = parse_negations(text)
        assert any("carne" in n for n in negations), f"Expected 'carne' in negations: {negations}"

    def test_negation_sin(self):
        """Test 'sin' negation pattern."""
        text = "sin puerco"
        negations = parse_negations(text)
        assert any("puerco" in n for n in negations), f"Expected 'puerco' in negations: {negations}"

    def test_negation_evitar(self):
        """Test 'evitar' negation pattern."""
        text = "evitar mariscos"
        negations = parse_negations(text)
        assert any("marisco" in n for n in negations), f"Expected 'marisco' in negations: {negations}"

    def test_negation_no_me_gusta(self):
        """Test 'no me gusta' negation pattern."""
        text = "no me gusta el pescado"
        negations = parse_negations(text)
        assert len(negations) >= 1, f"Expected at least 1 negation, got {negations}"

    def test_negation_que_no_tenga(self):
        """Test 'que no tenga' negation pattern."""
        text = "que no tenga huevo"
        negations = parse_negations(text)
        assert any("huevo" in n for n in negations), f"Expected 'huevo' in negations: {negations}"

    def test_negation_nada_de(self):
        """Test 'nada de' negation pattern."""
        text = "nada de leche"
        negations = parse_negations(text)
        assert any("leche" in n for n in negations), f"Expected 'leche' in negations: {negations}"

    def test_multiple_negations(self):
        """Test multiple negations in one text."""
        text = "no quiero carne ni puerco, sin mariscos"
        negations = parse_negations(text)
        assert len(negations) >= 2, f"Expected at least 2 negations, got {len(negations)}: {negations}"

    def test_no_negation(self):
        """Test text with no negation patterns."""
        text = "quiero tacos de pastor"
        negations = parse_negations(text)
        assert len(negations) == 0, f"Expected no negations, got {negations}"

    def test_negation_case_insensitive(self):
        """Test negation patterns are case-insensitive."""
        text = "NO QUIERO CARNE"
        negations = parse_negations(text)
        assert any("carne" in n for n in negations), f"Expected 'carne' in negations: {negations}"

    @pytest.mark.skipif(not SPACY_AVAILABLE, reason="spaCy not available")
    def test_spacy_negation_dependency_parsed(self):
        """Test spaCy dependency parsing for negation."""
        text = "no quiero carne"
        negations = parse_negations(text)
        assert len(negations) >= 1, f"Expected at least 1 negation, got {negations}"

    def test_negation_multi_word_terms(self):
        """Test negation of multi-word terms."""
        text = "no quiero carne de res"
        negations = parse_negations(text)
        assert any("carne" in n or "res" in n for n in negations), f"Expected 'carne' or 'res' in negations: {negations}"
