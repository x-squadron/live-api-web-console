const webpack = require("webpack");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
  webpack: {
    plugins: {
      add: [
        new NodePolyfillPlugin({
          additionalAliases: ["process"],
        }), // fix "process is not defined" error:
        // new webpack.ProvidePlugin({
        //   process: "process/browser",
        // }),
      ],
    },
    configure: (config) => ({
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
    }),
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
