export default () => {
  const {
    NODE_ENV = 'development',
    APP_PORT = 5021,
    APP_NAME = 'daleelex-backend',
    SWAGGER_PORT = 5022,
    LOG_LEVEL = 'info',
    LOG_ENABLE_CONSOLE = '',
    LOG_FILE = '',
    DATABASE_URL = '',
    DALEELEX_ADMIN_API_TOKEN = '',
    JENKINS_BASE_URL = '',
    JENKINS_USERNAME = '',
    JENKINS_API_TOKEN = '',
  } = process.env;

  const isConsoleEnabled = LOG_ENABLE_CONSOLE !== 'false';

  return {
    app: {
      nodeEnv: NODE_ENV,
      port: Number(APP_PORT),
      name: APP_NAME,
    },
    swagger: {
      port: Number(SWAGGER_PORT),
    },
    database: {
      url: DATABASE_URL,
    },
    admin: {
      apiToken: DALEELEX_ADMIN_API_TOKEN,
    },
    jenkins: {
      baseUrl: JENKINS_BASE_URL,
      username: JENKINS_USERNAME,
      apiToken: JENKINS_API_TOKEN,
    },
    application_logging: {
      level: LOG_LEVEL,
      console: isConsoleEnabled,
      file: LOG_FILE,
    },
  };
};
