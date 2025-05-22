const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add fallbacks for node modules
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
      };

      // Add aliases
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        '@hey-api/client-axios': path.resolve(__dirname, 'node_modules/@hey-api/client-axios'),
      };

      // Add plugins
      webpackConfig.plugins.push(
        new webpackConfig.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );

      return webpackConfig;
    },
  },
}; 