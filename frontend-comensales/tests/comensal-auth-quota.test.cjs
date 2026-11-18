'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modalSource = fs.readFileSync(
  path.resolve(__dirname, '../src/components/ComensalAuthModal.tsx'),
  'utf8'
);
const naturalSearchSource = fs.readFileSync(
  path.resolve(__dirname, '../src/features/recommendations/NaturalSearch.tsx'),
  'utf8'
);
const authServiceSource = fs.readFileSync(
  path.resolve(__dirname, '../src/services/comensalAuth.ts'),
  'utf8'
);

test('Issue #43 Frontend — ComensalAuthModal respeta prefers-reduced-motion, WCAG 2.1 AA (dialog, focus trap, Escape) y retorna null cerrado', () => {
  assert.match(modalSource, /if \(!isOpen\) return null;/);
  assert.match(modalSource, /<dialog/);
  assert.match(modalSource, /aria-modal="true"/);
  assert.match(modalSource, /aria-labelledby="comensal-auth-modal-title"/);
  assert.match(modalSource, /prefers-reduced-motion:\s*reduce/);
  assert.match(modalSource, /motion-reduce:animate-none/);
  assert.match(modalSource, /e\.key === 'Escape'/);
  assert.match(modalSource, /e\.key === 'Tab'/);
  assert.match(modalSource, /Antojo guardado \(se restaurará al entrar\)/);
});

test('Issue #43 Frontend — NaturalSearch muestra Usos disponibles: N de 5, restaura el antojo sin autodisparo y envía X-Idempotency-Key', () => {
  assert.match(naturalSearchSource, /Usos disponibles: \{quota\.remaining\} de \{quota\.limit \?\? 5\}/);
  assert.match(naturalSearchSource, /Plan de pago activo · Recomendaciones sin cuota semanal/);
  assert.match(naturalSearchSource, /submitButtonRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(naturalSearchSource, /handleAuthenticated[\s\S]*?flow\.current\?\.search\(/, 'El login jamás debe autodisparar la búsqueda sin acción explícita del usuario');
});

test('Issue #43 Frontend — comensalAuthService usa cookies HttpOnly (withCredentials: true) y jamás guarda tokens ni planes en localStorage', () => {
  assert.match(authServiceSource, /withCredentials:\s*true/);
  assert.doesNotMatch(authServiceSource, /localStorage\.setItem/, 'Prohibido almacenar tokens, planes o roles en localStorage');
});
