import os
import re
import math
import unicodedata
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

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

# --- CONFIGURACIÓN DE PESOS CENTRALIZADA ---
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

# --- DICCIONARIO DE CONCEPTOS Y PROTEÍNAS ---
PROTEIN_MAP = {
    "cerdo": ["cerdo", "puerco", "porcino", "carnitas", "pastor", "tocino", "chicharrón", "chicharron", "jamón", "jamon", "manteca"],
    "res": ["res", "bistec", "filete", "sirloin", "rib eye", "ribeye", "tasajo", "arrachera", "cecina", "barbacoa", "suadero", "vacuno"],
    "pollo": ["pollo", "pechuga", "muslo", "ala", "gallina", "poultry"],
    "pescado": ["pescado", "atún", "atun", "salmón", "salmon", "trucha", "bacalao", "robalo", "huachinango", "filete de pescado"],
    "mariscos": ["marisco", "mariscos", "camarón", "camaron", "camarones", "pulpo", "langosta", "ostión", "ostion", "jaiba", "seafood"]
}

DISH_TYPE_MAP = {
    "taco": ["taco", "tacos", "flauta", "volcán", "volcan", "gringa"],
    "quesadilla": ["quesadilla", "quesadillas", "empanada"],
    "sopa": ["sopa", "caldo", "caldosito", "consomé", "consome", "crema", "ramen", "pho", "pozole", "menudo"],
    "hamburguesa": ["hamburguesa", "hamburguesas", "burger"],
    "pasta": ["pasta", "fideos", "espagueti", "tallarines", "lasaña", "lasagna", "risotto", "ramen"],
    "postre": ["postre", "flan", "pastel", "helado", "churro", "tarta", "cake", "brownie"]
}

ALLERGEN_MAP = {
    "cacahuate": ["cacahuate", "cacahuates", "maní", "mani", "peanut"],
    "camaron": ["camarón", "camaron", "camarones", "shrimp", "gambas", "marisco", "mariscos"],
    "lacteos": ["leche", "queso", "crema", "mantequilla", "lácteo", "lacteo", "dairy", "oaxaca", "gouda", "quesillo"],
    "gluten": ["trigo", "gluten", "harina", "pan", "pasta", "wonton", "empanadillas", "fideos", "bizcocho", "crepas"],
    "huevo": ["huevo", "huevos", "egg"],
    "pescado": ["pescado", "atún", "atun", "salmón", "salmon", "trucha", "bacalao", "fish"],
    "nueces": ["nuez", "nueces", "pistache", "pistaches", "almendra", "almendras", "nut"],
    "mariscos": ["marisco", "mariscos", "camarón", "camaron", "camarones", "pulpo", "langosta", "ostión", "ostion", "jaiba", "seafood"]
}

NEGATION_PATTERNS = [
    r'no\s+quiero\s+([a-záéíóúñ\s]+)',
    r'sin\s+([a-záéíóúñ\s]+)',
    r'evitar\s+([a-záéíóúñ\s]+)',
    r'no\s+me\s+gusta\s+([a-záéíóúñ\s]+)',
    r'que\s+no\s+tenga\s+([a-záéíóúñ\s]+)',
    r'nada\s+de\s+([a-záéíóúñ\s]+)'
]

STOP_WORDS = {"quiero", "unos", "unas", "algo", "de", "con", "para", "que", "un", "una", "los", "las", "el", "la", "me", "se", "por", "favor"}

# --- MODELS ---
class CravingInput(BaseModel):
    text: Optional[str] = ""
    tags: Optional[List[str]] = Field(default_factory=list)

class RecommendationRequest(BaseModel):
    restaurant_id: str
    craving: Optional[CravingInput] = Field(default_factory=CravingInput)
    diet: Optional[str] = "none"
    allergies: Optional[List[str]] = Field(default_factory=list)
    socialContext: Optional[str] = "solo"
    limit: Optional[int] = 5
    dishes: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    restaurant: Optional[Dict[str, Any]] = None

class DishOutput(BaseModel):
    id: str
    nombre: str
    descripcion: str
    precio: float
    url_imagen: str
    nivel_picante: int = 0
    porcion: str = ""
    categoria_nombre: str = ""
    etiquetas_dieteticas: List[str] = Field(default_factory=list)
    ingredientes_principales: List[str] = Field(default_factory=list)

