"""Configuration for pytest tests."""

import pytest


def pytest_configure(config):
    """Add custom markers for tests."""
    config.addinivalue_line(
        "markers", "spacy: mark test to require spaCy model"
    )


@pytest.fixture(autouse=True)
def skip_if_spacy_not_available(request):
    """Skip tests that require spaCy if it's not available."""
    if "skipif_spacy_not_available" in request.node.keywords:
        try:
            import spacy
            nlp = spacy.load("es_core_news_sm")
            if nlp is None:
                pytest.skip("spaCy model es_core_news_sm not available")
        except ImportError:
            pytest.skip("spaCy not installed")
        except Exception as e:
            pytest.skip(f"spaCy model not available: {e}")
