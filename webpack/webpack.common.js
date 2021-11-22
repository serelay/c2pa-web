/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
const webpack = require("webpack");
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const srcDir = path.join(__dirname, "..", "src");

module.exports = {
    entry: {
      popup: path.join(srcDir, 'popup.tsx'),
      background: path.join(srcDir, 'background.ts'),
      viewerC2pa: path.join(srcDir, 'viewerC2pa.tsx'),
      styles: path.join(srcDir, 'style.scss'),
    },
    output: {
        path: path.join(__dirname, "../dist"),
        filename: "[name].js",
        // none of these work to import in background.ts/js
        // ref: https://github.com/webpack/webpack/issues/6642
        // ref: https://github.com/webpack/webpack/issues/6525
        
        // globalObject: "this"
        // globalObject: "globalThis"
        // globalObject: `(() => {
        //     if (typeof self !== 'undefined') {
        //         return self;
        //     } else if (typeof window !== 'undefined') {
        //         return window;
        //     } else if (typeof global !== 'undefined') {
        //         return global;
        //     } else {
        //         return Function('return this')();
        //     }
        // })()`
        // globalObject: `typeof self !== 'undefined' ? self : this`
    },
    optimization: {
        splitChunks: {
            name: "vendor",
            // chunks: "initial",
        },
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
            {
                test: /\.(s(a|c)ss)$/,
                use: [{
                  loader: 'style-loader', // inject CSS to page
                }, {
                  loader: 'css-loader', // translates CSS into CommonJS modules
                },
                {
                  loader: 'sass-loader' // compiles Sass to CSS
                }]
              },
        ],
    },
    resolve: {
        modules: ['node_modules'],
        extensions: [".ts", ".tsx", ".js"],
        alias: {
          buffer: 'buffer',
          crypto: 'crypto'
        },
        fallback: { 
          crypto: require.resolve("crypto-browserify"),
          stream: require.resolve("stream-browserify")
        }
    },
    plugins: [
        new CopyPlugin({
            patterns: [{ from: ".", to: "../dist", context: "public" }],
            options: {},
        }),
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        }),
        new webpack.ProvidePlugin({
          crypto: 'crypto-browserify',
        }),
        new webpack.ProvidePlugin({
          stream: 'stream-browserify',
        })
    ],
};
