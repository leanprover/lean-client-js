export interface LeanJsUrls {
    /**
     * URL to library.zip file
     */
    libraryZip: string;
    /**
     * URL to library.info.json
     */
    libraryMeta?: string;
    /**
     * URL to library.olean_map.json
     */
    libraryOleanMap?: string;
    /**
     * name of key in indexedDB for cache
     */
    libraryKey?: string;

    /**
     * URL to lean_js_js.js
     */
    javascript?: string;
    /**
     * URL to lean_js_wasm.wasm
     */
    webassemblyWasm?: string; // URL to lean_js_wasm.wasm
    /**
     * URL to lean_js_wasm.js
     */
    webassemblyJs?: string; // URL to lean_js_wasm.js
}

export interface LeanJsOpts extends LeanJsUrls {
    memoryMB?: number;
    /**
     * name of indexedDB database: default 'leanlibrary'
     */
    dbName?: string;
}
