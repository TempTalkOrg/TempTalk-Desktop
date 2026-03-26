import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';

import globals from 'globals';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

import importPlugin from 'eslint-plugin-import';
import mocha from 'eslint-plugin-mocha';
import promise from 'eslint-plugin-promise';

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
  prettier,

  {
    plugins: {
      import: importPlugin,
      promise,
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          caughtErrorsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // encourage consistent use of `async` / `await` instead of `then`
      'promise/prefer-await-to-then': 'warn',

      // it helps readability to put public API at top
      'no-use-before-define': 'off',

      // useful for unused or internal fields
      'no-underscore-dangle': 'off',

      // though we have a logger, we still remap console to log to disk
      'no-console': 'warn',
    },
    settings: {
      'import/core-modules': ['electron'],
    },
  },

  {
    files: ['**/*.test.{js,ts}', '**/test/**/*.{js,ts}'],
    plugins: {
      mocha,
    },
    rules: {
      // prevents us from accidentally checking in exclusive tests (`.only`):
      'mocha/no-exclusive-tests': 'error',

      // We still get the value of this rule, it just allows for dev deps
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],

      // We want to keep each test structured the same, even if its contents are tiny
      'arrow-body-style': 'off',

      strict: 'off',
    },
  },

  {
    files: [
      '*.js',
      'app/**/*.js',
      '**/*preload.js',
      'scripts/**/*.js',
      'js/modules/**/*.js',
      'js/logging.js',
      'config/*.js',
    ],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: [
      'js/**/*.js',
      '**/*preload.js',
      '**/*start.js',
      'libtextsecure/**/*.js',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    files: [
      '*.js',
      'app/**/*.js',
      '**/*preload.js',
      'scripts/**/*.js',
      'js/modules/**/*.js',
      'js/logging.js',
      'config/*.js',
    ],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: [
      'js/**/*.js',
      '**/*preload.js',
      '**/*start.js',
      'libtextsecure/**/*.js',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          caughtErrorsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      '@typescript-eslint/no-explicit-any': 'off',

      '@typescript-eslint/no-use-before-define': 'off',

      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },

  globalIgnores([
    'build/**/*',
    'components/**/*',
    'coverage/**/*',
    'dist/**/*',

    // Generated files
    'js/curve/*',
    'js/components.js',
    'js/libtextsecure.js',
    'js/util_worker.js',
    'js/libsignal-protocol-worker.js',
    'libtextsecure/components.js',
    'libtextsecure/test/test.js',
    'test/test.js',
    'ts/protobuf/compiled.d.ts',

    // Third-party files
    'js/Mp3LameEncoder.min.js',
    'js/WebAudioRecorderMp3.js',
    'js/libphonenumber-util.js',
    'js/libsignal-protocol-worker.js',
    'libtextsecure/libsignal-protocol.js',
    'libtextsecure/test/blanket_mocha.js',
    'test/blanket_mocha.js',

    // TypeScript generated files
    'ts/**/*.js',

    '**/test/**/*.js',
    'release/**/*',
  ]),
]);
