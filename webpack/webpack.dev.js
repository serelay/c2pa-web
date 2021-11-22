/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    devtool: 'inline-source-map',
    mode: 'development'
});