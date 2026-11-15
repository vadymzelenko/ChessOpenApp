/** Root Jest config: runs pure-logic tests of every workspace package. */
module.exports = {
  projects: [
    {
      displayName: 'core',
      rootDir: '<rootDir>/packages/core',
      testEnvironment: 'node',
      transform: {
        '^.+\\.[jt]sx?$': ['babel-jest', { configFile: require.resolve('./babel.config.js') }],
      },
    },
    {
      displayName: 'ui',
      rootDir: '<rootDir>/packages/ui',
      testEnvironment: 'node',
      transform: {
        '^.+\\.[jt]sx?$': ['babel-jest', { configFile: require.resolve('./babel.config.js') }],
      },
    },
  ],
};
