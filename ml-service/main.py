import os
import re
import math
import time
import unicodedata
from typing import List, Optional, Dict, Any, Tuple
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from linguistic import analyze as analyze_mexican_spanish

app = FastAPI(
    title="MexxicanMX Advanced Semantic ML Recommendation Engine",
    version="2.0.0",
    description="Multi-field semantic search, fuzzy matching, negation handling & strict restriction engine."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    import spacy
    nlp = spacy.load("es_core_news_sm")
    SPACY_AVAILABLE = True
except Exception:
    SPACY_AVAILABLE = False
    nlp = None

# --- CONFIGURACIÃ“N DE PESOS CENTRALIZADA ---
WEIGHTS = {
    "EXACT_PHRASE": 3.00,
    "NAME": 2.00,
    "CATEGORY": 1.20,
    "MAIN_INGREDIENT": 1.00,
    "INGREDIENT": 0.70,
    "DESCRIPTION": 0.50,
    "TAGS": 0.60,
    "SEMANTIC": 0.40,
    "FUZZY": 0.50
}

# --- DICCIONARIO DE CONCEPTOS Y PROTEÃNAS ---
NEGATION_PATTERNS = [
    r'no\s+quiero\s+([a-zÃ¡Ã©Ã­Ã³ÃºÃ±\s]+)',
    r'sin\s+([a-zÃ¡Ã©Ã­Ã³ÃºÃ±\s]+)',
    r'evitar\s+([a-zÃ¡Ã©Ã­Ã³ÃºÃ±\s]+)',
    r'no\s+me\s+gusta\s+([a-zÃ¡Ã©Ã­Ã³ÃºÃ±\s]+)',
    r'que\s+no\s+tenga\s+([a-zÃ¡Ã©Ã­Ã³ÃºÃ±\s]+)',
    r'nada\s+de\s+([a-zÃ¡Ã©Ã­Ã³ÃºÃ±\s]+)'
]

STOP_WORDS = {"quiero", "unos", "unas", "algo", "de", "con", "para", "que", "un", "una", "los", "las", "el", "la", "me", "se", "por", "favor"}

# --- HELPER FUNCTIONS ---

def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    nfkd_form = unicodedata.normalize('NFKD', text)
    text = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return ' '.join(text.split())

def spacy_normalize_text(text: str) -> str:
    if not text:
        return ""
    if not SPACY_AVAILABLE:
        return normalize_text(text)
    doc = nlp(text.lower().strip())
    lemmas = [token.lemma_ for token in doc if not token.is_stop and token.pos_ in ["NOUN", "ADJ", "VERB"]]
    return " ".join(lemmas)

def levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) > len(s2):
        s1, s2 = s2, s1
    distances = range(len(s1) + 1)
    for i2, c2 in enumerate(s2):
        distances_ = [i2+1]
        for i1, c1 in enumerate(s1):
            if c1 == c2:
                distances_.append(distances[i1])
            else:
                distances_.append(1 + min((distances[i1], distances[i1 + 1], distances_[-1])))
        distances = distances_
    return distances[-1]

def fuzzy_similarity(token1: str, token2: str) -> float:
    t1, t2 = normalize_text(token1), normalize_text(token2)
    if not t1 or not t2:
        return 0.0
    if t1 == t2:
        return 1.0
    max_len = max(len(t1), len(t2))
    if max_len == 0:
        return 1.0
    dist = levenshtein_distance(t1, t2)
    sim = 1.0 - (dist / float(max_len))
    return sim if sim >= 0.60 else 0.0


def parse_negations(text: str) -> List[str]:
    negated_terms = []
    text_lower = text.lower()
    
    if SPACY_AVAILABLE and nlp:
        doc = nlp(text_lower)
        for token in doc:
            if token.dep_ == "neg" and token.head.pos_ in ["NOUN", "VERB"]:
                negated_terms.append(spacy_normalize_text(token.head.lemma_))
    
    for pattern in NEGATION_PATTERNS:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            words = match.split()
            if words:
                negated_terms.append(normalize_text(words[0]))
                if len(words) > 1 and words[0] in ["carne", "de"]:
                    negated_terms.append(normalize_text(f"{words[0]} {words[1]}"))
    
    for match in re.finditer(r'\bno\s+(?:lleve|traiga|como|puedo comer)\s+([a-z]+)', normalize_text(text)):
        negated_terms.append(match.group(1))
    # "sin gastar" qualifies a budget; "nada" is not an ingredient in
    # "sin nada de puerco". Keep the actual food term unchanged.
    ignored = {'gastar'}
    if re.search(r'\bsin\s+nada\s+de\b', normalize_text(text)):
        ignored.add('nada')
    if re.search(r'(?<!no\s)\bsin\s+picante\b(?!\s*(?:,|y\b|ni\b|o\b))', text.lower()):
        ignored.add('picante')
    return list(set(term for term in negated_terms if term not in ignored))


