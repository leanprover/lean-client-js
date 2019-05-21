Javascript library to interface with the server mode of the [Lean theorem prover](https://leanprover.github.io/).

This `lean-client-js-browser` package contains the web browser version.  It communicates with an emscripten build of Lean, optionally using webworkers and webassembly.  See [demo.ts](./demo.ts) for an example on how to use it.

You will need to place the files from the Lean emscripten build (downloadable from [here](https://github.com/leanprover-community/lean-nightly/releases), see the `lean-*-browser.zip` files) and a suitable `.zip` bundle of `.olean` files (see instructions [here](https://github.com/bryangingechen/lean-web-editor/#creating-a-customized-libraryzip)) into a subdirectory of this directory called `dist/` for the demo files to work. The `library.zip` file can be cached in IndexedDB to save on downloading, provided that its associated `library.info.json` is present as well.

To build the demo file, you may run `npm run demo` from the parent `lean-client-js` directory. The demo file can be written to `dist/demo.html`, by following the instructions below.

This package can also be built as a standalone UMD module. Run `../node_modules/.bin/webpack` from this directory. A test file `dist/lib_test.html` will be built.

Once the files are built, you can check them out by starting a local web server and navigating to `/index.html` or `/lib_test.html`.
