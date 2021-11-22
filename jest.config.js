/**
 * Copyright © 2021 Serelay Ltd. All rights reserved.
 */
module.exports = {
  "roots": [
    "src"
  ],
  "transform": {
    "^.+\\.ts$": "ts-jest"
  },
  setupFilesAfterEnv: ['./jest.setup.js'],
  silent: false,
};