# --- MAIN RECOMMENDATION ENDPOINT ---

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "MexxicanMX Advanced Semantic ML Recommendation Engine", "version": "2.0.0"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    
    if SPACY_AVAILABLE:
        print("[INFO] spaCy modelo es_core_news_sm cargado exitosamente para NLP espaÃ±ol")
    else:
        print("[WARN] spaCy no estÃ¡ disponible, usando modo degradado (regex + TF-IDF)")
    
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

# =========================
# R2 ML V2 internal endpoints (additive, DEC-003/DEC-012 aligned)
# NOTE: /recommendations kept for transition compatibility in this file; backend V2 integration must not fallback to it.
# =========================

import hashlib
from pydantic import ConfigDict, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class V2Craving(StrictModel):
    text: str = ""
    tags: List[str] = Field(default_factory=list)


class V2Restrictions(StrictModel):
    allergies: List[str] = Field(default_factory=list)
    diet: Optional[str] = "none"
    excludedIngredients: List[str] = Field(default_factory=list)
    # budget fields preserved structurally (ML proposes only; BE authoritative per DEC-002)
    budgetMax: Optional[float] = None
    budgetCurrency: Optional[str] = None
    budgetPerPerson: Optional[bool] = None


class V2Options(StrictModel):
    limit: int = 5
    locale: str = "es-MX"
    requestId: Optional[str] = None


class InterpretRequest(StrictModel):
    requestId: Optional[str] = None
    craving: V2Craving = Field(default_factory=V2Craving)
    restrictions: V2Restrictions = Field(default_factory=V2Restrictions)
    options: V2Options = Field(default_factory=V2Options)

    @model_validator(mode="after")
    def _validate_limits(self):
        if self.options.limit < 1 or self.options.limit > 10:
            raise ValueError("options.limit must be between 1 and 10")
        if len(self.craving.text or "") > 500:
            raise ValueError("craving.text too long")
        return self


class InterpretBudget(StrictModel):
    amount: Optional[float] = None
    currency: Optional[str] = None
    ambiguous: bool = False
    perPerson: Optional[bool] = None
    confidence: float = 0.0
    notes: List[str] = Field(default_factory=list)


class InterpretExtracted(StrictModel):
    intent: str = "recommendation"
    preferences: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)
    diet: Optional[str] = "none"
    excludedIngredients: List[str] = Field(default_factory=list)
    budget: InterpretBudget = Field(default_factory=InterpretBudget)
    entities: List[str] = Field(default_factory=list)
    negations: List[str] = Field(default_factory=list)


class InterpretResponse(StrictModel):
    requestId: str
    extracted: InterpretExtracted
    confidence: float = 0.0
    ambiguous: bool = False
    meta: Dict[str, Any] = Field(default_factory=dict)


class RankCandidate(StrictModel):
    id: str
    # optional ranking-relevant fields provided by BE (authoritative source is BE/DB)
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    categoria_nombre: Optional[str] = None
    precio: Optional[float] = None
    ingredientes_principales: List[Any] = Field(default_factory=list)
    complementos: List[Any] = Field(default_factory=list)
    etiquetas_dieteticas: List[str] = Field(default_factory=list)
    nivel_picante: Optional[int] = None


