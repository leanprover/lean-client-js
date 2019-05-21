## Javascript interface to the Lean server

[Demo code](./lean-client-js-browser/demo.ts):
```
npm install
npm run bootstrap
npm run compile
```

Next you'll need to download a suitable release of the Lean emscripten build (see the `lean-*-browser.zip` files [here](https://github.com/leanprover-community/lean-nightly/releases)) and copy the files within to `lean-client-js-browser/dist`. You may also need to build your own `library.zip` and associated meta files following the instructions [here](https://github.com/bryangingechen/lean-web-editor/#creating-a-customized-libraryzip).

Then you can run:
```
npm run demo
```
And go to http://localhost:8080/

You can then also run `npm run node-demo` to see the same code interacting with a locally-installed version of Lean.

If you would like to support older browsers, you can try adding back the `babel-loader` plugin. Add these four lines to the `devDependencies` in `package.json`:
```
    "babel-core": "^6.26.3",
    "babel-loader": "^7.1.2",
    "babel-polyfill": "^6.26.0",
    "babel-preset-env": "^1.7.0",
```
 and uncomment the lines mentioning babel in `lean-client-js-browser/webpack.config.json` as well as the import in `webworkerscript.ts`.

See the [`lean-client-js-browser` README](./lean-client-js-browser/README.md) for more information about building for browser use.
