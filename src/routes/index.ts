import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import usersRoutes from '../modules/users/users.routes';
import categoriesRoutes from '../modules/categories/categories.routes';
import unitsRoutes from '../modules/units/units.routes';
import productsRoutes from '../modules/products/products.routes';
import customersRoutes from '../modules/customers/customers.routes';
import suppliersRoutes from '../modules/suppliers/suppliers.routes';
import warehousesRoutes from '../modules/warehouses/warehouses.routes';
import inventoryRoutes from '../modules/inventory/inventory.routes';
import purchasesRoutes from '../modules/purchases/purchases.routes';
import salesRoutes from '../modules/sales/sales.routes';
import invoicesRoutes from '../modules/invoices/invoices.routes';
import returnsRoutes from '../modules/returns/returns.routes';
import stockCountsRoutes from '../modules/stock-counts/stock-counts.routes';
import reportsRoutes from '../modules/reports/reports.routes';
import zatcaRoutes from '../modules/zatca/zatca.routes';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running 🚀', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/', usersRoutes);          // /users, /roles, /permissions
router.use('/categories', categoriesRoutes);
router.use('/units', unitsRoutes);
router.use('/products', productsRoutes);
router.use('/customers', customersRoutes);
router.use('/suppliers', suppliersRoutes);
router.use('/warehouses', warehousesRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/purchases', purchasesRoutes);
router.use('/sales', salesRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/returns', returnsRoutes);
router.use('/stock-counts', stockCountsRoutes);
router.use('/reports', reportsRoutes);
router.use('/zatca', zatcaRoutes);

export default router;
