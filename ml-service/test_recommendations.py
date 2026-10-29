from main import (
    app,
    is_allergen_present,
    is_diet_incompatible,
    get_recommendations,
    RecommendationRequest,
    CravingInput
)

MOCK_DISHES = [
    {
        "id": "p1",
        "nombre": "Tacos al Pastor",
        "descripcion": "Tacos de cerdo marinados con piña y cebolla",
        "precio": 95.0,
        "url_imagen": "/tacos.jpg",
        "activo": True,
        "nivel_picante": 2,
        "porcion": "3 piezas",
        "categoria_nombre": "Tacos",
        "etiquetas_dieteticas": ["sin_gluten"],
        "ingredientes_principales": ["cerdo", "piña", "cebolla"]
    },
    {
        "id": "p2",
        "nombre": "Taco de Camarón Tempura",
        "descripcion": "Camarones crujientes con aderezo de chipotle",
        "precio": 110.0,
        "url_imagen": "/camaron.jpg",
        "activo": True,
        "nivel_picante": 1,
        "porcion": "2 piezas",
        "categoria_nombre": "Tacos Especiales",
        "etiquetas_dieteticas": [],
        "ingredientes_principales": ["camarón", "harina de trigo", "chipotle"]
    },
    {
        "id": "p3",
        "nombre": "Guacamole Tradicional",
        "descripcion": "Aguacate hass fresco con pico de gallo y totopos",
        "precio": 85.0,
        "url_imagen": "/guacamole.jpg",
        "activo": True,
        "nivel_picante": 0,
        "porcion": "300g",
        "categoria_nombre": "Entradas",
        "etiquetas_dieteticas": ["vegano", "vegetariano", "sin_gluten"],
        "ingredientes_principales": ["aguacate", "jitomate", "cebolla", "cilantro"]
    },
    {
        "id": "p4",
        "nombre": "Sopa Wonton Tradicional",
        "descripcion": "Caldo caldosito con wontons rellenos de cerdo",
        "precio": 120.0,
        "url_imagen": "/sopa.jpg",
        "activo": True,
        "nivel_picante": 0,
        "porcion": "500ml",
        "categoria_nombre": "Sopas",
        "etiquetas_dieteticas": [],
        "ingredientes_principales": ["cerdo", "harina de trigo", "cebollín"]
    }
]

def test_case_1_no_restrictions():
    req = RecommendationRequest(
        restaurant_id="rest-1",
        craving=CravingInput(text="quiero tacos", tags=["mexicana"]),
        diet="none",
        allergies=[],
        dishes=MOCK_DISHES
    )
    res = get_recommendations(req)
    assert len(res.recommendations) > 0
    assert res.meta["recommendedCount"] > 0
    assert any("Tacos" in item.dish.nombre for item in res.recommendations)

def test_case_2_vegetarian():
    req = RecommendationRequest(
        restaurant_id="rest-1",
        craving=CravingInput(text="algo fresco", tags=[]),
        diet="vegetariana",
        allergies=[],
        dishes=MOCK_DISHES
    )
    res = get_recommendations(req)
    # Tacos al pastor (cerdo), camarón (camarón), y wonton (cerdo) should be excluded
    for item in res.recommendations:
        assert "cerdo" not in item.dish.ingredientes_principales
        assert "camarón" not in item.dish.ingredientes_principales
    assert len(res.recommendations) == 1
    assert res.recommendations[0].dish.nombre == "Guacamole Tradicional"

def test_case_3_vegan():
    req = RecommendationRequest(
        restaurant_id="rest-1",
        diet="vegana",
        allergies=[],
        dishes=MOCK_DISHES
    )
    res = get_recommendations(req)
    for item in res.recommendations:
        assert "vegano" in item.dish.etiquetas_dieteticas

def test_case_4_shrimp_allergy():
    req = RecommendationRequest(
        restaurant_id="rest-1",
        allergies=["camaron"],
        dishes=MOCK_DISHES
    )
    res = get_recommendations(req)
    dish_names = [item.dish.nombre for item in res.recommendations]
    assert "Taco de Camarón Tempura" not in dish_names

def test_case_5_multiple_allergies():
    req = RecommendationRequest(
        restaurant_id="rest-1",
        allergies=["camaron", "gluten"],
        dishes=MOCK_DISHES
    )
    res = get_recommendations(req)
    dish_names = [item.dish.nombre for item in res.recommendations]
    assert "Taco de Camarón Tempura" not in dish_names
    assert "Sopa Wonton Tradicional" not in dish_names

def test_case_6_free_text_craving():
    req = RecommendationRequest(
        restaurant_id="rest-1",
        craving=CravingInput(text="Quiero algo caldosito de sopa", tags=["caldosito"]),
        dishes=MOCK_DISHES
    )
    res = get_recommendations(req)
    assert res.recommendations[0].dish.nombre == "Sopa Wonton Tradicional"
    assert res.recommendations[0].matchScore >= 0.70

def test_case_7_empty_restaurant():
    req = RecommendationRequest(
        restaurant_id="rest-empty",
        dishes=[]
    )
    res = get_recommendations(req)
    assert len(res.recommendations) == 0
    assert res.meta["totalCandidates"] == 0

def test_case_8_few_dishes():
    req = RecommendationRequest(
        restaurant_id="rest-1",
        limit=10,
        dishes=[MOCK_DISHES[0]]
    )
    res = get_recommendations(req)
    assert len(res.recommendations) == 1

def test_case_9_incomplete_dish_data():
    incomplete = [{"id": "px", "nombre": "Incompleto", "precio": 50.0, "activo": True}]
    req = RecommendationRequest(
        restaurant_id="rest-1",
        dishes=incomplete
    )
    res = get_recommendations(req)
    assert len(res.recommendations) == 1

def test_case_10_multi_tenant_isolation():
    req = RecommendationRequest(
        restaurant_id="rest-A",
        dishes=MOCK_DISHES
    )
    res = get_recommendations(req)
    for item in res.recommendations:
        assert item.restaurant.id == "rest-A"

if __name__ == "__main__":
    print("Ejecutando suite de pruebas de recomendación ML...")
    test_case_1_no_restrictions()
    test_case_2_vegetarian()
    test_case_3_vegan()
    test_case_4_shrimp_allergy()
    test_case_5_multiple_allergies()
    test_case_6_free_text_craving()
    test_case_7_empty_restaurant()
    test_case_8_few_dishes()
    test_case_9_incomplete_dish_data()
    test_case_10_multi_tenant_isolation()
    print("[OK] ¡Todas las 10 pruebas unitarias/integracion de ML pasaron exitosamente!")
