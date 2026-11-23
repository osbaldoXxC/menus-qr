'use strict';
const vocabulary = require('./linguisticVocabulary');

// Narrow, reviewed lexical families. This is relevance, not food safety or
// recipe completeness. Unknown/complex requests are not guessed.
const FAMILIES = Object.freeze({
  // DLE lists quisquilla/chacalín as synonyms of camarón:
  // https://dle.rae.es/camar%C3%B3n — this is not an allergen taxonomy.
  camaron: ['camaron', 'camarones', 'quisquilla', 'quisquillas', 'chacalin', 'chacalines'], pollo: ['pollo', 'pollos'],
  pescado: ['pescado', 'pescados'], cerdo: ['cerdo', 'cerdos', 'puerco', 'puercos'],
  res: ['res'], champinon: ['champinon', 'champinones'],
  pizza: ['pizza', 'pizzas'], taco: ['taco', 'tacos'],
  huevo: ['huevo', 'huevos'], arroz: ['arroz'], papa: ['papa', 'papas'], ensalada: ['ensalada', 'ensaladas'],
  barbacoa: ['barbacoa'], queso: ['queso', 'quesos']
});
const { normalize } = vocabulary;
const registryFamilies = vocabulary.foodFamilies();
const effective = registryFamilies || Object.entries(FAMILIES).map(([id, terms]) => ({ id, request:terms, catalog:terms }));
const familiesById = new Map(effective.map(f => [f.id,f]));
const tokenFamily = new Map(effective.flatMap(f => f.request.filter(term => !term.includes(' ')).map(term => [term,f.id])));
const requestForms = effective.flatMap(f => f.request.map(term => ({ term, id:f.id })))
  .sort((a,b) => b.term.length - a.term.length);
function findHead(text) {
  return requestForms.find(item => text === item.term || text.startsWith(`${item.term} `));
}

function primaryFoodFamilies(text) {
  const normalized = normalize(text);
  const lead = /^(?:(?:quiero|busco|se me antoja|se me antojan|tengo ganas de comer)\s+(?:comer\s+)?(?:(?:un|una|unos|unas)\s+)?|(?:un|una|unos|unas)\s+)/.exec(normalized);
  if (!lead) return [];
  let tail = normalized.slice(lead[0].length).replace(/^(?:algo|platillo|plato|comida)\s+(?:con|de)\s+/, '');
  const first = findHead(tail);
  if (!first) return [];
  tail = tail.slice(first.term.length).trim();
  const alternative = /^(?:o|u)\s+(?:(?:un|una|unos|unas)\s+)?/.exec(tail);
  if (!alternative) return [first.id];
  const second = findHead(tail.slice(alternative[0].length));
  return second ? [...new Set([first.id,second.id])] : [];
}

function namesFromIngredients(items) {
  if (!Array.isArray(items)) return [];
  return items.map(value => typeof value === 'string' ? value : value && (value.nombre || value.name))
    .filter(value => typeof value === 'string');
}

function dishMatchesFamily(dish, family) {
  const name = ` ${normalize(dish.nombre)} `;
  const terms = familiesById.get(family)?.catalog || [];
  if (terms.some(term => name.includes(` sin ${term} `) || name.includes(` no ${term} `) ||
    name.includes(` sabor ${term} `) || name.includes(` sabor a ${term} `) || name.includes(` imitacion de ${term} `))) return false;
  const texts = [dish.nombre, ...namesFromIngredients(dish.ingredientes_principales)].map(normalize);
  return texts.some(text => {
    const padded = ` ${text} `;
    return terms.some(term => padded.includes(` ${term} `) &&
      !padded.includes(` sin ${term} `) && !padded.includes(` no ${term} `));
  });
}

function selectRelevantFood(dishes, text) {
  if (process.env.DISABLE_PRIMARY_FOOD_RELEVANCE === 'true') {
    return { constrained: false, families: [], dishes: dishes || [] };
  }
  const families = primaryFoodFamilies(text);
  const qualifier = families.length === 1 ? /\b(?:de|con)\s+(?:(?:un|una)\s+)?([a-z]+)\b/.exec(normalize(text)) : null;
  const required = qualifier && tokenFamily.get(qualifier[1]);
  return { constrained: families.length > 0, families,
    dishes: families.length ? dishes.filter(dish => families.some(family => dishMatchesFamily(dish, family)) &&
      (!required || dishMatchesFamily(dish, required))) : dishes };
}
module.exports = { primaryFoodFamilies, selectRelevantFood };
