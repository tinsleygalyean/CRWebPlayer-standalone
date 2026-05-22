'use strict';

/**
 * Standalone webpack config — used by scripts/build-engine.js.
 *
 * Key differences from the default webpack.config.js:
 *  - output.publicPath = './'          (§2d — relative paths only)
 *  - mode = 'production'               (minified, no eval())
 *  - devtool = false                   (§4a — no .map files in dist)
 *  - DefinePlugin: STANDALONE = true   (§5d — tree-shakes analytics SDKs)
 *  - entry = standalone entry point    (skips service-worker registration)
 */

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: './src/standalone/standalone-entry.ts',
  devtool: false,
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'crwebplayer.js',
    path: path.resolve(__dirname, 'dist/standalone-engine'),
    publicPath: './',
    clean: true,
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Curious Reader',
      template: 'index.standalone.html',
      filename: 'index.html',
      inject: 'body',
    }),
    new webpack.DefinePlugin({
      'process.env.STANDALONE': JSON.stringify('true'),
      STANDALONE: JSON.stringify(true),
    }),
  ],
  experiments: {
    topLevelAwait: true,
  },
  performance: {
    hints: 'warning',
    maxEntrypointSize: 2_000_000,
    maxAssetSize: 2_000_000,
  },
};
