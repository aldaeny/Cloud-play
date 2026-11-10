module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true, jest: true },
  rules: {
    // `const { passwordEncrypted, ...publicFields } = server` is how this code
    // strips secrets before returning a row. The omitted binding is meant to be
    // unused; ignoreRestSiblings allows that pattern without weakening the rule
    // for genuinely dead variables.
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    }],
  },
};
