const webpack = require('webpack');
const path = require('path');

module.exports = function override(config, env) {
  // Add fallbacks for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer/'),
    path: require.resolve('path-browserify'),
    os: require.resolve('os-browserify/browser'),
    vm: require.resolve('vm-browserify'),
    process: require.resolve('process/browser'),
  };

  // Add aliases
  config.resolve.alias = {
    ...config.resolve.alias,
    '@hey-api/client-axios': path.resolve(__dirname, 'node_modules/@hey-api/client-axios'),
    'process': 'process/browser.js',
    'nanoid/non-secure': path.resolve(__dirname, 'node_modules/nanoid/non-secure/index.js'),
  };

  // Add plugins
  config.plugins = [
    ...config.plugins.filter(plugin => !(plugin instanceof webpack.DefinePlugin)),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser.js',
    }),
    new webpack.DefinePlugin({
      'process.env': JSON.stringify({
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
      }),
    }),
  ];

  // Add module rules for SASS
  const sassRule = config.module.rules.find(rule => rule.test && rule.test.toString().includes('scss|sass'));
  if (sassRule) {
    const sassLoader = sassRule.use.find(loader => loader.loader && loader.loader.includes('sass-loader'));
    if (sassLoader) {
      sassLoader.options = {
        ...sassLoader.options,
        implementation: require('sass'),
        sassOptions: {
          ...sassLoader.options?.sassOptions,
          outputStyle: 'compressed',
        },
      };
    }
  }

  // Configure dev server
  if (env === 'development') {
    config.devServer = {
      ...config.devServer,
      port: 3002,
      host: 'localhost',
      hot: true,
      historyApiFallback: true,
      allowedHosts: 'all',
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      client: {
        webSocketURL: 'auto://0.0.0.0:0/ws',
      },
    };
  }

  return config;
}; 