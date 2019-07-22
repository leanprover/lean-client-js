export interface LeanJsUrls {
    libraryZip?: string;

    javascript?: string;

    webassemblyWasm?: string;
    webassemblyJs?: string;
}

export interface LeanJsOpts extends LeanJsUrls {
    memoryMB?: number;
}
