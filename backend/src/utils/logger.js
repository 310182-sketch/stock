const util = require('util');

const LEVELS = ['debug', 'info', 'warn', 'error'];
const DEFAULT_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level) {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(DEFAULT_LEVEL);
}

function format(level, args) {
  const ts = new Date().toISOString();
  const msg = args.map(a => (typeof a === 'string' ? a : util.inspect(a, { depth: 3 }))).join(' ');
  return `[${ts}] [${level.toUpperCase()}] ${msg}`;
}

module.exports = {
  debug: (...args) => { if (shouldLog('debug')) console.debug(format('debug', args)); },
  info: (...args) => { if (shouldLog('info')) console.log(format('info', args)); },
  warn: (...args) => { if (shouldLog('warn')) console.warn(format('warn', args)); },
  error: (...args) => { if (shouldLog('error')) console.error(format('error', args)); }
};
