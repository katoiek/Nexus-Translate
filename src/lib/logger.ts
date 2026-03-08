/**
 * Simple logger that can be toggled
 */
const IS_DEV = false; // Set to false for production release

export const logger = {
    log: (...args: any[]) => {
        if (IS_DEV) console.log(...args);
    },
    error: (...args: any[]) => {
        if (IS_DEV) console.error(...args);
    },
    warn: (...args: any[]) => {
        if (IS_DEV) console.warn(...args);
    },
    info: (...args: any[]) => {
        if (IS_DEV) console.info(...args);
    }
};