class RestaurantOutput(BaseModel):
    id: str
    name: str
    slug: str
    menuUrl: str

class RecommendationItem(BaseModel):
    dish: DishOutput
    restaurant: RestaurantOutput
    matchScore: float
    matchPercentage: int
    reasons: List[str]
    tags: List[str]

class RecommendationResponse(BaseModel):
    recommendations: List[RecommendationItem]
    meta: Dict[str, Any]

# --- HELPER FUNCTIONS ---

def normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower().strip()
    nfkd_form = unicodedata.normalize('NFKD', text)
    text = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return ' '.join(text.split())

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
    for pattern in NEGATION_PATTERNS:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            words = match.split()
            if words:
                negated_terms.append(normalize_text(words[0]))
                if len(words) > 1 and words[0] in ["carne", "de"]:
                    negated_terms.append(normalize_text(f"{words[0]} {words[1]}"))
    return list(set(negated_terms))

def is_allergen_present(dish: Dict[str, Any], allergy_keys: List[str]) -> bool:
    if not allergy_keys:
        return False

    ingredients = dish.get("ingredientes_principales") or []
    complements = dish.get("complementos") or []
    name = dish.get("nombre", "")
    desc = dish.get("descripcion", "")

    all_text = " ".join([
        name,
        desc,
        " ".join([str(i) for i in ingredients]),
        " ".join([str(c) for c in complements])
    ])
    norm_text = normalize_text(all_text)

    for allergy in allergy_keys:
        allergy_norm = normalize_text(str(allergy))
        keywords = ALLERGEN_MAP.get(allergy_norm, [allergy_norm])
        for kw in keywords:
            kw_norm = normalize_text(kw)
            if kw_norm and re.search(r'\b' + re.escape(kw_norm) + r'\b', norm_text):
                return True
    return False

def is_negated_term_present(dish: Dict[str, Any], negated_terms: List[str]) -> bool:
    if not negated_terms:
        return False

    ingredients = dish.get("ingredientes_principales") or []
    complements = dish.get("complementos") or []
    name = dish.get("nombre", "")
    desc = dish.get("descripcion", "")

    all_text = f"{name} {desc} {' '.join([str(i) for i in ingredients])} {' '.join([str(c) for c in complements])}"
    norm_text = normalize_text(all_text)

    for term in negated_terms:
        if term in ["carne", "carnes"]:
            for protein, kws in PROTEIN_MAP.items():
                for kw in kws:
                    if re.search(r'\b' + re.escape(normalize_text(kw)) + r'\b', norm_text):
                        return True
        else:
            synonyms = [term]
            for category, kws in PROTEIN_MAP.items():
                if term in kws or category == term:
                    synonyms.extend(kws)
            for syn in synonyms:
                syn_norm = normalize_text(syn)
                if syn_norm and re.search(r'\b' + re.escape(syn_norm) + r'\b', norm_text):
                    return True
    return False

def is_diet_incompatible(dish: Dict[str, Any], diet: str) -> bool:
    if not diet or diet == "none" or diet == "sin_restricciones":
        return False

    diet = diet.lower().replace("-", "_")
    tags = [normalize_text(str(t)) for t in (dish.get("etiquetas_dieteticas") or [])]
    name_desc = normalize_text(f"{dish.get('nombre', '')} {dish.get('descripcion', '')}")
    ingredients = normalize_text(" ".join([str(i) for i in (dish.get("ingredientes_principales") or [])]))
    full_text = f"{name_desc} {ingredients}"

    if diet in ["vegetariana", "vegetarian"]:
        if "vegetariano" in tags or "vegano" in tags:
            return False
        for kws in PROTEIN_MAP.values():
            for kw in kws:
                if normalize_text(kw) in full_text:
                    return True

    elif diet in ["vegana", "vegan"]:
        if "vegano" in tags:
            return False
        animal_kws = ["huevo", "queso", "leche", "crema", "mantequilla", "miel", "oaxaca", "gouda"]
        for kws in PROTEIN_MAP.values():
            animal_kws.extend(kws)
        for kw in animal_kws:
            if normalize_text(kw) in full_text:
                return True

    elif diet in ["sin_gluten", "gluten_free"]:
        if "sin_gluten" in tags or "singluten" in tags:
            return False
        gluten_kws = ["trigo", "harina", "pan", "pasta", "wonton", "empanadillas", "fideos", "bizcocho", "crepas"]
        for kw in gluten_kws:
            if normalize_text(kw) in full_text:
                return True

    return False

