const webpack = require("webpack");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const { CracoAliasPlugin } = require("react-app-alias");

module.exports = {
  plugins: [
    {
      plugin: CracoAliasPlugin,
      options: {},
    },
  ],
  webpack: {
    plugins: {
      add: [
        new NodePolyfillPlugin({
          additionalAliases: ["process"],
        }), // fix "process is not defined" error:
        new webpack.ProvidePlugin({
          process: "process/browser",
          Buffer: ["buffer", "Buffer"],
        }),
      ],
    },
    configure: (config) => {
      // Add proper resolve fallbacks for LangChain
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "process": require.resolve("process/browser"),
        "buffer": require.resolve("buffer"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "util": require.resolve("util"),
        "url": require.resolve("url"),
        "fs": false,
        "net": false,
        "tls": false,
      };

      // Configure module rules
      const updatedConfig = {
      ...config,
      module: {
        ...config.module,
        rules: config.module.rules.map((rule) => {
          if (rule.oneOf instanceof Array) {
            // eslint-disable-next-line no-param-reassign
            rule.oneOf[rule.oneOf.length - 1].exclude = [
              /\.(js|mjs|jsx|cjs|ts|tsx)$/,
              /\.html$/,
              /\.json$/,
            ];
          }
          return rule;
        }),
      },
      };

      return updatedConfig;
    },
  },
  devServer: {
    allowedHosts: "all"
  },
  //     configure: (webpackConfig, { env, paths }) => {
  //       // eslint-disable-next-line no-param-reassign
  //       webpackConfig.resolve.fallback = {
  //         crypto: false,
  //       };
  //       return webpackConfig;
  //     },
  //   },
  //   resolve: {
  //     fallback: {
  //       crypto: false,
  //     },
  //   },
};
