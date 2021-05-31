import winston from "winston";

const humanReadable = winston.format.printf(({ level, message, timestamp }) => {
  return `${level} ${process.pid}: ${message}`;
});

const options = {
  console: {
    level: "debug",
    handleExceptions: true,
    format: winston.format.combine(
      winston.format.errors({ stack: true }),
      humanReadable
    ),
    json: false,
    colorize: true,
  },
};

const logger = winston.createLogger({
  transports: [new winston.transports.Console(options.console)],
  exitOnError: false,
});

export = logger;