def generate_reasons(dish: Dict[str, Any], craving: CravingInput, diet: str, allergies: List[str]) -> List[str]:
    reasons = []
    dish_name_norm = normalize_text(dish.get("nombre", ""))
    dish_desc_norm = normalize_text(dish.get("descripcion", ""))
    dish_cat_norm = normalize_text(dish.get("categoria_nombre", ""))
    ingredients_norm = [normalize_text(str(i)) for i in (dish.get("ingredientes_principales") or [])]

    user_text = normalize_text(craving.text or "")
    user_tags = [normalize_text(t) for t in (craving.tags or [])]

    if "taco" in user_text or "tacos" in user_tags or "taco" in user_tags:
        if "taco" in dish_name_norm or "taco" in dish_cat_norm:
            reasons.append("🌮 Coincide con tu antojo de Tacos")

    if "pastor" in user_text or "pastor" in user_tags:
        if "pastor" in dish_name_norm or "pastor" in dish_desc_norm or any("pastor" in i for i in ingredients_norm):
            reasons.append("🔥 Preparación tradicional Al Pastor")

    if any(p in user_text for p in ["puerco", "cerdo"]):
        if any(p in dish_desc_norm or any(p in i for i in ingredients_norm) for p in ["cerdo", "puerco", "pastor", "carnitas"]):
            reasons.append("🐷 Contiene carne de cerdo seleccionada")

    if any(p in user_text for p in ["res", "bistec", "rib eye", "sirloin"]):
        if any(p in dish_desc_norm or any(p in i for i in ingredients_norm) for p in ["res", "bistec", "rib eye", "sirloin"]):
            reasons.append("🥩 Corte jugoso de carne de res")

    if "caldosito" in user_text or "sopa" in user_text or "caldosito" in user_tags:
        if any(s in dish_name_norm or s in dish_cat_norm for s in ["sopa", "caldo", "pozole", "menudo", "consome"]):
            reasons.append("🥣 Platillo reconfortante y caldosito")

    if diet and diet != "none":
        if diet in ["vegetariana", "vegetarian"]:
            reasons.append("🥬 100% compatible con tu dieta vegetariana")
        elif diet in ["vegana", "vegan"]:
            reasons.append("🌱 100% compatible con tu dieta vegana")
        elif diet in ["sin_gluten", "gluten_free"]:
            reasons.append("🌾 Platillo libre de gluten")

    if allergies:
        reasons.append(f"✅ 100% libre de las {len(allergies)} alergia(s) indicadas")

    if not reasons:
        reasons.append("⭐ Excelente recomendación basada en tus gustos")

    return list(dict.fromkeys(reasons))[:3]

# --- MAIN RECOMMENDATION ENDPOINT ---

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "MexxicanMX Advanced Semantic ML Recommendation Engine", "version": "2.0.0"}

