import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`⚠️  Warning: ${envVar} is not set in .env`);
  }
}

if (!process.env.ZATCA_ENCRYPTION_KEY || process.env.ZATCA_ENCRYPTION_KEY.length !== 32) {
  console.warn(`⚠️  Warning: ZATCA_ENCRYPTION_KEY is missing or not 32 characters long. A default key is used for development ONLY.`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appName: process.env.APP_NAME || 'ZATCA-Backend',
  
  log: {
    level: process.env.LOG_LEVEL || 'info'
  },

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

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  zatca: {
    // 1. ZATCA Settings Phase 1
    env: (process.env.ZATCA_ENV || 'sandbox') as 'sandbox' | 'simulation' | 'production' | 'mock',
    baseUrl: process.env.ZATCA_BASE_URL,
    apiUrl: process.env.ZATCA_API_URL || 'https://gw-apic-gov.gazt.gov.sa/e-invoicing/core',
    sandboxUrl: process.env.ZATCA_SANDBOX_URL || 'https://gw-apic-gov.gazt.gov.sa/e-invoicing/developer-portal',
    encryptionKey: process.env.ZATCA_ENCRYPTION_KEY || 'default_32_byte_secret_key_for_dev!!',
    csid: process.env.ZATCA_CSID || '',
    
    // Legacy / Defaults 
    sellerName: process.env.ZATCA_SELLER_NAME || 'My Company',
    vatNumber: process.env.ZATCA_VAT_NUMBER || '300000000000003',
    crNumber: process.env.ZATCA_CR_NUMBER || '1234567890',
    buildingNumber: process.env.ZATCA_BUILDING_NUMBER || '1234',
    street: process.env.ZATCA_STREET || 'King Fahad Road',
    district: process.env.ZATCA_DISTRICT || 'Al Olaya',
    city: process.env.ZATCA_CITY || 'Riyadh',
    countryCode: process.env.ZATCA_COUNTRY_CODE || 'SA',
    postalCode: process.env.ZATCA_POSTAL_CODE || '12345',
  },
};
