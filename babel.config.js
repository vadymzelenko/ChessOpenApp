// Used only by Jest for the pure-TS packages (packages/*).
// The Expo app has its own config in apps/mobile.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
};
