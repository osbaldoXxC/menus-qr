'use strict';
const fs = require('node:fs');
const path = require('node:path');
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const paths = [process.env.MEXXICAN_VOCAB_PATH, '/app/shared/mexican-spanish-v1.json',
  path.resolve(__dirname, '../../../shared/mexican-spanish-v1.json')].filter(Boolean);
let registry = null;
for (const candidate of paths) {
  try {
    const value = JSON.parse(fs.readFileSync(candidate, 'utf8'));
    if (Array.isArray(value.concepts) && typeof value.version === 'string') { registry = value; break; }
  } catch (_) { /* No registry at this path; preserve conservative legacy behavior. */ }
}
function foodFamilies() {
  if (!registry) return null;
  return registry.concepts.filter(c => ['food','dish','food_category'].includes(c.category)).map(c => ({
    id: normalize(c.id),
    // Typos are recognized only in the user's request, never as catalog proof.
    request: ['equivalence','diminutive','typo_contextual'].flatMap(type => c.forms[type] || []).map(normalize),
    catalog: ['equivalence','diminutive'].flatMap(type => c.forms[type] || []).map(normalize)
  }));
}
function contextualForms(id) {
  const concept = registry && registry.concepts.find(item => item.id === id);
  return concept && concept.forms && Array.isArray(concept.forms.contextual) ? concept.forms.contextual.map(normalize) : [];
}
module.exports = { normalize, registry, foodFamilies, contextualForms };
