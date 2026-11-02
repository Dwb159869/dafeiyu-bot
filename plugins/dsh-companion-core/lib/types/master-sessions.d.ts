import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session';
export interface MasterBinding {
    ownerId: string;
    prefix: string;
    sessionId: string;
    cwd: string;
}
export interface MasterBridge {
    masterPrivateBindings(): MasterBinding[];
    restoreMasterPrivateBinding(ownerId: string, sessionId: string): Promise<void>;
}
interface Handle {
    header: SessionHeader;
    inheritedEventCount: number;
    read(): Promise<{
        events: readonly SessionEvent[];
    }>;
    append(events: readonly SessionEvent[]): Promise<void>;
    flush(): Promise<void>;
    close(): Promise<void>;
}
export interface SessionPersistence {
    flush(): Promise<void>;
    list(): Promise<readonly {
        header: SessionHeader;
    }[]>;
    open(id: string, access: 'read'): Promise<Handle>;
    create(header: SessionHeader, options: {
        inheritedEventCount: number;
    }): Promise<Handle>;
}
interface AttachmentRef {
    attachmentId: string;
    bytes: number;
    mediaType?: string;
    name?: string;
    width?: number;
    height?: number;
}
export interface SessionAttachments {
    readImage(ref: AttachmentRef): Promise<{
        data: Uint8Array;
    }>;
    readFileStream(ref: AttachmentRef): AsyncIterable<Uint8Array>;
    saveImage(input: {
        data: Uint8Array;
        mediaType: string;
        name?: string;
    }): Promise<AttachmentRef>;
    saveFile(input: {
        data: Uint8Array;
        name?: string;
    }): Promise<AttachmentRef>;
}
interface SessionWorkspaces {
    archivedSessionIds: readonly string[];
    resolveByPath(path: string): Promise<{
        attachSession(id: string): Promise<void>;
    } | undefined>;
    archiveSession(id: string): Promise<void>;
}
export interface MasterSessionServices {
    workspaces?: SessionWorkspaces;
    bridge?: MasterBridge;
    persistence?: SessionPersistence;
    attachments?: SessionAttachments;
}
export declare function exportMasterSessions(dir: string, services: MasterSessionServices): Promise<number>;
export declare function importMasterSessions(dir: string, services: MasterSessionServices): Promise<void>;
export {};
