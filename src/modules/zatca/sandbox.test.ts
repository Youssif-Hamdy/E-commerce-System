import { prisma } from '../../config/database';
import { env } from '../../config/env';
import * as onboardingService from './onboarding.service';

/**
 * Sandbox Test Script for ZATCA Onboarding Flow
 * Run this via: npx ts-node src/modules/zatca/sandbox.test.ts
 *
 * Compliance checks now RUN by default.
 * To skip them: set SKIP_COMPLIANCE_CHECKS=true
 */

async function runSandboxFlow() {
  console.log('=== Starting ZATCA (Fatoora) Sandbox Onboarding Test ===\n');

  if (env.zatca.env !== 'sandbox') {
    console.error('⚠️ Warning: this test only runs when ZATCA_ENV="sandbox".');
    console.error('Update your .env file before running.');
    process.exit(1);
  }

  // NOTE: You must provide a valid Developer Portal OTP here.
  const OTP = process.env.ZATCA_OTP || '123345';
  console.log(`Using OTP: ${OTP}\n`);

  let unitId = '';
  const report: Record<string, { status: string; details: any }> = {};

  try {
    // 0. Create Unit
    console.log('⏳ Creating test unit...');
    const unit = await prisma.zatcaUnit.create({
      data: { name: 'Sandbox Test Unit', environment: 'sandbox' }
    });
    unitId = unit.id;
    report['Create Unit'] = { status: '✅ SUCCESS', details: unit.id };
    console.log('✅ Unit created:', unit.id);

    // 1. Generate CSR
    console.log('\n⏳ Generating keys and CSR...');
    await onboardingService.generateCsr(unitId); // Using the defaults for sandbox
    report['Generate CSR'] = { status: '✅ SUCCESS', details: 'Keys saved to database' };
    console.log('✅ Generated successfully.');

    // 2. Request Compliance CSID
    console.log('\n⏳ Requesting Compliance CSID...');
    try {
      const compliance = await onboardingService.requestComplianceCsid(unitId, OTP);
      report['Compliance CSID'] = { status: '✅ SUCCESS', details: compliance.message };
      console.log('✅ Compliance CSID acquired.');
    } catch (e: any) {
      report['Compliance CSID'] = { status: '❌ FAILED', details: e.message };
      throw e; // Stop flow
    }

    // 3. Run Compliance Checks (sends 4 test invoices) - RUNS BY DEFAULT
    const SKIP_COMPLIANCE_CHECKS = process.env.SKIP_COMPLIANCE_CHECKS === 'true';

    if (!SKIP_COMPLIANCE_CHECKS) {
      console.log('\n⏳ Running compliance checks (4 test invoices)...');
      try {
        const checks = await onboardingService.runComplianceChecks(unitId);

        // Print the full result of each invoice
        console.log('\n--- Compliance Check Results ---');
        console.log(JSON.stringify(checks.results, null, 2));
        console.log('--------------------------------');

        // runComplianceChecks does not throw on per-invoice errors, so check them here
        const failed = checks.results.filter((r: any) => r.error);
        if (failed.length > 0) {
          report['Compliance Checks'] = {
            status: '❌ FAILED',
            details: `${failed.length}/${checks.results.length} invoices failed: ${failed
              .map((r: any) => `${r.type} (HTTP ${r.status})`)
              .join(', ')}`
          };
          console.log(`⚠️ ${failed.length} of ${checks.results.length} invoices failed (see results above).`);
        } else {
          report['Compliance Checks'] = { status: '✅ SUCCESS', details: checks.results };
          console.log('✅ All test invoices passed.');
        }
      } catch (e: any) {
        report['Compliance Checks'] = { status: '❌ FAILED', details: e.message };
        throw e;
      }
    } else {
      console.log('\n⏳ Skipping compliance checks (SKIP_COMPLIANCE_CHECKS=true)...');
      report['Compliance Checks'] = { status: '⚠️ SKIPPED', details: 'Skipped' };
    }

    // 4. Request Production CSID
    // Note: we continue to this step even if some invoices failed,
    // so we can see how ZATCA responds.
    console.log('\n⏳ Requesting Production CSID...');
    try {
      const prod = await onboardingService.requestProductionCsid(unitId);
      report['Production CSID'] = { status: '✅ SUCCESS', details: prod.message };
      console.log('✅ Unit connected successfully.');
    } catch (e: any) {
      report['Production CSID'] = { status: '❌ FAILED', details: e.message };
      throw e;
    }

  } catch (err: any) {
    console.error('\n❌ Flow stopped due to error:', err.message);
  } finally {
    console.log('\n======================================');
    console.log('          FINAL WORKFLOW REPORT       ');
    console.log('======================================');
    for (const [step, result] of Object.entries(report)) {
      console.log(`${step}: ${result.status}`);
      if (result.status === '❌ FAILED') {
        console.log(`   Reason: ${result.details}`);
      }
    }
    console.log('======================================');

    // Cleanup the test unit to not clutter the DB
    if (unitId) {
      console.log('\n🧹 Deleting test unit from database...');
      await prisma.zatcaUnit.delete({ where: { id: unitId } }).catch(() => {});
      console.log('✅ Cleaned up.');
    }

    process.exit(0);
  }
}

runSandboxFlow();