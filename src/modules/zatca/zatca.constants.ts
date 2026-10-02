export const ZATCA_ENV_CONFIG = {
  sandbox: {
    // Developer Portal Sandbox
    baseUrl: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
    templateName: 'TSTZATCA-Code-Signing', 
  },
  simulation: {
    // Fatoora Simulation
    baseUrl: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
    templateName: 'PREZATCA-Code-Signing',
  },
  production: {
    // Fatoora Core
    baseUrl: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
    templateName: 'ZATCA-Code-Signing',
  }
} as const;

export function getZatcaConfig(envName: 'sandbox' | 'simulation' | 'production', customBaseUrl?: string) {
  const config = ZATCA_ENV_CONFIG[envName];
  return {
    baseUrl: customBaseUrl || config.baseUrl,
    templateName: config.templateName
  };
}
