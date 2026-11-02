export interface VideoSettings {
    /** 视频抽帧 */
    enabled: boolean;
    /** 每个视频最多截几张 */
    maxFrames: number;
    /** 短视频少截：每多少秒最多一张 */
    secondsPerFrame: number;
    /** 截图最长边（像素） */
    maxEdge: number;
    /** 超过这么大（MB）只截封面 */
    maxMB: number;
    /** 超过这么长（分钟）只截封面 */
    maxMinutes: number;
    /** 处理一个视频最多用几秒 */
    timeoutSeconds: number;
    /** ffmpeg 位置；空 = 先找插件目录里装的，再找系统里的 */
    ffmpegPath: string;
}
export interface Frames {
    /** 视频时长（秒）；读不出来时为 undefined */
    duration: number | undefined;
    /** JPEG 字节 */
    frames: Uint8Array[];
    /** 视频太大或太长，只截了封面 */
    coverOnly: boolean;
}
/** 插件自己装的 ffmpeg 放在哪。 */
export declare function ffmpegDir(): string;
export interface FfmpegFound {
    path: string;
    version: string;
    source: 'configured' | 'bundled' | 'system';
}
/** 在 PATH 里找到程序的完整路径（设置页要显示 ffmpeg 具体在哪）；找不到就原样返回名字。 */
export declare function onPath(name: string, env?: NodeJS.ProcessEnv): Promise<string>;
/** 找 ffmpeg：设置里填的 → 插件目录里装的 → 系统 PATH 上的。结果缓存一分钟。 */
export declare function findFfmpeg(configured: string, fresh?: boolean): Promise<FfmpegFound | undefined>;
/** 从 `ffmpeg -i` 的输出里读时长：Duration: 00:01:02.50 */
export declare function parseDuration(stderr: string): number | undefined;
/**
 * 截哪几个时间点（秒）：整段平均分布，短视频按「每 secondsPerFrame 秒最多一张」少截。
 * 第一张取开头附近（不取第 0 秒，很多视频开头是黑屏）。时长未知时只截第 1 秒。
 */
export declare function planFrames(duration: number | undefined, s: Pick<VideoSettings, 'maxFrames' | 'secondsPerFrame'>): number[];
/**
 * 从视频里截几张画面。
 * @param src - 本地路径或 http(s) 地址（ffmpeg 读网络地址时只取需要的部分，不用整个下载）
 * @param sizeBytes - 视频大小（知道的话），超过上限只截封面
 */
export declare function extractFrames(bin: string, src: string, sizeBytes: number | undefined, s: VideoSettings): Promise<Frames>;
/** 0:32 / 1:02:05 */
export declare function formatDuration(seconds: number): string;
/** 下载来源：BtbN/FFmpeg-Builds（GitHub，MIT，每天构建，带 checksums.sha256）。 */
export declare const FFMPEG_RELEASE_API = "https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest";
export interface InstallState {
    state: 'idle' | 'downloading' | 'verifying' | 'extracting' | 'done' | 'failed';
    /** 正在装的文件名 */
    asset?: string;
    received?: number;
    total?: number;
    error?: string;
    /** 装好后的版本 */
    version?: string;
    finishedAt?: number;
}
/** 这台机器对应的包名片段；不支持的平台返回 undefined。 */
export declare function platformTag(platform?: string, arch?: string): string | undefined;
/**
 * 在 release 的文件列表里挑一个：最新的正式版分支（ffmpeg-nX.Y-latest-<平台>-lgpl-X.Y.tar.xz）。
 * 用 LGPL 版：解码视频、输出 JPEG 都够用，体积也小一些。
 */
export declare function pickAsset(names: string[], tag: string): string | undefined;
/** checksums.sha256 里某个文件的值（格式：<sha256>  <文件名>）。 */
export declare function checksumFor(text: string, name: string): string | undefined;
export interface InstallDeps {
    /** release 信息地址（测试时换成本地服务器） */
    releaseApi?: string;
    platform?: string;
    arch?: string;
    /** 装到哪（默认插件数据目录下的 ffmpeg/） */
    dir?: string;
    fetch?: typeof fetch;
    onProgress?(state: InstallState): void;
}
/** 下载、核对、解压出 ffmpeg 这一个程序。失败抛错（临时文件会清掉）。 */
/** 连不上 GitHub 时（国内服务器常见）给的出路：系统软件源装、或者手动指定位置。 */
export declare const OFFLINE_HINT = "\u670D\u52A1\u5668\u8FDE\u4E0D\u4E0A GitHub\uFF0C\u4E00\u952E\u5B89\u88C5\u7528\u4E0D\u4E86\u3002\u53EF\u4EE5\u5728\u670D\u52A1\u5668\u4E0A\u7528\u6709\u7BA1\u7406\u5458\u6743\u9650\u7684\u7528\u6237\u8FD0\u884C sudo apt install -y ffmpeg\uFF08\u8D70\u7CFB\u7EDF\u8F6F\u4EF6\u6E90\uFF0C\u56FD\u5185\u4E91\u670D\u52A1\u5668\u4E00\u822C\u7528\u7684\u662F\u4E91\u5382\u5546\u7684\u955C\u50CF\uFF0C\u80FD\u8FDE\u4E0A\uFF09\uFF0C\u88C5\u597D\u540E\u70B9\u300C\u91CD\u65B0\u67E5\u627E\u300D\uFF1B\u6216\u8005\u628A ffmpeg \u653E\u5230\u670D\u52A1\u5668\u4E0A\uFF0C\u5728\u300Cffmpeg \u4F4D\u7F6E\u300D\u91CC\u586B\u5B83\u7684\u8DEF\u5F84\u3002";
export declare function installFfmpeg(deps?: InstallDeps): Promise<FfmpegFound>;
