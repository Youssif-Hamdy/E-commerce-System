import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sales + Inventory + ZATCA API',
      version: '1.0.0',
      description: `## نظام المبيعات والمخزون والربط مع هيئة الزكاة والضريبة\n\n### Authentication\nUse **Bearer Token** in Authorization header:\n\`Authorization: Bearer <access_token>\`\n\n### ZATCA Environment\nCurrent mode: **${env.zatca.env.toUpperCase()}**\n- \`mock\` → ZATCA Mock Simulator\n- \`sandbox\` → ZATCA Sandbox API\n- \`production\` → ZATCA Production API\n\n### Token Expiry\n- Access Token: **30 days**\n- Refresh Token: **7 days**`,
      contact: { name: 'API Support', email: 'support@example.com' },
    },
    servers: [
      { url: `http://localhost:${env.port}/api`, description: 'Development Server' },
      { url: 'https://your-production-domain.com/api', description: 'Production Server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: { type: 'array', items: { type: 'object' } },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 5 },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication & Authorization' },
      { name: 'Users', description: 'User Management' },
      { name: 'Roles', description: 'Roles & Permissions' },
      { name: 'Categories', description: 'Product Categories' },
      { name: 'Products', description: 'Product Management' },
      { name: 'Units', description: 'Measurement Units' },
      { name: 'Customers', description: 'Customer Management' },
      { name: 'Suppliers', description: 'Supplier Management' },
      { name: 'Warehouses', description: 'Warehouse Management' },
      { name: 'Inventory', description: 'Inventory & Stock Management' },
      { name: 'Purchases', description: 'Purchase Orders' },
      { name: 'Sales', description: 'Sales & POS' },
      { name: 'Payments', description: 'Payments' },
      { name: 'Invoices', description: 'Tax Invoices (ZATCA)' },
      { name: 'Returns', description: 'Returns & Credit Notes' },
      { name: 'StockCounts', description: 'Stock Count & Reconciliation' },
      { name: 'Reports', description: 'Business Reports' },
      { name: 'ZATCA', description: 'ZATCA Integration (هيئة الزكاة والضريبة)' },
    ],
  },
  apis: ['./src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);