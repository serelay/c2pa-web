# C2PA Web (Chrome plugin)

## ⚠️ This project is intended to be forked and will not be maintained here. ⚠️

Beginnings of validation for the Coalition for Content Provenance and Authenticity ([C2PA](https://c2pa.org)) standard. 

**This was created targeting C2PA Draft Specification v0.7 (C2PA PUBLIC DRAFT, 2021-08-31)**

Uses Chrome's Plugin Manifest V3.

Features are incomplete but serve as a foundation for processing client-side in a browser.
Some code references exist for the [CAI](https://contentauthenticity.org) standard, but as C2PA supercedes it most have been removed. 

## Prerequisites

Install NVM [guide](https://github.com/nvm-sh/nvm#installing-and-updating)
This will allow you to have versions compatible with serelay-api and this separately (no interference).

**Setup**
* `nvm install 14.17.3`
* `nvm use`
* `npm install -g npm`
* [nvm + node + npm](https://nodejs.org/) (Current Version)

## Chrome prep

After building (see below)
Navigate to `chrome://extensions/` in your Chrome browser. Toggle Developer setting on.
`Load Unpacked` > Navigate to your local copy of this git repository directory `/dist`.

You will need to reload (round arrow) the plugin on this window after `watch` finishes compiling.

The plugin will not work if used on a `chrome://` prefixed URI as this is protected.

Click the plugin icon, then pin the plugin to make it visible across your session.

## Project Structure

* `src/typescript`: TypeScript source files
* `src/__tests__`: Test directory, containing tests and some sample files
* `dist`: Chrome Extension directory
* `dist/js`: Generated JavaScript files
* `public`: Static files for chrome packaging

## Local run
To run a validation locally (without a browser) see `src/__tests__/localRun.test.ts`. This could be used as a basis to extract as a non-chrome-plugin project.

## Commands
* `npm install` - Install 
* `npm run build` - Build
* `npm run watch` - Build in watch mode
* `npx jest` or `npm run test` - Run tests

## Load extension to chrome

Load `dist` directory

# Sample webpage
`cd sample_webserver`
`python3 -m http.server`
Visit `localhost:8000` in your browser and you can swap in/out the files as necessary. Adjust `index.html` to display the relevant file.

# Related projects
- [C2PA Android](https://github.com/serelay/c2pa-android)
- [C2PA iOS](https://github.com/serelay/c2pa-ios)
- [C2PA Node](https://github.com/serelay/c2pa-node)
- [C2PA Web](https://github.com/serelay/c2pa-web)

# Thanks
Thanks to [@IanField90](https://github.com/IanField90), [@iblamefish](https://github.com/iblamefish), [@lesh1k](https://github.com/lesh1k) for making this possible.