class RankRequest(StrictModel):
    requestId: str
    scope: Optional[str] = None
    craving: V2Craving = Field(default_factory=V2Craving)
    restrictions: V2Restrictions = Field(default_factory=V2Restrictions)
    options: V2Options = Field(default_factory=V2Options)
    candidates: List[RankCandidate] = Field(default_factory=list)
    extracted: Optional[InterpretExtracted] = None

    @model_validator(mode="after")
    def _validate_rank(self):
        if not self.requestId or len(self.requestId) > 128:
            raise ValueError("requestId required")
        if self.options.limit < 1 or self.options.limit > 10:
            raise ValueError("options.limit must be between 1 and 10")
        # bound candidate count to protect service; BE should pre-filter/acot
        if len(self.candidates) > 200:
            self.candidates = self.candidates[:200]
        return self


class RankItem(StrictModel):
    dishId: str
    score: float
    confidence: float = 0.0
    reasons: List[str] = Field(default_factory=list)


class RankResponse(StrictModel):
    requestId: str
    ranked: List[RankItem] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)


def _safe_request_id(req_id: Optional[str]) -> str:
    if req_id and isinstance(req_id, str) and 0 < len(req_id.strip()) <= 128:
        return req_id.strip()
    seed = str(time.time())
    return "ml_" + hashlib.sha256(seed.encode("utf-8")).hexdigest()[:24]


_BUDGET_AMOUNT_RE = re.compile(r"(?:\$|mxn\s*)?([0-9]{1,6}(?:[\.,][0-9]{1,2})?)", re.IGNORECASE)
_WRITTEN_AMOUNTS = {'diez': 10, 'veinte': 20, 'treinta': 30, 'cuarenta': 40,
                    'cincuenta': 50, 'sesenta': 60, 'setenta': 70, 'ochenta': 80,
                    'noventa': 90, 'cien': 100, 'ciento': 100}


def _extract_budget_proposal(text: str) -> InterpretBudget:
    t = (text or "").strip()
    if not t:
        return InterpretBudget()
    lower = t.lower()
    per_person = True if any(k in lower for k in ["por persona", "por cabeza", "cada quien", "c/u", "por integrante"]) else None
    mentions_money = any(k in lower for k in ["$", "mxn", "peso", "pesitos", "varo", "presupuesto", "gastar", "cuesta", "barato", "econ"])
    nums = _BUDGET_AMOUNT_RE.findall(t)
    normalized = normalize_text(t)
    words = re.findall(r'\b(diez|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento)\s+(?:pesos?|pesitos|varos?|mxn)\b', normalized)
    nums.extend(str(_WRITTEN_AMOUNTS[word]) for word in words)
    # ambiguous cases: ranges, multiple amounts, "entre", contradictory cues
    ambiguous = False
    notes: List[str] = []
    if re.search(r'\b(?:ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+(?:y\s+)?(?:un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+(?:pesos?|pesitos|varos?|mxn)\b', normalized):
        ambiguous = True
        notes.append('compound_written_amount_not_supported')
    if mentions_money and re.search(r'\b(?:mas o menos|alrededor de|aproximadamente|como unos?|unos?)\s+(?:\d|diez\b|veinte\b|treinta\b|cuarenta\b|cincuenta\b|sesenta\b|setenta\b|ochenta\b|noventa\b|cien\b)', normalized):
        ambiguous = True
        notes.append('approximate_budget')
    if mentions_money and ("entre" in lower or "-" in lower):
        ambiguous = True
        notes.append("budget_range_or_between")
    if len(nums) > 1 and mentions_money:
        ambiguous = True
        notes.append("multiple_amounts")
    amount = None
    currency = "MXN" if mentions_money else None
    if mentions_money and nums and not ambiguous:
        try:
            raw = nums[0].replace(",", ".")
            val = float(raw)
            if math.isfinite(val) and val > 0 and val <= 100000 and round(val, 2) == val:
                amount = val
            else:
                ambiguous = True
                notes.append("amount_out_of_bounds_or_not_determinable")
                amount = None
        except Exception:
            ambiguous = True
            notes.append("amount_parse_error")
    elif mentions_money and not nums:
        ambiguous = True
        notes.append("amount_not_determinable")
    confidence = 0.0
    if amount is not None and not ambiguous:
        confidence = 0.75
    elif mentions_money:
        confidence = 0.35
    return InterpretBudget(amount=amount, currency=currency, ambiguous=ambiguous, perPerson=per_person, confidence=confidence, notes=notes)


