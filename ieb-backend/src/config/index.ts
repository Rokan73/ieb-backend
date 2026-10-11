export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  jwt: {
    secret: process.env.JWT_SECRET || 'ieb-demo-jwt-secret-change-in-production-32chars',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  storage: {
    url: process.env.STORAGE_URL || '',
    key: process.env.STORAGE_KEY || '',
  },
  app: {
    name: 'IEB Backend Management System',
    version: '1.0.0',
    publicVerifyBaseUrl: process.env.PUBLIC_VERIFY_BASE_URL || 'https://ieb-demo.netlify.app/api/public',
  },
};
