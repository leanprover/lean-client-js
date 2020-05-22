# lean-client-js-browser

This is a JavaScript library to interface with the server mode of the [Lean theorem prover](https://leanprover.github.io/).

This package contains the web browser version. It communicates with an Emscripten build of Lean in a WebWorker, using WebAssembly if available.

The [original version](https://github.com/leanprover/lean-client-js/tree/master/lean-client-js-browser) was authored by Gabriel Ebner.

## How to use

You will need to place the files from the Lean Emscripten build (downloadable from [here](https://github.com/leanprover-community/lean-nightly/releases), see the `lean-*-browser.zip` files) and a suitable `.zip` bundle of `.olean` files (see instructions [here](https://github.com/leanprover-community/lean-web-editor/#creating-a-customized-libraryzip)) into a subdirectory of this directory called `dist/` for the demo files to work. The `library.zip` file is cached in IndexedDB to save on downloading, provided that its associated `library.info.json` is present at the same path.

The main class is `WebWorkerTransport`. The constructor takes [a `LeanJsOptions` object](src/inprocesstypes.ts) with the following fields:
  - `libraryZip`: URL to `library.zip`. Must end in `.zip`. This field is used to generate the default values for some of the optional fields below.
  - `libraryMeta` (optional): URL to `library.info.json`, a JSON file whose keys are the Lean packages contained in `library.zip` and whose values are URL prefixes that point to the Lean source files. (default: the value of `libraryZip` with the final `.zip` replaced with `.info.json`)
  - `libraryOleanMap` (optional): URL to `library.olean_map.json`, a JSON file whose keys are the filenames of the oleans in `library.zip` (with .olean removed) and whose values are the name of the Lean package that they originate from (default: the value of `libraryZip` with the final `.zip` replaced with `.olean_map.json`)
  - `libraryKey` (optional): name for the key used in the indexedDB cache (default: the filename of `libraryZip` with `.zip` removed)
  - At least one of `javascript` or (`webassemblyWasm` + `webassemblyJs`) must be provided:
    - `javascript`: URL to `lean_js_js.js`
    - Both of the following fields should be provided to use the WebAssembly version of the Lean server:
      - `webassemblyWasm`: URL to `lean_js_wasm.wasm`
      - `webassemblyJs`: URL to `lean_js_wasm.js`
  - `memoryMB` (optional): size of memory in MB provided (default: 256)
  - `dbName` (optional): name of the IndexedDB database used to cache (default: `leanlibrary`)

The `WebWorkerTransport` object that is returned should be passed to the `Server` constructor. See the `lean-client-js` library for more information about the `Server` class.

See [`demo.ts`](./demo.ts) for an example on how to use this package in a TypeScript project. After building, see `dist/lib_test.html` for how to use this package in a webpage.

See [`leanprover-community/lean-web-editor`](https://github.com/leanprover-community/lean-web-editor) and [`mpedramfar/Lean-game-maker`](https://github.com/mpedramfar/Lean-game-maker) for example TypeScript projects that use this library.

See [these Observable notebooks](https://observablehq.com/collection/@bryangingechen/lean) for example webpages that use the UMD module `leanBrowser.js`.

## Building

To build the demo file, follow the directions in the README file in the parent package `lean-client-js`. The demo file will be written to `dist/demo.html`.

Running `../node_modules/.bin/webpack` from this directory will build and output the test file `dist/lib_test.html` as well as a UMD module `dist/leanBrowser.js` for use in webpages.

Once the files are built, you can check them out by starting a local web server (from the `dist/` directory) and navigating to `/index.html` or `/lib_test.html`.

## About this fork

This version of `lean-client-js-browser` has two main differences from the original:

1. First, it removes the `BrowserInProcessTransport` class which allowed running the Lean Emscripten server in the browser's main thread. You must use `WebWorkerTransport`, which runs the server in a WebWorker.

2. Second, it caches the `library.zip` file in the browser's IndexedDB store. The database name is determined by `opts.dbName`. This DB contains two "Object stores", one named `library` and one named `meta`:
  - `meta` is a key-value store, where the key used is given by `opts.libName` and the values are JSON objects which map the Lean package names in the ZIP file to source links
  - `library` is another key-value store, where the keys are the same as in `meta` and the values are the ZIP files stored as binary blobs.
