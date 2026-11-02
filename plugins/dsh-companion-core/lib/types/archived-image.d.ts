interface ImagePart {
    type: 'image';
    mediaType: string;
    data: string;
}
export declare function archivedImage(dir: string, name: unknown): ImagePart | undefined;
export {};
