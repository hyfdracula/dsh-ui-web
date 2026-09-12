/** `bili-download` namespace dictionaries: the Bilibili download card copy. */
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    'card.title': string;
    'card.description': string;
    'card.open': string;
    'card.hint': string;
    'modal.close': string;
    'panel.title': string;
    'panel.env.ytdlp': string;
    'panel.env.ffmpeg': string;
    'panel.env.ready': string;
    'panel.env.missing': string;
    'panel.env.checking': string;
    'panel.urlLabel': string;
    'panel.urlPlaceholder': string;
    'panel.cookieLabel': string;
    'panel.sessdata': string;
    'panel.biliJct': string;
    'panel.dedeUserID': string;
    'panel.qualityLabel': string;
    'panel.outputLabel': string;
    'panel.outputPlaceholder': string;
    'panel.availableFormats': string;
    'panel.fetchInfo': string;
    'panel.fetching': string;
    'panel.startDownload': string;
    'panel.cancelDownload': string;
    'panel.restart': string;
    'panel.merging': string;
    'panel.progress': string;
    'panel.error': string;
    'panel.done': string;
    'panel.savePath': string;
};
/** English dictionary (complete mirror). Keyed identically. */
export declare const en: typeof zh;
export type BiliDownloadKey = keyof typeof zh;
