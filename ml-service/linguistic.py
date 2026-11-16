"""Small, versioned local vocabulary: signals only, never catalog evidence."""
import json
import os
import re
import unicodedata
from pathlib import Path


def normalize(text):
    decomposed = unicodedata.normalize('NFD', str(text or '').lower())
    return ' '.join(re.sub(r'[^a-z0-9\s]', ' ', ''.join(c for c in decomposed if not unicodedata.combining(c))).split())


def _load():
    paths = [os.getenv('MEXXICAN_VOCAB_PATH'), '/app/shared/mexican-spanish-v1.json',
             str(Path(__file__).resolve().parent.parent / 'shared' / 'mexican-spanish-v1.json')]
    for path in filter(None, paths):
        try:
            with open(path, encoding='utf-8') as source:
                data = json.load(source)
            if isinstance(data.get('concepts'), list) and isinstance(data.get('version'), str):
                return data
        except (OSError, ValueError, TypeError):
            continue
    return {'version': 'unavailable', 'concepts': []}


REGISTRY = _load()
INDEX = []
for concept in REGISTRY['concepts']:
    for relation, variants in concept.get('forms', {}).items():
        for variant in variants:
            form = normalize(variant)
            if form:
                INDEX.append((re.compile(r'(?<!\w)' + re.escape(form) + r'(?!\w)'), concept, relation, form))
INDEX.sort(key=lambda item: -len(item[3]))


def analyze(text):
    normalized = normalize(text)
    mentions = []
    occupied = set()
    for pattern, concept, relation, form in INDEX:
        for match in pattern.finditer(normalized):
            span = set(range(match.start(), match.end()))
            if occupied.intersection(span):
                continue
            prior = re.split(r'\bpero\b', normalized[:match.start()])[-1]
            if form == 'pique' and not re.search(r'\b(?:que|no)\s*$', prior):
                continue
            role = 'mentioned'
            if relation == 'ambiguous_contextual':
                role = 'ambiguous'
            elif re.search(r'\bno me molesta(?: que)?\s*$', prior) and concept['id'] == 'picante':
                role = 'permitted'
            elif re.search(r'\b(?:sin|no|no como|no puedo comer|no lleve|no tenga|no traiga|evita)\s+(?:nada de\s+)?$', prior):
                role = 'excluded' if relation != 'typo_contextual' else 'ambiguous'
            elif re.search(r'\bsi\s*$', prior):
                role = 'exception'
            mentions.append({'concept': concept['id'], 'category': concept['category'], 'form': form,
                             'relation': relation, 'role': role, 'source': concept.get('formSources', {}).get(form, concept['source']),
                             'normalizedSpan': [match.start(), match.end()]})
            occupied.update(span)
    mentions.sort(key=lambda item: item['normalizedSpan'][0])
    return {'version': REGISTRY['version'], 'normalizedText': normalized, 'mentions': mentions}
