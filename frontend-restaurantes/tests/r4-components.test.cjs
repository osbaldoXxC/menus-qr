// Server rendering with installed restaurant dependencies. No browser, network,
// persistent writes or E2E. Comensales dependency installation is incomplete;
// these checks validate its source against the same React 18 stack explicitly.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');
const dependencyRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(dependencyRoot, '..');

async function component(portal, file, exportName) {
  const entry = path.join(projectRoot, portal, 'src', file);
  const result = await esbuild.build({ entryPoints: [entry], bundle: true, write: false, platform: 'node',
    format: 'cjs', jsx: 'automatic', define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'installed-react-stack', setup(build) {
      build.onResolve({ filter: /^[^./]/ }, args => {
        if (path.isAbsolute(args.path) || args.kind === 'entry-point') return;
        return { path: require.resolve(args.path, { paths: [dependencyRoot] }), external: true };
      });
    } }] });
  const compiled = new Module(entry, module);
  compiled.filename = entry;
  compiled.paths = Module._nodeModulePaths(dependencyRoot);
  compiled._compile(result.outputFiles[0].text, entry);
  return compiled.exports[exportName];
}
function render(Component, props = {}) {
  return renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Component, props)));
}
for (const portal of ['frontend-restaurantes', 'frontend-comensales']) {
  test(`R4 ${portal} one required natural message and one search button`, async () => {
    const C = await component(portal, 'features/recommendations/NaturalSearch.tsx', 'NaturalSearch');
    const html = render(C, { initialText: 'Quiero algo picoso, pero que no tenga puerco' });
    assert.match(html, /Quiero algo picoso, pero que no tenga puerco/);
    assert.match(html, /Buscar platillos/);
    assert.equal((html.match(/<textarea/g) || []).length, 1);
    assert.equal((html.match(/type="submit"/g) || []).length, 1);
    assert.match(html, /required=""/);
    assert.doesNotMatch(html, /Paso [0-9]|Continuar|Presupuesto y exclusiones|social-context|Keto/);
    if (portal === 'frontend-comensales') {
      const initial = render(C);
      assert.doesNotMatch(initial, /Sin resultados verificables|Platillos encontrados|IA Gastronómica · Descubriendo/);
      assert.doesNotMatch(initial, /Activar animación|Desactivar animación|movimiento reducido/);
      assert.match(initial, /<button[^>]*type="submit"[^>]*disabled=""/);
      assert.match(html, /😋/);
      assert.match(html, /max-w-\[526px\]/);
      assert.match(html, /rounded-\[22px\]/);
      assert.match(html, /dark:bg-\[#201C1A\]/);
      assert.match(html, /Ejemplos de lo que puedes escribir/);
      assert.match(html, /Menos de \$150/);
      assert.match(html, /aria-describedby="natural-search-count"/);
      assert.match(html, /\/500/);
      assert.match(html, /Ej\. Quiero algo picoso sin puerco, y tengo 100 pesos\./);
    }
  });
  test(`R4 ${portal} restaurant wizard uses native dialog and direct text request`, async () => {
    const C = await component(portal, 'components/RecommendationWizard/RecommendationWizard.tsx', 'RecommendationWizard');
    const html = render(C, { restaurantId: 'synthetic', isOpen: true, onClose() {} });
    assert.match(html, /<dialog/); assert.match(html, /aria-label="Buscar platillos"/);
    assert.match(html, /Buscar platillos/); assert.doesNotMatch(html, /% match|Paso [0-9]/);
    if (portal === 'frontend-comensales') {
      assert.doesNotMatch(render(C, { restaurantId: 'synthetic', isOpen: false, onClose() {} }), /<textarea/);
    }
  });
  test(`R4 ${portal} results distinguish verified prices and controlled empty state`, async () => {
    const C = await component(portal, 'features/recommendations/NaturalSearch.tsx', 'SearchResults');
    const response = { recommendations: [{ dish: { id: 'd', nombre: 'Pollo', precio: 37.5 },
      restaurant: { id: 'r', name: 'R' }, reasons: ['Datos declarados'], safety: { disclaimer: 'Sin garantía de trazas.' } }],
      safety: { disclaimer: 'Información del menú.' }, status: { code: 'ok' }, meta: {}, requestId: 'r1', error: null };
    const unverified = render(C, { result: response });
    assert.match(unverified, /Pollo/);
    if (portal === 'frontend-comensales') {
      assert.match(unverified, /\$37\.50 MXN/);
      assert.doesNotMatch(unverified, /moneda no verificada/);
    } else assert.doesNotMatch(unverified, /37\.50/);
    response.recommendations[0].safety.priceVerified = true;
    assert.match(render(C, { result: response }), /37\.50/);
    response.recommendations = [];
    response.status.code = 'no_verified_results';
    const empty = render(C, { result: response });
    assert.match(empty, /Sin resultados verificables/); assert.doesNotMatch(empty, /Pollo/);
  });
  if (portal === 'frontend-comensales') test('R4 bouncy loading announces its status without a progress bar', async () => {
    const C = await component(portal, 'features/recommendations/BouncyLoadingScreen.tsx', 'BouncyLoadingScreen');
    const html = render(C, { isReady: false, showSpacyStatus: false });
    assert.match(html, /IA Gastronómica · Descubriendo/);
    for (const emoji of ['🥑', '🌮', '🌶️']) assert.ok(html.includes(emoji));
    assert.match(html, /Preparando tu experiencia personalizada/);
    assert.match(html, /role="status"/); assert.match(html, /aria-label="Buscando platillos"/);
    assert.doesNotMatch(html, /role="progressbar"|aria-valuenow|spaCy NLP Activado/);
    assert.match(html, /bg-black\/40 dark:bg-white\/25/);
    assert.match(html, /motion-reduce:animate-none/);
  });
  if (portal === 'frontend-comensales') test('R4 original interactive results use real data and deduplicate identities', async () => {
    const C = await component(portal, 'features/recommendations/DescubrirResultados.tsx', 'DescubrirResultados');
    const first = { dish: { id: 'a', nombre: 'Taco real', descripcion: 'Descripción declarada', precio: 40, ingredientes_principales: ['maíz'], url_imagen: '/taco.jpg' }, restaurant: { id: 'r', name: 'Restaurante A', menuUrl: '/menu/a' }, reasons: ['Razón del backend'], safety: { disclaimer: 'Sin garantía de trazas.', priceVerified: true } };
    const second = { dish: { id: 'b', nombre: 'Otro platillo', precio: 99 }, restaurant: { id: 'r', name: 'Restaurante A' }, reasons: [], safety: { disclaimer: 'Datos del menú.', priceVerified: false } };
    const response = { recommendations: [first, first, second], safety: { disclaimer: 'Seguridad del menú.' }, status: { code: 'ok' }, meta: {}, requestId: 'r', error: null };
    const html = render(C, { response, onRefine() {} });
    assert.match(html, /data-testid="recommendation-card"/);
    for (const value of ['Taco real', 'Restaurante A', 'maíz', 'Razón del backend', '40.00', '/taco.jpg', 'PRÓXIMOS PLATILLOS', 'Otro platillo', 'Refinar antojo']) assert.ok(html.includes(value), value);
    assert.equal((html.match(/Ver recomendación de Otro platillo/g) || []).length, 1);
    assert.doesNotMatch(html, /Ver recomendación de Taco real|99\.00|unsplash|% match|IA Procesado/);
    assert.match(html, /Descartar platillo/); assert.match(html, /Abrir menú del restaurante/);
    const unverified = render(C, { response: { ...response, recommendations: [second] }, onRefine() {} });
    assert.match(unverified, /\$99\.00 MXN/);
    assert.doesNotMatch(unverified, /moneda no verificada|alt="Otro platillo"|unsplash/);
    const missing = render(C, { response: { ...response, recommendations: [{ ...second, dish: { ...second.dish, precio: undefined } }] }, onRefine() {} });
    assert.match(missing, /Precio no disponible/);
  });
  if (portal === 'frontend-comensales') test('R4 bouncy starts automatically even with reduced motion, without an activation button', async () => {
    const originalLoad = Module._load; const animations = [];
    const motion = new Proxy({}, { get: (_, tag) => ({ children, animate, initial, exit, transition, ...props }) => {
      if (animate) animations.push(animate);
      return React.createElement(tag, props, children);
    } });
    Module._load = function(request, ...args) {
      if (String(request).includes('framer-motion')) return { motion, AnimatePresence: ({ children }) => children, useReducedMotion: () => true };
      return originalLoad.call(this, request, ...args);
    };
    try {
      const C = await component(portal, 'features/recommendations/BouncyLoadingScreen.tsx', 'BouncyLoadingScreen');
      const html = render(C, { isReady: false, showSpacyStatus: false });
      assert.doesNotMatch(html, /<button|Activar animación|Desactivar animación/);
      for (const height of [-38, -22, -24]) {
        assert.ok(animations.some(animation => Array.isArray(animation.y) && animation.y[1] === height));
      }
      assert.ok(animations.some(animation => Array.isArray(animation.scaleX)));
    } finally { Module._load = originalLoad; }
  });
  if (portal === 'frontend-comensales') test('R4 restores original bounce timing and synchronized shadow', async () => {
    const originalLoad = Module._load; const animations = [];
    const motion = new Proxy({}, { get: (_, tag) => ({ children, animate, initial, exit, transition, ...props }) => {
      if (animate) animations.push({ animate, transition });
      return React.createElement(tag, props, children);
    } });
    Module._load = function(request, ...args) {
      if (String(request).includes('framer-motion')) return { motion, AnimatePresence: ({ children }) => children, useReducedMotion: () => false };
      return originalLoad.call(this, request, ...args);
    };
    try {
      const C = await component(portal, 'features/recommendations/BouncyLoadingScreen.tsx', 'BouncyLoadingScreen');
      render(C, { isReady: false, showSpacyStatus: false });
      const taco = animations.find(item => Array.isArray(item.animate.y) && item.animate.y[1] === -38);
      const shadow = animations.find(item => Array.isArray(item.animate.scaleX));
      assert.deepEqual(taco.animate.y, [0, -38, 0]);
      assert.deepEqual(shadow.animate.scaleX, [1.15, 0.55, 1.15]);
      assert.deepEqual(taco.transition, shadow.transition);
      assert.equal(taco.transition.duration, 0.85);
      assert.ok(animations.some(item => Array.isArray(item.animate.y) && item.animate.y[1] === -22));
      assert.ok(animations.some(item => Array.isArray(item.animate.y) && item.animate.y[1] === -24));
    } finally { Module._load = originalLoad; }
  });
  test(`R4 ${portal} loading and connection errors are announced`, async () => {
    const C = await component(portal, 'features/recommendations/NaturalSearch.tsx', 'SearchNotice');
    assert.match(render(C, { loading: true, error: '' }), /role="status"/);
    const html = render(C, { loading: false, error: 'No pudimos buscar platillos.' });
    assert.match(html, /role="alert"/); assert.match(html, /No pudimos buscar platillos/);
  });
  test(`R4 ${portal} no recipe confirmation presented before server evidence loads`, async () => {
    const C = await component(portal, 'components/CatalogEvidencePanel.tsx', 'CatalogEvidencePanel');
    const html = render(C, { dishId: 'synthetic', dirty: true });
    assert.match(html, /Hay cambios sin guardar/);
    assert.match(html, /no garantiza ausencia de alérgenos/);
    assert.doesNotMatch(html, /Confirmar MXN de este precio/);
  });
}
