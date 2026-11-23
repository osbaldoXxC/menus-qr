module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  ignorePatterns: ['dist', 'playwright-report', 'test-results'],
  rules: {
    'react-hooks/exhaustive-deps': 'error',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
  }
};
