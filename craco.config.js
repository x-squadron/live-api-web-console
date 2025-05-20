const webpack = require("webpack");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
  webpack: {
    plugins: {
      add: [
        new NodePolyfillPlugin(), // fix "process is not defined" error:
        new webpack.ProvidePlugin({
          process: "process/browser",
        }),
      ],
    },
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