def _normalize_diet_value(v: Optional[str]) -> str:
    if not v:
        return "none"
    t = str(v).strip().lower().replace("-", "_")
    if t in ["", "none", "sin_restricciones", "ninguna", "null"]:
        return "none"
    if t in ["vegetarian", "vegetariana"]:
        return "vegetarian"
    if t in ["vegan", "vegana"]:
        return "vegan"
    return t


def _collect_terms_from_text(text: str) -> List[str]:
    norm = normalize_text(text or "")
    return [w for w in norm.split() if w and w not in STOP_WORDS and len(w) > 1]


@app.post("/interpret", response_model=InterpretResponse)
def interpret(req: InterpretRequest):
    t0 = time.time()
    try:
        request_id = _safe_request_id(req.requestId or (req.options.requestId if req.options else None))
        text = (req.craving.text or "") if req.craving else ""
        tags = list(req.craving.tags or []) if req.craving else []
        negated = parse_negations(text)

        # allergies/exclusions: prefer structured; can reflect explicit mentions conservatively
        allergies = [normalize_text(a) for a in (req.restrictions.allergies or []) if isinstance(a, str) and a.strip()]
        for match in re.finditer(r'\balerg(?:ia|ico|ica)\s+(?:a|al)\s+(?:(?:la|el|los|las)\s+)?([a-z]+)', normalize_text(text)):
            if match.group(1) not in allergies:
                allergies.append(match.group(1))
        excluded = [normalize_text(e) for e in (req.restrictions.excludedIngredients or []) if isinstance(e, str) and e.strip()]
        # add negated terms as exclusion signals (proposal only)
        for n in negated:
            if n and n not in excluded:
                excluded.append(n)

        diet = _normalize_diet_value(req.restrictions.diet if req.restrictions else "none")
        linguistic = analyze_mexican_spanish(text)
        prefs = [normalize_text(x) for x in tags if isinstance(x, str) and x.strip()]
        prefs += [w for w in _collect_terms_from_text(text)[:12] if w not in prefs]
        for item in linguistic['mentions']:
            if item['category'] in ('food', 'dish', 'food_category', 'flavor', 'texture', 'preference') and item['role'] == 'mentioned':
                term = normalize_text(item['concept'])
                if term not in prefs:
                    prefs.append(term)
        budget = _extract_budget_proposal(text)

        ambiguous = False
        conf = 0.7
        if not text.strip() and not tags and not allergies and diet == "none" and not excluded and budget.amount is None and not budget.ambiguous:
            ambiguous = True
            conf = 0.4
        if budget.ambiguous:
            ambiguous = True
            conf = min(conf, 0.55)

        extracted = InterpretExtracted(
            intent="recommendation",
            preferences=prefs[:20],
            allergies=allergies[:20],
            diet=diet,
            excludedIngredients=excluded[:20],
            budget=budget,
            entities=prefs[:10],
            negations=negated[:20],
        )
        meta = {
            "executionTimeMs": round((time.time() - t0) * 1000, 2),
            "spacy_active": SPACY_AVAILABLE,
            "version": "v2-interpret-min",
            "linguistic": linguistic,
        }
        return InterpretResponse(requestId=request_id, extracted=extracted, confidence=round(conf, 3), ambiguous=ambiguous, meta=meta)
    except HTTPException:
        raise
    except Exception as e:
        # controlled error, no leak of internals beyond type
        raise HTTPException(status_code=422, detail="invalid_interpret_request")


def _candidate_to_dish_dict(c: RankCandidate) -> Dict[str, Any]:
    return {
        "id": c.id,
        "nombre": c.nombre or "",
        "descripcion": c.descripcion or "",
        "categoria_nombre": c.categoria_nombre or "",
        "precio": c.precio if c.precio is not None else 0.0,
        "ingredientes_principales": list(c.ingredientes_principales or []),
        "complementos": list(c.complementos or []),
        "etiquetas_dieteticas": list(c.etiquetas_dieteticas or []),
        "nivel_picante": c.nivel_picante or 0,
        "activo": True,
    }


