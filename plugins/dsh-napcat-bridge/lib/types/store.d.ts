export declare function defaultDataDir(): string;
export declare class SessionStore {
    private readonly file;
    private map;
    constructor(file: string);
    get(umo: string): string | undefined;
    set(umo: string, sessionId: string): void;
}
