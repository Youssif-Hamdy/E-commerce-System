import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Permissions ───────────────────────────────────────────────────────────
  const modules = [
    'products', 'categories', 'customers', 'suppliers', 'warehouses',
    'purchases', 'sales', 'inventory', 'invoices', 'returns',
    'reports', 'users', 'roles', 'zatca',
  ];
  const actions = ['view', 'create', 'update', 'delete'];
  const permissions = [];
  for (const mod of modules) {
    for (const action of actions) {
      const perm = await prisma.permission.upsert({
        where: { name: `${mod}:${action}` },
        update: {},
        create: { name: `${mod}:${action}`, module: mod, action },
      });
      permissions.push(perm);
    }
  }

  // Extra permissions not covered by standard actions
  const extraPermissions = [
    { name: 'zatca:onboard', module: 'zatca', action: 'onboard' },
  ];
  for (const ep of extraPermissions) {
    const perm = await prisma.permission.upsert({
      where: { name: ep.name },
      update: {},
      create: ep,
    });
    permissions.push(perm);
  }

  console.log(`✅ ${permissions.length} permissions`);

  // ── Roles ─────────────────────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin', description: 'صلاحيات كاملة' },
  });
  const managerRole = await prisma.role.upsert({
    where: { name: 'Manager' },
    update: {},
    create: { name: 'Manager', description: 'مدير المبيعات' },
  });
  const cashierRole = await prisma.role.upsert({
    where: { name: 'Cashier' },
    update: {},
    create: { name: 'Cashier', description: 'أمين الصندوق' },
  });
  const warehouseRole = await prisma.role.upsert({
    where: { name: 'Warehouse' },
    update: {},
    create: { name: 'Warehouse', description: 'أمين المخزن' },
  });
  await prisma.role.upsert({
    where: { name: 'Finance' },
    update: {},
    create: { name: 'Finance', description: 'المالية والتقارير' },
  });

  // Admin = all permissions
  await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // Manager = all except users/roles
  const managerPerms = permissions.filter((p) => !['users', 'roles'].includes(p.module));
  await prisma.rolePermission.deleteMany({ where: { roleId: managerRole.id } });
  await prisma.rolePermission.createMany({
    data: managerPerms.map((p) => ({ roleId: managerRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // Cashier = sales + customers + products view + invoices
  const cashierPerms = permissions.filter((p) =>
    ['sales:create', 'sales:view', 'customers:view', 'customers:create',
      'products:view', 'invoices:view', 'returns:create', 'returns:view'].includes(p.name)
  );
  await prisma.rolePermission.deleteMany({ where: { roleId: cashierRole.id } });
  await prisma.rolePermission.createMany({
    data: cashierPerms.map((p) => ({ roleId: cashierRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // Warehouse = inventory + purchases + products view
  const warehousePerms = permissions.filter((p) =>
    p.module === 'inventory' || p.module === 'purchases' || p.name === 'products:view' ||
    p.name === 'warehouses:view' || p.name === 'suppliers:view'
  );
  await prisma.rolePermission.deleteMany({ where: { roleId: warehouseRole.id } });
  await prisma.rolePermission.createMany({
    data: warehousePerms.map((p) => ({ roleId: warehouseRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  console.log('✅ Roles & permissions assigned');

  // ── Units ─────────────────────────────────────────────────────────────────
  const unitsData = [
    { name: 'قطعة', symbol: 'PCS' },
    { name: 'كيلوجرام', symbol: 'KG' },
    { name: 'لتر', symbol: 'LTR' },
    { name: 'صندوق', symbol: 'BOX' },
    { name: 'متر', symbol: 'MTR' },
  ];
  const units: Record<string, string> = {};
  for (const u of unitsData) {
    const unit = await prisma.unit.upsert({ where: { name: u.name }, update: {}, create: u });
    units[u.symbol] = unit.id;
  }
  console.log('✅ Units created');

  // ── Categories ────────────────────────────────────────────────────────────
  const categoriesData = [
    { name: 'إلكترونيات' },
    { name: 'مواد غذائية' },
    { name: 'ملابس' },
    { name: 'أجهزة منزلية' },
    { name: 'قرطاسية ومكتبية' },
  ];
  const cats: Record<string, string> = {};
  for (const c of categoriesData) {
    const cat = await prisma.category.upsert({ where: { name: c.name }, update: {}, create: c });
    cats[c.name] = cat.id;
  }
  console.log('✅ Categories created');

  // ── Default Warehouse ─────────────────────────────────────────────────────
  const warehouse = await prisma.warehouse.upsert({
    where: { name: 'المستودع الرئيسي' },
    update: {},
    create: { name: 'المستودع الرئيسي', location: 'الرياض - حي العليا', isDefault: true },
  });
  console.log('✅ Warehouse created');

  // ── Suppliers ─────────────────────────────────────────────────────────────
  const suppliersData = [
    { name: 'شركة الخليج للإلكترونيات', vatNumber: '300100000000003', phone: '+966112345678', city: 'الرياض' },
    { name: 'مؤسسة النور للمواد الغذائية', vatNumber: '300200000000003', phone: '+966113456789', city: 'جدة' },
    { name: 'شركة الأناقة للملابس', vatNumber: '300300000000003', phone: '+966114567890', city: 'الدمام' },
    { name: 'مصنع الأثاث الحديث', vatNumber: '300400000000003', phone: '+966115678901', city: 'الرياض' },
    { name: 'شركة المكتبة العربية', vatNumber: '300500000000003', phone: '+966116789012', city: 'مكة' },
  ];
  const supplierIds: string[] = [];
  for (const s of suppliersData) {
    const sup = await prisma.supplier.upsert({
      where: { id: `seed-supplier-${s.vatNumber}` },
      update: {},
      create: { ...s, country: 'SA' },
    }).catch(async () => {
      const found = await prisma.supplier.findFirst({ where: { vatNumber: s.vatNumber } });
      if (found) return found;
      return prisma.supplier.create({ data: { ...s, country: 'SA' } });
    });
    supplierIds.push(sup.id);
  }
  console.log('✅ Suppliers created');

  // ── Customers ─────────────────────────────────────────────────────────────
  const customersData = [
    { name: 'شركة التقنية المتقدمة', vatNumber: '310100000000003', phone: '+966501111111', city: 'الرياض', email: 'info@advanced-tech.sa' },
    { name: 'مؤسسة الأعمال المتميزة', vatNumber: '310200000000003', phone: '+966502222222', city: 'جدة', email: 'contact@excellence.sa' },
    { name: 'محمد بن سعد الحربي', phone: '+966503333333', city: 'الرياض', email: 'mharbi@gmail.com' },
    { name: 'فاطمة أحمد العتيبي', phone: '+966504444444', city: 'الدمام', email: 'fatima@outlook.com' },
    { name: 'مجموعة الفهد التجارية', vatNumber: '310500000000003', phone: '+966505555555', city: 'الرياض', email: 'info@fahad-group.sa' },
  ];
  // Walk-in customer
  await prisma.customer.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'عميل عام', isWalkIn: true, country: 'SA' },
  }).catch(async () => {
    const existing = await prisma.customer.findFirst({ where: { isWalkIn: true } });
    if (!existing) await prisma.customer.create({ data: { name: 'عميل عام', isWalkIn: true, country: 'SA' } });
  });

  const customerIds: string[] = [];
  for (const c of customersData) {
    const cust = await prisma.customer.findFirst({ where: { phone: c.phone } });
    if (cust) { customerIds.push(cust.id); continue; }
    const newCust = await prisma.customer.create({ data: { ...c, country: 'SA' } });
    customerIds.push(newCust.id);
  }
  console.log('✅ Customers created');

  // ── Products ──────────────────────────────────────────────────────────────
  const productsData = [
    {
      sku: 'ELEC-001', name: 'جهاز آيفون 15 برو', nameAr: 'آيفون 15 برو',
      categoryId: cats['إلكترونيات'], unitId: units['PCS'],
      purchasePrice: 3500, salePrice: 4500, vatRate: 15, barcode: '6281234567890',
    },
    {
      sku: 'ELEC-002', name: 'لابتوب ديل كور i7', nameAr: 'لابتوب ديل',
      categoryId: cats['إلكترونيات'], unitId: units['PCS'],
      purchasePrice: 2800, salePrice: 3800, vatRate: 15, barcode: '6281234567891',
    },
    {
      sku: 'FOOD-001', name: 'أرز بسمتي 5 كيلو', nameAr: 'أرز بسمتي',
      categoryId: cats['مواد غذائية'], unitId: units['KG'],
      purchasePrice: 25, salePrice: 35, vatRate: 0, isVatExempt: true, barcode: '6281234567892',
    },
    {
      sku: 'FOOD-002', name: 'زيت زيتون بكر 1 لتر', nameAr: 'زيت زيتون',
      categoryId: cats['مواد غذائية'], unitId: units['LTR'],
      purchasePrice: 30, salePrice: 45, vatRate: 0, isVatExempt: true, barcode: '6281234567893',
    },
    {
      sku: 'CLTH-001', name: 'قميص رجالي قطن', nameAr: 'قميص رجالي',
      categoryId: cats['ملابس'], unitId: units['PCS'],
      purchasePrice: 50, salePrice: 120, vatRate: 15, barcode: '6281234567894',
    },
    {
      sku: 'HOME-001', name: 'غسالة ملابس أوتوماتيك 7 كيلو', nameAr: 'غسالة ملابس',
      categoryId: cats['أجهزة منزلية'], unitId: units['PCS'],
      purchasePrice: 1200, salePrice: 1800, vatRate: 15, barcode: '6281234567895',
    },
    {
      sku: 'HOME-002', name: 'مكيف سبليت 18000 BTU', nameAr: 'مكيف سبليت',
      categoryId: cats['أجهزة منزلية'], unitId: units['PCS'],
      purchasePrice: 900, salePrice: 1400, vatRate: 15, barcode: '6281234567896',
    },
    {
      sku: 'OFFC-001', name: 'ورق طباعة A4 (ريمة 500 ورقة)', nameAr: 'ورق طباعة A4',
      categoryId: cats['قرطاسية ومكتبية'], unitId: units['BOX'],
      purchasePrice: 15, salePrice: 25, vatRate: 15, barcode: '6281234567897',
    },
    {
      sku: 'OFFC-002', name: 'أقلام حبر جاف (علبة 12)', nameAr: 'أقلام حبر',
      categoryId: cats['قرطاسية ومكتبية'], unitId: units['BOX'],
      purchasePrice: 8, salePrice: 15, vatRate: 15, barcode: '6281234567898',
    },
    {
      sku: 'ELEC-003', name: 'سماعات بلوتوث لاسلكية', nameAr: 'سماعات بلوتوث',
      categoryId: cats['إلكترونيات'], unitId: units['PCS'],
      purchasePrice: 150, salePrice: 280, vatRate: 15, barcode: '6281234567899',
    },
  ];

  const productIds: string[] = [];
  for (const p of productsData) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (existing) { productIds.push(existing.id); continue; }
    const product = await prisma.product.create({ data: p });
    productIds.push(product.id);

    // Create inventory record for each product
    await prisma.inventory.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      update: {},
      create: {
        productId: product.id,
        warehouseId: warehouse.id,
        currentQuantity: 50,  // 50 وحدة افتراضياً
        minimumQuantity: 5,
      },
    });
  }
  console.log('✅ Products + Inventory created (50 units each)');

  // ── Users ─────────────────────────────────────────────────────────────────
  const usersData = [
    { name: 'مدير النظام', email: 'admin@example.com', password: 'Admin@1234', roleId: adminRole.id },
    { name: 'أحمد المدير', email: 'manager@example.com', password: 'Manager@1234', roleId: managerRole.id },
    { name: 'خالد الكاشير', email: 'cashier@example.com', password: 'Cashier@1234', roleId: cashierRole.id },
    { name: 'سعد أمين المخزن', email: 'warehouse@example.com', password: 'Warehouse@1234', roleId: warehouseRole.id },
    { name: 'نورة المحاسبة', email: 'finance@example.com', password: 'Finance@1234', roleId: adminRole.id },
  ];

  for (const u of usersData) {
    const hashed = await bcrypt.hash(u.password, 12);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, password: hashed, roleId: u.roleId },
    });
  }
  console.log('✅ Users created');

  // ── ZATCA Settings ────────────────────────────────────────────────────────
  const zatcaExists = await prisma.zatcaSettings.findFirst();
  if (!zatcaExists) {
    await prisma.zatcaSettings.create({
      data: {
        sellerName: 'My Company Name',
        sellerNameAr: 'اسم الشركة',
        vatNumber: '300000000000003',
        crNumber: '1234567890',
        buildingNumber: '1234',
        street: 'طريق الملك فهد',
        district: 'حي العليا',
        city: 'الرياض',
        countryCode: 'SA',
        postalCode: '12345',
        environment: 'mock',
        isActive: true,
      },
    });
  }
  console.log('✅ ZATCA settings created');

  console.log(`
╔══════════════════════════════════════════════════════════╗
║                  🌱 Seed Complete!                       ║
╠══════════════════════════════════════════════════════════╣
║  👤 Users:                                               ║
║     admin@example.com       Admin@1234    (Admin)        ║
║     manager@example.com     Manager@1234  (Manager)      ║
║     cashier@example.com     Cashier@1234  (Cashier)      ║
║     warehouse@example.com   Warehouse@1234 (Warehouse)   ║
║     finance@example.com     Finance@1234  (Finance)      ║
╠══════════════════════════════════════════════════════════╣
║  📦 Products:    10 منتج (50 وحدة لكل منتج)              ║
║  🏭 Suppliers:   5 موردين                                ║
║  👥 Customers:   5 عملاء + عميل عام                      ║
║  🏪 Warehouses:  1 (المستودع الرئيسي)                    ║
║  🏷️  Categories: 5 أصناف                                 ║
║  🔧 Units:       5 وحدات قياس                            ║
╚══════════════════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
