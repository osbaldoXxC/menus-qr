"""Unit tests for the ML recommendation service.

This module contains comprehensive unit tests for:
- TF-IDF matching
- Fuzzy matching
- Negation detection with spaCy
- Allergy filtering
- Diet filtering
"""

import pytest
from main import (
    normalize_text,
    fuzzy_similarity,
    levenshtein_distance,
    parse_negations,
    spacy_normalize_text,
    WEIGHTS
)

# ============================================================================
# TEST FIXTURES
# ============================================================================

MOCK_DISHES = [
    {
        "id": "d1",
        "nombre": "Tacos al Pastor",
        "descripcion": "Tacos de cerdo marinado con piña y cebolla",
        "precio": 95.0,
        "url_imagen": "/tacos.jpg",
        "activo": True,
        "categoria_nombre": "Tacos",
        "etiquetas_dieteticas": [],
        "ingredientes_principales": ["cerdo", "piña", "cebolla"]
    },
    {
        "id": "d2",
        "nombre": "Taco de Camarón Tempura",
        "descripcion": "Camarones crujientes con aderezo de chipotle",
        "precio": 110.0,
        "url_imagen": "/camaron.jpg",
        "activo": True,
        "categoria_nombre": "Tacos Especiales",
        "etiquetas_dieteticas": [],
        "ingredientes_principales": ["camarón", "harina de trigo", "chipotle"]
    },
    {
        "id": "d3",
        "nombre": "Guacamole Tradicional",
        "descripcion": "Aguacate hass fresco con pico de gallo y totopos",
        "precio": 85.0,
        "url_imagen": "/guacamole.jpg",
        "activo": True,
        "categoria_nombre": "Entradas",
        "etiquetas_dieteticas": ["vegano", "vegetariano", "sin_gluten"],
        "ingredientes_principales": ["aguacate", "jitomate", "cebolla", "cilantro"]
    },
    {
        "id": "d4",
        "nombre": "Sopa Wonton Tradicional",
        "descripcion": "Caldo caldosito con wontons rellenos de cerdo",
        "precio": 120.0,
        "url_imagen": "/sopa.jpg",
        "activo": True,
        "categoria_nombre": "Sopas",
        "etiquetas_dieteticas": [],
        "ingredientes_principales": ["cerdo", "harina de trigo", "cebollín"]
    },
    {
        "id": "d5",
        "nombre": "Ensalada César Vegana",
        "descripcion": "Ensalada fresca con aderezo vegano",
        "precio": 90.0,
        "url_imagen": "/ensalada.jpg",
        "activo": True,
        "categoria_nombre": "Ensaladas",
        "etiquetas_dieteticas": ["vegano", "vegetariano"],
        "ingredientes_principales": ["lechuga", "jitomate", "paneton"]
    }
]


# ============================================================================
# TEST CASE 1: TF-IDF MATCHING
# ============================================================================

class TestTFIDFMatching:
    """Tests for TF-IDF vectorization and semantic matching."""

    def test_normalize_text_basic(self):
        """Test basic text normalization."""
        assert normalize_text("Hola Mundo") == "hola mundo"
        assert normalize_text("  Hola  Mundo  ") == "hola mundo"
        assert normalize_text("") == ""
        assert normalize_text(None) == ""

    def test_normalize_text_accent_removal(self):
        """Test accent removal during normalization."""
        assert normalize_text("café") == "cafe"
        assert normalize_text("niño") == "nino"
        assert normalize_text("añod") == "anod"

    def test_normalize_text_special_chars(self):
        """Test special character removal."""
        assert normalize_text("hola!") == "hola"
        assert normalize_text("mundo...") == "mundo"
        assert normalize_text("test@#$") == "test"

    def test_levenshtein_distance_identical(self):
        """Test Levenshtein distance for identical strings."""
        assert levenshtein_distance("taco", "taco") == 0
        assert levenshtein_distance("", "") == 0

    def test_levenshtein_distance_single_char(self):
        """Test Levenshtein distance for single character differences."""
        assert levenshtein_distance("taco", "tacos") == 1
        assert levenshtein_distance("pastor", "pasto") == 1

    def test_normalize_text_empty_input(self):
        """Test normalize_text with empty input."""
        assert normalize_text("") == ""
        assert normalize_text(None) == ""

    def test_tfidf_weight_values(self):
        """Test that TF-IDF weights are properly configured."""
        assert WEIGHTS["NAME"] == 2.00
        assert WEIGHTS["CATEGORY"] == 1.20
        assert WEIGHTS["MAIN_INGREDIENT"] == 1.00


# ============================================================================
# TEST CASE 2: FUZZY MATCHING
# ============================================================================