@app.post("/recommendations", response_model=RecommendationResponse)
def get_recommendations(req: RecommendationRequest):
    import time
    start_time = time.time()

    dishes = req.dishes or []
    if not dishes:
        return RecommendationResponse(
            recommendations=[],
            meta={
                "restaurant_id": req.restaurant_id,
                "totalCandidates": 0,
                "recommendedCount": 0,
                "executionTimeMs": round((time.time() - start_time) * 1000, 2)
            }
        )

    # 1. Filter active dishes
    active_dishes = [d for d in dishes if d.get("activo", True) is not False]
    total_candidates = len(active_dishes)

    # 2. Extract negated terms (e.g., "no quiero carne", "sin puerco")
    user_raw_text = req.craving.text if req.craving else ""
    negated_terms = parse_negations(user_raw_text)

    # 3. STRICT EXCLUSIONS: Allergies, Negated Terms & Diets
    safe_dishes = []
    filtered_allergies_count = 0
    filtered_negations_count = 0
    filtered_diet_count = 0

    for d in active_dishes:
        if is_allergen_present(d, req.allergies or []):
            filtered_allergies_count += 1
            continue

        if is_negated_term_present(d, negated_terms):
            filtered_negations_count += 1
            continue

        if is_diet_incompatible(d, req.diet or "none"):
            filtered_diet_count += 1
            continue

        safe_dishes.append(d)

    if not safe_dishes:
        return RecommendationResponse(
            recommendations=[],
            meta={
                "restaurant_id": req.restaurant_id,
                "totalCandidates": total_candidates,
                "filteredByAllergies": filtered_allergies_count,
                "filteredByNegations": filtered_negations_count,
                "filteredByDiet": filtered_diet_count,
                "recommendedCount": 0,
                "executionTimeMs": round((time.time() - start_time) * 1000, 2)
            }
        )

    # 4. MULTI-FIELD SEMANTIC MATCHING & WEIGHTED SCORING
    user_text_norm = normalize_text(user_raw_text)
    user_tags_norm = [normalize_text(t) for t in (req.craving.tags if req.craving else [])]
    user_words = [w for w in user_text_norm.split() if w not in STOP_WORDS and len(w) > 1]
    
    # Direct search terms
    query_terms = list(set(user_words + user_tags_norm))

    # TF-IDF Vectorization
    dish_docs = []
    for d in safe_dishes:
        name = normalize_text(d.get("nombre", ""))
        cat = normalize_text(d.get("categoria_nombre", ""))
        desc = normalize_text(d.get("descripcion", ""))
        ing_main = " ".join([normalize_text(str(i)) for i in (d.get("ingredientes_principales") or [])])
        tags = " ".join([normalize_text(str(t)) for t in (d.get("etiquetas_dieteticas") or [])])
        dish_docs.append(f"{name} {name} {cat} {ing_main} {desc} {tags}")

    query_doc = f"{user_text_norm} {' '.join(user_tags_norm)}"
    if not query_doc.strip():
        query_doc = "comida deliciosa platillo especial"

    try:
        vectorizer = TfidfVectorizer(token_pattern=r'(?u)\b\w+\b', ngram_range=(1, 2))
        tfidf_matrix = vectorizer.fit_transform(dish_docs + [query_doc])
        dish_vectors = tfidf_matrix[:-1]
        query_vector = tfidf_matrix[-1:]
        semantic_sims = cosine_similarity(query_vector, dish_vectors)[0]
    except Exception:
        semantic_sims = [0.5] * len(safe_dishes)

    scored_items = []
    for idx, d in enumerate(safe_dishes):
        d_name = normalize_text(d.get("nombre", ""))
        d_cat = normalize_text(d.get("categoria_nombre", ""))
        d_desc = normalize_text(d.get("descripcion", ""))
        d_ing_main = [normalize_text(str(i)) for i in (d.get("ingredientes_principales") or [])]
        d_tags = [normalize_text(str(t)) for t in (d.get("etiquetas_dieteticas") or [])]

        raw_score = 0.0

        # Exact phrase match in name (e.g. "tacos al pastor")
        if user_text_norm and user_text_norm in d_name:
            raw_score += WEIGHTS["EXACT_PHRASE"]

        for term in query_terms:
            if not term:
                continue

            # Exact token match in name
            d_name_words = set(d_name.split())
            d_cat_words = set(d_cat.split())

            if term in d_name_words:
                raw_score += WEIGHTS["NAME"]
            elif any(term in word for word in d_name_words):
                raw_score += WEIGHTS["NAME"] * 0.7
            else:
                # Fuzzy match in name
                best_fuzzy = max([fuzzy_similarity(term, word) for word in d_name_words] + [0.0])
                if best_fuzzy >= 0.60:
                    raw_score += WEIGHTS["NAME"] * best_fuzzy

            # Category match
            if term in d_cat_words:
                raw_score += WEIGHTS["CATEGORY"]
            elif any(term in word for word in d_cat_words):
                raw_score += WEIGHTS["CATEGORY"] * 0.5

            # Main Ingredients match
            for ing in d_ing_main:
                if term in ing or any(fuzzy_similarity(term, word) >= 0.75 for word in ing.split()):
                    raw_score += WEIGHTS["MAIN_INGREDIENT"]

            # Description match
            if term in d_desc:
                raw_score += WEIGHTS["DESCRIPTION"]

            # Tags match
            for tag in d_tags:
                if term in tag:
                    raw_score += WEIGHTS["TAGS"]

            # Fuzzy match with Synonym Maps (e.g., "pastro" fuzzy matches "pastor" in PROTEIN_MAP)
            protein_matched = False
            for protein, synonyms in PROTEIN_MAP.items():
                if protein_matched:
                    break
                if any(fuzzy_similarity(term, syn) >= 0.70 for syn in synonyms) or term == protein:
                    for syn in synonyms:
                        syn_norm = normalize_text(syn)
                        if syn_norm in d_name:
                            raw_score += WEIGHTS["NAME"] * 1.5
                            protein_matched = True
                            break
                        elif any(syn_norm in i for i in d_ing_main):
                            raw_score += WEIGHTS["MAIN_INGREDIENT"] * 1.2
                            protein_matched = True
                            break

            dish_type_matched = False
            for dish_type, synonyms in DISH_TYPE_MAP.items():
                if dish_type_matched:
                    break
                if any(fuzzy_similarity(term, syn) >= 0.70 for syn in synonyms) or term == dish_type:
                    for syn in synonyms:
                        syn_norm = normalize_text(syn)
                        if syn_norm in d_name:
                            raw_score += WEIGHTS["NAME"] * 1.5
                            dish_type_matched = True
                            break
                        elif syn_norm in d_cat:
                            raw_score += WEIGHTS["CATEGORY"] * 1.2
                            dish_type_matched = True
                            break
                            raw_score += WEIGHTS["CATEGORY"] * 0.8

        # Add semantic similarity
        tfidf_sim = float(semantic_sims[idx]) if idx < len(semantic_sims) else 0.0
        raw_score += (tfidf_sim * WEIGHTS["SEMANTIC"] * 3.0)

        # Require a minimum raw_score to consider the dish relevant to the query
        if raw_score <= 0.10:
            continue

        # Continuous linear/sigmoid score calculation for smooth ranking
        final_score = min(0.99, max(0.70, round(0.70 + (math.tanh(raw_score / 4.0) * 0.29), 4)))
        match_percentage = int(round(final_score * 100))

        display_tags = list(d.get("etiquetas_dieteticas") or [])
        if not display_tags and d.get("ingredientes_principales"):
            display_tags = [str(i) for i in d.get("ingredientes_principales")[:3]]

        dish_rest_id = d.get("restaurante_id") or req.restaurant_id
        dish_rest_name = d.get("restaurante_nombre") or (req.restaurant.get("name") if req.restaurant else "Restaurante")
        dish_rest_slug = d.get("restaurante_slug") or dish_rest_id
        dish_menu_url = d.get("menuUrl") or (req.restaurant.get("menuUrl") if req.restaurant else f"/menu/{dish_rest_slug}")

        reasons = generate_reasons(d, req.craving or CravingInput(), req.diet or "none", req.allergies or [])

        dish_out = DishOutput(
            id=str(d.get("id", "")),
            nombre=str(d.get("nombre", "Platillo")),
            descripcion=str(d.get("descripcion", "")),
            precio=float(d.get("precio", 0.0)),
            url_imagen=str(d.get("url_imagen", "")),
            nivel_picante=int(d.get("nivel_picante", 0)),
            porcion=str(d.get("porcion", "")),
            categoria_nombre=str(d.get("categoria_nombre", "")),
            etiquetas_dieteticas=list(d.get("etiquetas_dieteticas") or []),
            ingredientes_principales=[str(i) for i in (d.get("ingredientes_principales") or [])]
        )

        rest_out = RestaurantOutput(
            id=str(dish_rest_id),
            name=str(dish_rest_name),
            slug=str(dish_rest_slug),
            menuUrl=str(dish_menu_url)
        )

        scored_items.append(RecommendationItem(
            dish=dish_out,
            restaurant=rest_out,
            matchScore=final_score,
            matchPercentage=match_percentage,
            reasons=reasons,
            tags=display_tags
        ))

    # Sort descending by matchScore
    scored_items.sort(key=lambda x: x.matchScore, reverse=True)
    limit = req.limit or 5
    top_recommendations = scored_items[:limit]

    return RecommendationResponse(
        recommendations=top_recommendations,
        meta={
            "restaurant_id": req.restaurant_id,
            "totalCandidates": total_candidates,
            "filteredByAllergies": filtered_allergies_count,
            "filteredByNegations": filtered_negations_count,
            "filteredByDiet": filtered_diet_count,
            "recommendedCount": len(top_recommendations),
            "executionTimeMs": round((time.time() - start_time) * 1000, 2)
        }
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
