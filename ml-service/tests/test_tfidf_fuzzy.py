import pytest
from main import normalize_text, fuzzy_similarity, levenshtein_distance, parse_negations

try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False


class TestTFIDFMatching:
    """Unit tests for TF-IDF matching functionality."""

    def test_normalize_text_basic(self):
        """Test basic text normalization."""
        assert normalize_text("Hola Mundo") == "hola mundo"
        assert normalize_text("  Hola  Mundo  ") == "hola mundo"
        assert normalize_text("") == ""
        assert normalize_text(None) == ""

    def test_normalize_text_accent_removal(self):
        """Test accent removal during normalization."""
        assert normalize_text("añod") == "anod"
        assert normalize_text("café") == "cafe"
        assert normalize_text("niño") == "nino"

    def test_normalize_text_special_chars(self):
        """Test special character removal."""
        assert normalize_text("hola!") == "hola"
        assert normalize_text("mundo...") == "mundo"
        assert normalize_text("test@#$") == "test"

    def test_fuzzy_similarity_exact_match(self):
        """Test fuzzy similarity with exact matches."""
        assert fuzzy_similarity("taco", "taco") == 1.0
        assert fuzzy_similarity("TACO", "taco") == 1.0

    def test_fuzzy_similarity_no_match(self):
        """Test fuzzy similarity with very different strings."""
        assert fuzzy_similarity("taco", "beef") == 0.0

    def test_fuzzy_similarity_partial_match(self):
        """Test fuzzy similarity with partial matches."""
        sim = fuzzy_similarity("taco", "tacos")
        assert 0.60 <= sim <= 1.0

    def test_fuzzy_similarity_levenshtein_distance(self):
        """Test Levenshtein distance calculation."""
        assert levenshtein_distance("taco", "taco") == 0
        assert levenshtein_distance("taco", "tacos") == 1
        assert levenshtein_distance("taco", "beef") == 4

    def test_fuzzy_similarity_case_insensitive(self):
        """Test fuzzy similarity is case-insensitive."""
        assert fuzzy_similarity("TACO", "taco") == 1.0
        assert fuzzy_similarity("Al Pastor", "al pastor") == 1.0

    def test_fuzzy_similarity_empty_strings(self):
        """Test fuzzy similarity with empty strings."""
        assert fuzzy_similarity("", "") == 0.0