def _requested_spice(text: str) -> bool:
    """A ranking preference only; exclusions remain the backend's responsibility."""
    normalized = normalize_text(text)
    positive = re.search(r'\b(?:picos[oa]s?|picoson(?:a)?|picantes?|pique|enchilos[oa]s?|enchilosit[oa]s?)\b', normalized)
    if not positive:
        return False
    before = normalized[max(0, positive.start() - 25):positive.start()]
    if re.search(r'\bno me molesta(?: que)?\s*$', before):
        return False
    return not re.search(r'\b(?:sin|no|nada de)\s+(?:muy\s+)?$', before)


def _rank_candidates_internal(req: RankRequest) -> List[RankItem]:
    candidates = req.candidates or []
    if not candidates:
        return []
    craving = req.craving or V2Craving()
    extracted = req.extracted
    user_text = (craving.text or "").strip()
    if (not user_text) and extracted and extracted.preferences:
        user_text = " ".join(extracted.preferences[:8])
    user_tags = list(craving.tags or [])
    if extracted and extracted.preferences:
        for p in extracted.preferences:
            if p and p not in user_tags and len(user_tags) < 12:
                user_tags.append(p)

    # scoring over provided candidates only (no eligibility decisions, no DB, no invented dishes)
    dishes = [_candidate_to_dish_dict(c) for c in candidates]
    dish_docs = []
    for d in dishes:
        name = normalize_text(d.get("nombre", ""))
        cat = normalize_text(d.get("categoria_nombre", ""))
        desc = normalize_text(d.get("descripcion", ""))
        ing_main = " ".join([normalize_text(str(i)) for i in (d.get("ingredientes_principales") or [])])
        tags = " ".join([normalize_text(str(t)) for t in (d.get("etiquetas_dieteticas") or [])])
        dish_docs.append(f"{name} {name} {cat} {ing_main} {desc} {tags}")

    user_text_norm = normalize_text(user_text)
    wants_spice = _requested_spice(user_text)
    wants_shrimp = bool(re.search(r'\b(?:quiero|busco)\s+(?:unos?\s+)?camarones?\b', user_text_norm))
    user_tags_norm = [normalize_text(t) for t in user_tags]
    user_words = [w for w in user_text_norm.split() if w not in STOP_WORDS and len(w) > 1]
    query_terms = list(dict.fromkeys(user_words + user_tags_norm))
    query_doc = f"{user_text_norm} {' '.join(user_tags_norm)}".strip() or "comida platillo"

    semantic_sims = [0.0] * len(dishes)
    try:
        if dish_docs:
            vectorizer = TfidfVectorizer(token_pattern=r"(?u)\b\w+\b", ngram_range=(1, 2))
            tfidf_matrix = vectorizer.fit_transform(dish_docs + [query_doc])
            dish_vectors = tfidf_matrix[:-1]
            query_vector = tfidf_matrix[-1:]
            sims = cosine_similarity(query_vector, dish_vectors)[0]
            semantic_sims = [float(x) for x in sims]
    except Exception:
        semantic_sims = [0.0] * len(dishes)

    scored: List[Tuple[float, RankItem, str]] = []
    for idx, d in enumerate(dishes):
        d_name = normalize_text(d.get("nombre", ""))
        d_cat = normalize_text(d.get("categoria_nombre", ""))
        d_desc = normalize_text(d.get("descripcion", ""))
        d_ing_main = [normalize_text(str(i)) for i in (d.get("ingredientes_principales") or [])]
        d_tags = [normalize_text(str(t)) for t in (d.get("etiquetas_dieteticas") or [])]
        raw_score = 0.0
        if user_text_norm and user_text_norm in d_name and len(user_text_norm) >= 3:
            raw_score += WEIGHTS["EXACT_PHRASE"]
        for term in query_terms:
            if not term:
                continue
            d_name_words = set(d_name.split())
            d_cat_words = set(d_cat.split())
            if term in d_name_words:
                raw_score += WEIGHTS["NAME"]
            elif any(term in word for word in d_name_words):
                raw_score += WEIGHTS["NAME"] * 0.7
            else:
                best_fuzzy = max([fuzzy_similarity(term, word) for word in d_name_words] + [0.0])
                if best_fuzzy >= 0.60:
                    raw_score += WEIGHTS["NAME"] * best_fuzzy
            if term in d_cat_words:
                raw_score += WEIGHTS["CATEGORY"]
            elif any(term in word for word in d_cat_words):
                raw_score += WEIGHTS["CATEGORY"] * 0.5
            for ing in d_ing_main:
                if term in ing or any(fuzzy_similarity(term, word) >= 0.75 for word in ing.split()):
                    raw_score += WEIGHTS["MAIN_INGREDIENT"]
            if term in d_desc:
                raw_score += WEIGHTS["DESCRIPTION"]
            for tag in d_tags:
                if term in tag:
                    raw_score += WEIGHTS["TAGS"]
        tfidf_sim = semantic_sims[idx] if idx < len(semantic_sims) else 0.0
        raw_score += (tfidf_sim * WEIGHTS["SEMANTIC"] * 3.0)
        has_shrimp = bool(re.search(r'\bcamaron(?:es)?\b', dish_docs[idx]))
        if wants_shrimp and has_shrimp:
            raw_score += 4.0

        # Catalog-declared spice affects order, not eligibility or safety.
        # Unknown and zero receive no bonus; no value is inferred from the name.
        spice_level = candidates[idx].nivel_picante
        if wants_spice and isinstance(spice_level, int) and 0 < spice_level <= 4:
            raw_score += spice_level * 3.0

        # deterministic, bounded score; confidence marked as estimate
        score = min(0.99, max(0.0, round(0.55 + (math.tanh(raw_score / 4.0) * 0.44), 4)))
        if wants_shrimp and not has_shrimp:
            score = round(score / 2.0, 4)
        if wants_spice and isinstance(spice_level, int) and 0 <= spice_level <= 4:
            # Give equal weight to text relevance and the declared spice scale.
            # This is an ordering signal, not a safety or confidence threshold.
            score = min(0.99, round((score + spice_level / 4.0) / 2.0, 4))
        confidence = min(0.95, max(0.3, round(0.45 + (tfidf_sim * 0.4) + (0.05 if raw_score > 0.5 else 0.0), 3)))
        reasons: List[str] = []
        if wants_shrimp and not has_shrimp:
            reasons.append("No consta camarón en los datos del menú; coincidencia parcial.")
        if wants_spice and spice_level == 0:
            reasons.append("El menú declara nivel de picante 0; coincidencia parcial.")
        if wants_spice and isinstance(spice_level, int) and 0 < spice_level <= 4:
            reasons.append("Nivel de picante declarado en el menú.")
        if raw_score > 0.5 and (user_text_norm or user_tags_norm):
            reasons.append("Coincide con preferencias o descripciÃ³n proporcionada.")
        if tfidf_sim >= 0.1:
            reasons.append("Similitud semÃ¡ntica con la solicitud.")
        if not reasons:
            reasons.append("Candidato elegible considerado segÃºn datos disponibles.")
        item = RankItem(dishId=str(d.get("id")), score=score, confidence=confidence, reasons=reasons[:3])
        scored.append((raw_score, item, d_name))

    scored.sort(key=lambda x: (-x[0], x[2], x[1].dishId))
    limit = req.options.limit if req.options and req.options.limit else 5
    return [it for _, it, _ in scored[:limit]]


@app.post("/rank", response_model=RankResponse)
def rank(req: RankRequest):
    t0 = time.time()
    try:
        # validate/normalize candidates: only provided ids can be returned
        seen = set()
        valid_candidates: List[RankCandidate] = []
        for c in (req.candidates or []):
            if not c or not c.id:
                continue
            cid = str(c.id)
            if cid in seen:
                continue
            seen.add(cid)
            valid_candidates.append(c)
        try:
            req_norm = req.model_copy(update={"candidates": valid_candidates})  # pydantic v2
        except Exception:
            req_norm = RankRequest(**{**req.model_dump(), "candidates": valid_candidates})
        ranked = _rank_candidates_internal(req_norm)
        # hard guarantee: ranked ids subset of candidates
        allowed = {str(c.id) for c in valid_candidates}
        ranked = [r for r in ranked if r.dishId in allowed]
        meta = {
            "executionTimeMs": round((time.time() - t0) * 1000, 2),
            "candidateCount": len(valid_candidates),
            "returned": len(ranked),
            "version": "v2-rank-min",
        }
        return RankResponse(requestId=req.requestId, ranked=ranked, meta=meta)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=422, detail="invalid_rank_request")



