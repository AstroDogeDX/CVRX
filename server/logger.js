const { app } = require('electron');
const winston = require('winston');
require('winston-daily-rotate-file');


const path = require('path');
const util = require('util');


const AppDataPath = app.getPath('userData');
const LogsPath = path.join(AppDataPath, 'CVRLogs');

const consoleFormat = winston.format.combine(
    winston.format.colorize({
        all: true,
    }),
    winston.format.timestamp({
        format:'HH:mm:ss.SSS',
    }),
    winston.format.printf(
        info => {
            let splat = '';
            const splatContent = info[Symbol.for('splat')];
            if (splatContent) {
                splat = '\n' + util.inspect(splatContent, {
                    showHidden: false,
                    depth: null,
                    colors: true,
                    maxArrayLength: 3,
                    maxStringLength: 200,
                });
            }
            return `[${info.timestamp}][\x1b[36m${info.module}\x1b[0m][${info.level}] ${info.message}${splat}`;
        },
    ),
);

const fileFormat = winston.format.combine(
    winston.format.timestamp({
        format:'YYYY/MM/DD_HH:mm:ss.SSS',
    }),
    winston.format.printf(
        info => {
            let splat = '';
            const splatContent = info[Symbol.for('splat')];
            if (splatContent) {
                splat = '\n' + util.inspect(splatContent, {
                    showHidden: false,
                    depth: null,
                    colors: false,
                    maxArrayLength: null,
                    maxStringLength: null,
                });
            }
            return `[${info.timestamp}][${info.module}][${info.level}] ${info.message}${splat}`;
        },
    ),
);

const transport = new winston.transports.DailyRotateFile({
    filename: 'CVRX_%DATE%.log',
    maxSize: '25m',
    maxFiles: '10',
    dirname: LogsPath,
    createSymlink: true,
    symlinkName: 'Latest.log',
    handleRejections: true,
    format: fileFormat,
});


const logger = winston.createLogger({
    level: app.isPackaged ? 'info' : 'debug',
    handleRejections: true,
    transports: [transport],
});


if (!app.isPackaged) {
    logger.add(new winston.transports.Console({ format: consoleFormat, level: 'debug' }));
}

exports.GetLogger = (module) => logger.child({ module: module });