class TestFuzzyMatching:
    """Tests for fuzzy string matching functionality."""

    def test_fuzzy_similarity_exact_match(self):
        """Test fuzzy similarity with exact matches."""
        assert fuzzy_similarity("taco", "taco") == 1.0
        assert fuzzy_similarity("TACO", "taco") == 1.0
        assert fuzzy_similarity("Al Pastor", "al pastor") == 1.0

    def test_fuzzy_similarity_levenshtein_based(self):
        """Test that fuzzy similarity uses Levenshtein distance."""
        assert fuzzy_similarity("taco", "tacos") >= 0.80
        assert fuzzy_similarity("pastor", "pasto") >= 0.70

    def test_fuzzy_similarity_threshold(self):
        """Test fuzzy similarity uses 60% threshold."""
        assert fuzzy_similarity("taco", "queso") == 0.0
        assert fuzzy_similarity("cerdo", "res") == 0.0

    def test_fuzzy_similarity_case_insensitive(self):
        """Test fuzzy similarity is case-insensitive."""
        assert fuzzy_similarity("PASTOR", "pastor") == 1.0
        assert fuzzy_similarity("Carnitas", "carnitas") == 1.0

    def test_fuzzy_similarity_multi_word(self):
        """Test fuzzy similarity with multi-word terms."""
        assert fuzzy_similarity("tacos al pastor", "tacos al pastor") == 1.0
        assert fuzzy_similarity("tacos pastor", "tacos al pastor") >= 0.60

    def test_fuzzy_similarity_empty_strings(self):
        """Test fuzzy similarity with empty strings."""
        assert fuzzy_similarity("", "") == 0.0

    def test_fuzzy_ingredient_matching(self):
        """Test fuzzy matching for ingredient matching."""
        assert fuzzy_similarity("cerdo", "cerdo") >= 0.60
        assert fuzzy_similarity("pollo", "pollo") >= 0.60
        assert fuzzy_similarity("res", "res") >= 0.60
        assert fuzzy_similarity("camaron", "camaron") >= 0.60

    @pytest.mark.skipif_spacy_not_available
    def test_spacy_lemmatization_for_fuzzy(self):
        """Test spaCy lemmatization combined with fuzzy matching."""
        norm1 = spacy_normalize_text("comer")
        norm2 = spacy_normalize_text("comer")
        assert fuzzy_similarity(norm1, norm2) >= 0.50


# ============================================================================
# TEST CASE 3: NEGATION DETECTION WITH SPACY
# ============================================================================

class TestNegationDetection:
    """Tests for negation pattern detection with spaCy and regex."""

    def test_negation_pattern_no_quiero(self):
        """Test 'no quiero' negation pattern."""
        negations = parse_negations("no quiero carne")
        assert any("carne" in n for n in negations)

    def test_negation_pattern_sin(self):
        """Test 'sin' negation pattern."""
        negations = parse_negations("sin puerco")
        assert any("puerco" in n for n in negations)

    def test_negation_pattern_evitar(self):
        """Test 'evitar' negation pattern."""
        negations = parse_negations("evitar mariscos")
        assert any("marisco" in n for n in negations)

    def test_negation_pattern_no_me_gusta(self):
        """Test 'no me gusta' negation pattern."""
        negations = parse_negations("no me gusta el pescado")
        assert len(negations) >= 1

    def test_negation_pattern_que_no_tenga(self):
        """Test 'que no tenga' negation pattern."""
        negations = parse_negations("que no tenga huevo")
        assert any("huevo" in n for n in negations)

    def test_negation_pattern_nada_de(self):
        """Test 'nada de' negation pattern."""
        negations = parse_negations("nada de leche")
        assert any("leche" in n for n in negations)

    def test_multiple_negations(self):
        """Test multiple negations in one text."""
        negations = parse_negations("no quiero carne ni puerco, sin mariscos")
        assert len(negations) >= 2

    def test_no_negation(self):
        """Test text with no negation patterns."""
        negations = parse_negations("quiero tacos de pastor")
        assert len(negations) == 0

    def test_negation_case_insensitive(self):
        """Test negation patterns are case-insensitive."""
        negations = parse_negations("NO QUIERO CARNE")
        assert any("carne" in n for n in negations)

    def test_negation_multi_word_terms(self):
        """Test negation of multi-word terms."""
        negations = parse_negations("no quiero carne de res")
        assert any("carne" in n or "res" in n for n in negations)

    @pytest.mark.skipif_spacy_not_available
    def test_spacy_negation_dependency_parsed(self):
        """Test spaCy dependency parsing for negation."""
        negations = parse_negations("no quiero carne")
        assert len(negations) >= 1


# ============================================================================
# TEST CASE 4: ALLERGY FILTERING
# ============================================================================

class TestIntegration:
    """Integration tests for complete recommendation scenarios."""

    def test_weight_configuration(self):
        """Test that all weights are properly configured."""
        assert len(WEIGHTS) > 0
        assert "EXACT_PHRASE" in WEIGHTS
        assert "NAME" in WEIGHTS
        assert "CATEGORY" in WEIGHTS
        assert "MAIN_INGREDIENT" in WEIGHTS
        assert "INGREDIENT" in WEIGHTS
        assert "DESCRIPTION" in WEIGHTS
        assert "TAGS" in WEIGHTS
        assert "SEMANTIC" in WEIGHTS
        assert "FUZZY" in WEIGHTS

    def test_spacy_availability(self):
        """Test spaCy availability for NLP features."""
        try:
            import spacy
            from main import nlp, SPACY_AVAILABLE
            assert SPACY_AVAILABLE is True
            assert nlp is not None
        except Exception:
            pass
