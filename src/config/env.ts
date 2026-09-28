import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`⚠️  Warning: ${envVar} is not set in .env`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appName: process.env.APP_NAME || 'ZATCA-Backend',

  db: {
    url: process.env.DATABASE_URL || '',
    directUrl: process.env.DIRECT_URL || '',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'fallback_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '30d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  zatca: {
    env: (process.env.ZATCA_ENV || 'mock') as 'mock' | 'sandbox' | 'production',
    sellerName: process.env.ZATCA_SELLER_NAME || 'My Company',
    vatNumber: process.env.ZATCA_VAT_NUMBER || '300000000000003',
    crNumber: process.env.ZATCA_CR_NUMBER || '1234567890',
    buildingNumber: process.env.ZATCA_BUILDING_NUMBER || '1234',
    street: process.env.ZATCA_STREET || 'King Fahad Road',
    district: process.env.ZATCA_DISTRICT || 'Al Olaya',
    city: process.env.ZATCA_CITY || 'Riyadh',
    countryCode: process.env.ZATCA_COUNTRY_CODE || 'SA',
    postalCode: process.env.ZATCA_POSTAL_CODE || '12345',
    apiUrl:
      process.env.ZATCA_API_URL ||
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
    sandboxUrl:
      process.env.ZATCA_SANDBOX_URL ||
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
    complianceRequestId: process.env.ZATCA_COMPLIANCE_REQUEST_ID || '',
    otp: process.env.ZATCA_OTP || '',
    csid: process.env.ZATCA_CSID || '',
    privateKey: process.env.ZATCA_PRIVATE_KEY || '',
    certificate: process.env.ZATCA_CERTIFICATE || '',
  },

  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3001').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  log: {
    level: process.env.LOG_LEVEL || 'debug',
  },
};
