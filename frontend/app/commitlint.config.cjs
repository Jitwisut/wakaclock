/**
 * Commitlint Configuration
 * @see https://commitlint.js.org/
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],

  // ---------------------------------------------------------------------------
  // Rules
  // ---------------------------------------------------------------------------
  rules: {
    // Type must be one of the following
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation only changes
        'style', // Changes that do not affect the meaning of the code
        'refactor', // A code change that neither fixes a bug nor adds a feature
        'perf', // A code change that improves performance
        'test', // Adding missing tests or correcting existing tests
        'build', // Changes that affect the build system or external dependencies
        'ci', // Changes to our CI configuration files and scripts
        'chore', // Other changes that don't modify src or test files
        'revert', // Reverts a previous commit
      ],
    ],

    // Type must be lowercase
    'type-case': [2, 'always', 'lower-case'],

    // Type cannot be empty
    'type-empty': [2, 'never'],

    // Subject cannot be empty
    'subject-empty': [2, 'never'],

    // Subject must not end with a period
    'subject-full-stop': [2, 'never', '.'],

    // Subject must be in sentence case (first letter lowercase)
    'subject-case': [2, 'always', 'lower-case'],

    // Header max length
    'header-max-length': [2, 'always', 100],

    // Body max line length
    'body-max-line-length': [2, 'always', 100],

    // Footer max line length
    'footer-max-line-length': [2, 'always', 100],
  },
};
