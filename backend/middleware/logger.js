// Simple structured logger

const levels = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = levels[process.env.LOG_LEVEL] ?? levels.info;

function log(level, message, data) {
    if (levels[level] < currentLevel) return;
    const entry = {
        ts: new Date().toISOString(),
        level,
        message
    };
    if (data !== undefined) {
        if (data instanceof Error) {
            entry.error = data.message;
            entry.stack = data.stack;
        } else {
            entry.data = data;
        }
    }
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(JSON.stringify(entry));
}

export const logger = {
    debug: (msg, data) => log('debug', msg, data),
    info: (msg, data) => log('info', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data)
};
