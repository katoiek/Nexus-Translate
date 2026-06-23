/**
 * Simple logger that can be toggled
 *
 * 詳細ログ(log/info)は debug フラグ時のみ。エラー/警告は本番でも常に出力し、
 * DevTools で原因を追えるようにする。
 * / Verbose logs (log/info) only when debug is on. Errors/warnings are always
 *   emitted so production issues can be inspected via DevTools.
 */
const isVerbose = (): boolean => {
    try {
        return localStorage.getItem('nexus_debug') === '1';
    } catch {
        return false;
    }
};

export const logger = {
    log: (...args: any[]) => {
        if (isVerbose()) console.log(...args);
    },
    error: (...args: any[]) => {
        console.error(...args);
    },
    warn: (...args: any[]) => {
        console.warn(...args);
    },
    info: (...args: any[]) => {
        if (isVerbose()) console.info(...args);
    }
};
