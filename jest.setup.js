/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
Object.assign(global, {
    chrome: require('sinon-chrome'),
    btoa: function (str) { return Buffer.from(str, 'binary').toString('base64') },
    atob: function (b64Encoded) { return Buffer.from(b64Encoded, 'base64').toString('binary') },
});