# 📘 Frontend API & ZATCA Integration Guide
### دليل شامل لمطوّر الفرونت إند — (مُحدَّث، مبني على الكود الفعلي)

> **Base URL:** `http://localhost:3000/api/v1`
> **Auth:** كل الـ Endpoints (ما عدا Login/Register) تحتاج:
> ```
> Authorization: Bearer <JWT_TOKEN>
> ```

---

## ⚠️ تحذيرات مهمة قبل البدء

> [!WARNING]
> **بيئة Sandbox فقط — بيانات تجريبية**
> النظام حالياً مختبَر على الـ Sandbox. الشهادات التجريبية لا تعمل على الإنتاج، والـ Sandbox لا يمثّل كل سلوك الإنتاج.

> [!IMPORTANT]
> **البيئة تُحدَّد من مكانين — وضّح للفرونت أيهما الحاكم:**
> - `ZATCA_ENV` في ملف `.env` → يحكم تدفق الفواتير (reporting/clearance)
> - `environment` في كل `ZatcaUnit` → يحكم عملية الـ Onboarding
>
> **حالياً:** `ZATCA_ENV` يتحكم في الـ mock/sandbox/production. قيم الوحدة تُمرَّر للـ SDK.

---

## 📋 جدول المحتويات

1. [نظرة عامة على النظام](#-نظرة-عامة-على-النظام)
2. [الـ Flow الأساسي للنظام](#-الـ-flow-الأساسي-للنظام)
3. [Auth — المصادقة](#1--auth--المصادقة)
4. [Users & Roles — المستخدمين والصلاحيات](#2--users--roles--المستخدمين-والصلاحيات)
5. [Categories — التصنيفات](#3--categories--التصنيفات)
6. [Units — الوحدات](#4--units--الوحدات)
7. [Products — المنتجات](#5--products--المنتجات)
8. [Customers — العملاء](#6--customers--العملاء)
9. [Suppliers — الموردين](#7--suppliers--الموردين)
10. [Warehouses — المستودعات](#8--warehouses--المستودعات)
11. [Inventory — المخزون](#9--inventory--المخزون)
12. [Purchases — المشتريات](#10--purchases--المشتريات)
13. [Sales — المبيعات](#11--sales--المبيعات)
14. [Invoices — الفواتير](#12--invoices--الفواتير)
15. [Returns — المرتجعات](#13--returns--المرتجعات)
16. [Stock Counts — الجرد](#14--stock-counts--الجرد)
17. [Reports — التقارير](#15--reports--التقارير)
18. [🇸🇦 ZATCA — الفاتورة الإلكترونية السعودية](#16--zatca--الفاتورة-الإلكترونية-السعودية)
19. [ZATCA Onboarding Flow خطوة بخطوة](#-zatca-onboarding-flow-خطوة-بخطوة)
20. [ما يجب أن يفعله الفرونت في شاشات ZATCA](#-ما-يجب-أن-يفعله-الفرونت-في-شاشات-zatca)
21. [نقاط ناقصة في الباك إند — يتجنبها الفرونت](#-نقاط-ناقصة-في-الباك-إند--يتجنبها-الفرونت)
22. [الصلاحيات (Permissions)](#-الصلاحيات-permissions)
23. [نصائح التكامل العامة](#-نصائح-التكامل-العامة)

---

## 🏗 نظرة عامة على النظام

النظام مبني بـ Node.js + Express + Prisma (PostgreSQL). يدعم:
- إدارة مخزون متعدد المستودعات
- المبيعات والمشتريات والمرتجعات
- الفوترة الإلكترونية السعودية (ZATCA — مُختبَر على Sandbox)
- نظام صلاحيات متعدد الأدوار (RBAC)

---

## 🔄 الـ Flow الأساسي للنظام

```
1. تسجيل الدخول (Auth)
         ↓
2. إعداد البيانات الأساسية:
   Units → Categories → Warehouses
         ↓
3. إضافة الأطراف:
   Suppliers + Customers
         ↓
4. إضافة المنتجات (Products)
         ↓
5. العمليات التشغيلية:
   Purchases (يزيد المخزون) → Sales (يسحب من المخزون)
         ↓
6. الفواتير تُنشأ تلقائياً وتُرسل لـ ZATCA بعد كل Sale
         ↓
7. المرتجعات / الجرد / التقارير
```

---

## 1. 🔐 Auth — المصادقة

### `POST /auth/login`
**Request Body:**
```json
{
  "email": "admin@store.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "name": "Admin", "email": "admin@store.com", "role": { "name": "admin", "permissions": ["..."] } },
    "token": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

### `POST /auth/register`
```json
{ "name": "اسم", "email": "user@example.com", "password": "password123" }
```

### `GET /auth/me` 🔒
جلب بيانات المستخدم الحالي مع صلاحياته — استخدمه لتطبيق RBAC في الواجهة.

### `POST /auth/refresh`
```json
{ "refreshToken": "eyJhbGci..." }
```

### `POST /auth/logout`
لا يحتاج Body.

### `POST /auth/forgot-password`
```json
{ "email": "user@example.com" }
```

### `POST /auth/reset-password`
```json
{ "token": "TOKEN_FROM_EMAIL_LINK", "newPassword": "new_secure_password" }
```

### `POST /auth/google`
```json
{ "token": "GOOGLE_ID_TOKEN_FROM_FRONTEND" }
```

---

## 2. 👥 Users & Roles — المستخدمين والصلاحيات

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/users` | قائمة المستخدمين |
| `GET` | `/users/:id` | تفاصيل مستخدم |
| `POST` | `/users` | إنشاء مستخدم |
| `PUT` | `/users/:id` | تعديل مستخدم |
| `GET` | `/roles` | قائمة الأدوار |
| `POST` | `/roles` | إنشاء دور |
| `PUT` | `/roles/:id/permissions` | تعديل صلاحيات دور |
| `GET` | `/permissions` | جميع الصلاحيات المتاحة |

**POST /users:**
```json
{ "name": "كاشير 1", "email": "cashier1@store.com", "password": "pass123", "roleId": "uuid" }
```

**PUT /roles/:id/permissions:**
```json
{ "permissions": ["sales:create", "sales:view", "inventory:view"] }
```

---

## 3. 🏷 Categories — التصنيفات

| Method | Endpoint |
|--------|----------|
| `GET` | `/categories` |
| `GET` | `/categories/:id` |
| `POST` | `/categories` |
| `PUT` | `/categories/:id` |
| `DELETE` | `/categories/:id` |

```json
{ "name": "إلكترونيات", "description": "الأجهزة الإلكترونية" }
```

---

## 4. 📐 Units — الوحدات

| Method | Endpoint |
|--------|----------|
| `GET` | `/units` |
| `GET` | `/units/:id` |
| `POST` | `/units` |
| `PUT` | `/units/:id` |
| `DELETE` | `/units/:id` |

```json
{ "name": "قطعة", "abbreviation": "قطعة" }
```

---

## 5. 📦 Products — المنتجات

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/products` | قائمة مع فلترة وبحث |
| `GET` | `/products/:id` | تفاصيل منتج |
| `POST` | `/products` | إضافة منتج |
| `PUT` | `/products/:id` | تعديل منتج |

**GET Query Params:** `?search=اسم&categoryId=uuid&page=1&limit=20`

**POST:**
```json
{
  "name": "لابتوب HP",
  "barcode": "1234567890123",
  "sku": "HP-LAPTOP-001",
  "categoryId": "uuid",
  "unitId": "uuid",
  "salePrice": 2500.00,
  "costPrice": 2000.00,
  "vatRate": 15,
  "description": "وصف المنتج"
}
```

> [!NOTE]
> حالياً `vatRate` هو نسبة مئوية فقط. المنتجات المعفاة من الضريبة تُضبط بـ `isVatExempt: true` (إن وُجد الحقل). قيم `vatCategory` للمنتجات 0% ليست موثّقة بعد في الباك إند.

---

## 6. 👤 Customers — العملاء

| Method | Endpoint |
|--------|----------|
| `GET` | `/customers` |
| `GET` | `/customers/:id` |
| `POST` | `/customers` |
| `PUT` | `/customers/:id` |
| `DELETE` | `/customers/:id` |

```json
{
  "name": "محمد أحمد",
  "email": "mohammed@example.com",
  "phone": "0501234567",
  "vatNumber": "300000000000003",
  "address": "الرياض، حي الملقا"
}
```

> [!IMPORTANT]
> **`vatNumber` هو المحدِّد الفعلي لنوع الفاتورة:**
> - عميل **له `vatNumber`** → فاتورة **Standard (B2B)** → تحتاج Clearance
> - عميل **بدون `vatNumber`** أو بيع بدون تحديد عميل → فاتورة **Simplified (B2C)** → تحتاج Reporting
>
> عميل مسجّل في النظام بدون رقم ضريبي = Simplified — هذا هو السلوك الفعلي في الكود.

---

## 7. 🏭 Suppliers — الموردين

| Method | Endpoint |
|--------|----------|
| `GET` | `/suppliers` |
| `GET` | `/suppliers/:id` |
| `POST` | `/suppliers` |
| `PUT` | `/suppliers/:id` |
| `DELETE` | `/suppliers/:id` |

```json
{ "name": "شركة ABC", "email": "abc@supplier.com", "phone": "0112345678", "vatNumber": "300999999900003", "address": "جدة" }
```

---

## 8. 🏬 Warehouses — المستودعات

| Method | Endpoint |
|--------|----------|
| `GET` | `/warehouses` |
| `GET` | `/warehouses/:id` |
| `POST` | `/warehouses` |
| `PUT` | `/warehouses/:id` |
| `DELETE` | `/warehouses/:id` |

```json
{ "name": "مستودع الرياض الرئيسي", "location": "الرياض، المنطقة الصناعية" }
```

---

## 9. 📊 Inventory — المخزون

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/inventory` | كميات كل منتج في كل مستودع |

**Query:** `?warehouseId=uuid&productId=uuid&page=1&limit=50`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "productId": "uuid",
      "warehouseId": "uuid",
      "currentQuantity": 150,
      "product": { "name": "لابتوب HP", "sku": "HP-001" },
      "warehouse": { "name": "مستودع الرياض" }
    }
  ]
}
```

---

## 10. 🛒 Purchases — المشتريات

| Method | Endpoint |
|--------|----------|
| `GET` | `/purchases` |
| `GET` | `/purchases/:id` |
| `POST` | `/purchases` |

**POST — Request Body:**
```json
{
  "supplierId": "uuid-of-supplier",
  "warehouseId": "uuid-of-warehouse",
  "purchaseDate": "2026-10-02",
  "notes": "ملاحظات",
  "items": [
    { "productId": "uuid", "quantity": 50, "unitCost": 120.00 }
  ]
}
```
> ✅ يُضيف الكميات تلقائياً للمخزون عند الحفظ.

---

## 11. 💰 Sales — المبيعات (نقطة البيع)

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/sales` | سجل المبيعات |
| `GET` | `/sales/:id` | تفاصيل |
| `POST` | `/sales` | إنشاء فاتورة بيع |
| `PATCH` | `/sales/:id/cancel` | إلغاء (للمبيعات بحالة PENDING فقط) |

**POST — Request Body:**
```json
{
  "customerId": "uuid-of-customer",
  "warehouseId": "uuid-of-warehouse",
  "paymentMethod": "CASH",
  "discountAmount": 50.00,
  "notes": "ملاحظات",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPrice": 2500.00,
      "discount": 0
    }
  ]
}
```
**`paymentMethod`:** `CASH` | `CARD` | `BANK_TRANSFER` | `OTHER`

> ✅ **ما يحدث تلقائياً بعد POST /sales:**
> 1. حساب VAT وإجمالي كل بند
> 2. سحب المخزون من المستودع
> 3. إنشاء فاتورة ضريبية (Invoice) بحالة `READY`
> 4. توقيع XML وإرساله لـ ZATCA تلقائياً

> [!WARNING]
> `PATCH /sales/:id/cancel` يعمل فقط للمبيعات بحالة `PENDING`. المبيعات المكتملة والمرتبطة بفاتورة مرسلة لا يمكن إلغاؤها — يجب استخدام المرتجعات بدلاً من ذلك.

**GET Sales Query Params:** `?customerId=uuid&status=COMPLETED&page=1&limit=20`

---

## 12. 🧾 Invoices — الفواتير

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/invoices` | قائمة الفواتير |
| `GET` | `/invoices/:id` | تفاصيل + QR + XML + سجل ZATCA |
| `POST` | `/invoices/:id/submit` | إعادة إرسال لـ ZATCA (للفواتير الفاشلة) |
| `GET` | `/invoices/:id/status` | حالة الإرسال لـ ZATCA |

**GET Query Params:** `?status=FAILED&page=1&limit=20`

**حالات الفاتورة (من الـ Schema الفعلي):**
| الحالة | المعنى |
|--------|--------|
| `DRAFT` | مسودة |
| `READY` | جاهزة، لم تُرسَل بعد |
| `SUBMITTED` | جاري الإرسال |
| `REPORTED` | تم Reporting بنجاح (B2C) |
| `CLEARED` | تم Clearance بنجاح (B2B) |
| `COMPLETED` | مكتملة |
| `FAILED` | فشل الإرسال — قابلة لإعادة المحاولة |
| `CANCELLED` | ملغاة |

**GET /invoices/:id — Response يشمل:**
```json
{
  "id": "uuid",
  "invoiceNumber": "EINV-000001",
  "type": "STANDARD",
  "status": "CLEARED",
  "subtotal": 4347.83,
  "vatAmount": 652.17,
  "total": 5000.00,
  "qrCode": "data:image/png;base64,...",
  "signedXml": "<?xml...",
  "xmlHash": "sha256hash",
  "zatcaStatus": "CLEARED",
  "zatcaResponse": { "clearanceStatus": "CLEARED", "validationResults": {...} },
  "zatcaLogs": [ { "action": "clearance", "status": "success", "createdAt": "..." } ]
}
```

> ⚡ `qrCode` جاهز للعرض مباشرة: `<img src={invoice.qrCode} />`

> [!NOTE]
> **تحذيرات ZATCA (202 Warnings):** الهيئة قد تقبل الفاتورة (CLEARED/REPORTED) مع تحذيرات. في هذه الحالة `validationResults.warningMessages` تكون ممتلئة. اعرض علامة تحذير ⚠️ في قائمة الفواتير إذا كانت الفاتورة CLEARED/REPORTED لكن `zatcaResponse.validationResults.warningMessages.length > 0`.

---

## 13. 🔄 Returns — المرتجعات

| Method | Endpoint |
|--------|----------|
| `GET` | `/returns` |
| `GET` | `/returns/:id` |
| `POST` | `/returns` |

**POST:**
```json
{
  "saleId": "uuid-of-original-sale",
  "reason": "العميل يريد استرداد المبلغ",
  "items": [
    { "productId": "uuid", "quantity": 1 }
  ]
}
```

> ✅ **يحدث تلقائياً:**
> 1. إعادة المخزون للمستودع
> 2. تحديث حالة البيع إلى `REFUNDED`
> 3. إنشاء **Credit Note** بحالة `DRAFT`
>
> ⚠️ Credit Note بحالة `DRAFT` — إرسالها لـ ZATCA endpoint غير متاح بعد في الباك إند.

---

## 14. 📋 Stock Counts — الجرد

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/stock-counts` | قائمة جلسات الجرد |
| `POST` | `/stock-counts` | بدء جلسة جديدة |
| `GET` | `/stock-counts/:id` | تفاصيل جلسة |
| `PUT` | `/stock-counts/:id/items` | إدخال الكميات الفعلية |
| `POST` | `/stock-counts/:id/approve` | اعتماد الجرد وتطبيق التسوية |

**POST /stock-counts:**
```json
{ "warehouseId": "uuid", "notes": "جرد شهر أكتوبر" }
```

**PUT /stock-counts/:id/items:**
```json
{
  "items": [
    { "productId": "uuid", "countedQuantity": 48 },
    { "productId": "uuid-2", "countedQuantity": 25 }
  ]
}
```

---

## 15. 📈 Reports — التقارير

| Method | Endpoint | الوصف |
|--------|----------|-------|
| `GET` | `/reports/sales` | تقرير المبيعات |
| `GET` | `/reports/purchases` | تقرير المشتريات |
| `GET` | `/reports/inventory` | تقرير المخزون |
| `GET` | `/reports/profit` | تقرير الأرباح |

**Query Params:** `?from=2026-01-01&to=2026-10-31&warehouseId=uuid`

---

---

## 16. 🇸🇦 ZATCA — الفاتورة الإلكترونية السعودية

### ما هو ZATCA؟
هيئة الزكاة والضريبة والجمارك تفرض إصدار فواتير إلكترونية موقّعة رقمياً وإرسالها لمنظومة فاتورة.

**نوعان من الفواتير:**
- 🏭 **Standard Invoice (B2B)** → العميل له رقم ضريبي → يحتاج **Clearance**
- 🛒 **Simplified Invoice (B2C)** → بيع نقدي أو عميل بلا رقم ضريبي → يحتاج **Reporting**

---

### Environments

| البيئة | الوصف | متى تُستخدم |
|--------|-------|-------------|
| `mock` | محاكاة محلية داخل النظام (بدون اتصال بـ ZATCA) | أثناء التطوير بدون إنترنت |
| `sandbox` | بيئة اختبار ZATCA الرسمية | الاختبار مع ZATCA فعلياً |
| `simulation` | بيئة محاكاة ZATCA (تحتاج منشأة حقيقية) | **قيد الإعداد — غير متاحة بعد** |
| `production` | الإنتاج الفعلي | عند الإطلاق الرسمي |

> [!IMPORTANT]
> في الـ **sandbox**، الـ OTP مطلوب كرقم. المثال الرسمي في Swagger ZATCA هو `123345` (وليس `123456` كما في المحاكاة المحلية).
> - **mock mode** (ZATCA_ENV=mock): أي OTP يعمل
> - **sandbox**: استخدم `123345` كما في Swagger الرسمي
> - **simulation/production**: OTP حقيقي من بوابة fatoora.zatca.gov.sa

---

### ZATCA APIs

#### الإدارة العامة

| Method | Endpoint | الوصف | الصلاحية |
|--------|----------|-------|----------|
| `GET` | `/zatca/status` | حالة التكامل + إحصائيات الفواتير | `zatca:view` |
| `GET` | `/zatca/logs` | سجلات إرسال ZATCA | `zatca:view` |

> [!WARNING]
> **`POST /zatca/test` مؤقتاً معطّل للاستخدام العام.** يُعيد إرسال آخر فاتورة حقيقية مما قد يُسبب إرسالاً مكرراً أو رد 409. لا تعرضه في واجهة المستخدم حتى يُصلَح.

**GET /zatca/status Response:**
```json
{
  "data": {
    "environment": "sandbox",
    "sellerName": "اسم المتجر",
    "vatNumber": "300000000000003",
    "invoicesSummary": {
      "CLEARED": 150,
      "REPORTED": 230,
      "FAILED": 3
    }
  }
}
```

**GET /zatca/logs:** `?status=success|error|warning&page=1&limit=20`

---

#### Multi-Unit Onboarding

| Method | Endpoint | الوصف | الصلاحية |
|--------|----------|-------|----------|
| `POST` | `/zatca/units` | إنشاء وحدة ZATCA | `zatca:onboard` |
| `POST` | `/zatca/units/:id/csr` | توليد مفاتيح + CSR | `zatca:onboard` |
| `POST` | `/zatca/units/:id/compliance` | طلب Compliance CSID | `zatca:onboard` |
| `POST` | `/zatca/units/:id/compliance-check` | اختبارات الامتثال | `zatca:onboard` |
| `POST` | `/zatca/units/:id/production` | طلب Production CSID | `zatca:onboard` |
| `POST` | `/zatca/units/:id/renew` | تجديد الشهادة | `zatca:onboard` |
| `GET` | `/zatca/units/:id/status` | حالة الوحدة | `zatca:view` |

> [!NOTE]
> **`GET /zatca/units` (قائمة الوحدات) غير متاح بعد في الباك إند.** الـ Wizard سيحتاجه لاحقاً.

---

## 🗺 ZATCA Onboarding Flow خطوة بخطوة

```
STEP 1: إنشاء وحدة ZATCA
━━━━━━━━━━━━━━━━━━━━━━━━
POST /zatca/units
Body: { "name": "الفرع الرئيسي", "environment": "sandbox" }
→ Response: { "id": "UNIT_UUID", "status": "NOT_CONNECTED" }
✅ احفظ الـ id

        ↓

STEP 2: توليد مفاتيح التشفير (CSR)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /zatca/units/:id/csr
Body (انظر الحقول الكاملة أدناه)
→ Response: { "success": true, "message": "Initialized SDK state successfully" }
الحالة تبقى: NOT_CONNECTED (لا تتغير حتى الخطوة 3)

        ↓

STEP 3: طلب Compliance CSID
━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /zatca/units/:id/compliance
Body: { "otp": "123345" }   ← sandbox OTP الرسمي
→ Response: { "success": true, "message": "Compliance CSID acquired" }
الحالة → COMPLIANCE

        ↓

STEP 4: اختبارات الامتثال
━━━━━━━━━━━━━━━━━━━━━━━━━
POST /zatca/units/:id/compliance-check
(لا يحتاج Body)
→ النظام يرسل فواتير تجريبية متعددة الأنواع
→ تحقق أن results لا تحتوي على errors حقيقية
⚠️ هذه الخطوة اختيارية في Sandbox، إلزامية في الإنتاج.

        ↓

STEP 5: طلب Production CSID ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /zatca/units/:id/production
(لا يحتاج Body)
→ Response: { "success": true, "message": "Production CSID acquired successfully" }
الحالة → CONNECTED

✅ الوحدة جاهزة! كل فاتورة بيع ستُرسل تلقائياً لـ ZATCA
```

---

### حالات ZatcaUnit (من Schema الفعلي)

| الحالة | المعنى |
|--------|--------|
| `NOT_CONNECTED` | الحالة الافتراضية عند الإنشاء |
| `COMPLIANCE` | تم الحصول على Compliance CSID |
| `CONNECTED` | ✅ جاهز للإنتاج، Production CSID مُفعَّل |
| `EXPIRED` | انتهت صلاحية الشهادة |
| `FAILED` | فشل في مرحلة من المراحل |

> ⚠️ أي حالة غير معروفة تُعرض كما هي — لا تفترض قيماً ثابتة.

---

### `POST /zatca/units` — Body:
```json
{
  "name": "الفرع الرئيسي - الرياض",
  "environment": "sandbox"
}
```

### `POST /zatca/units/:id/csr` — Body الكامل:
```json
{
  "vatNumber": "399999999900003",
  "invoiceType": "1100",
  "branchName": "الفرع الرئيسي",
  "organizationName": "Maximum Speed Tech Supply LTD",
  "commonName": "TST-886431145-399999999900003",
  "address": "RRRD2929",
  "industry": "Supply activities"
}
```

**`invoiceType` القيم الصحيحة (حسب دليل ZATCA الرسمي):**
| القيمة | المعنى |
|--------|--------|
| `1000` | قياسية Standard فقط |
| `0100` | مبسّطة Simplified فقط |
| `1100` | الاثنتان معاً ✅ (الأكثر شيوعاً) |

### `POST /zatca/units/:id/compliance` — Body:
```json
{
  "otp": "123345"
}
```
> **Sandbox:** استخدم `123345` (من Swagger الرسمي)
> **Mock (ZATCA_ENV=mock):** أي رقم يعمل
> **Simulation/Production:** OTP حقيقي من بوابة Fatoora

### `GET /zatca/units/:id/status` — Response:
```json
{
  "data": {
    "id": "uuid",
    "name": "الفرع الرئيسي",
    "environment": "sandbox",
    "status": "CONNECTED",
    "expiresAt": "2027-10-02T00:00:00.000Z",
    "lastError": { "errorMessage": "...", "createdAt": "..." }
  }
}
```

---

### كيف تُحدَّد نوع الفاتورة تلقائياً؟

```
POST /sales بيانات العميل
    ↓
الكود يتحقق: هل sale.customer.vatNumber موجود؟
    ├── نعم → STANDARD Invoice → Clearance API
    └── لا  → SIMPLIFIED Invoice → Reporting API
```

**الفاتورة المرسلة تتضمن:**
- XML موقّع بالمفتاح الخاص
- QR Code (TLV format) مُضمَّن في الفاتورة
- Hash للـ XML

---

## ✅ ما يجب أن يفعله الفرونت في شاشات ZATCA

### أضفه:
1. **بانر ثابت** "⚠️ بيئة تجريبية — بيانات Sandbox" يظهر في كل شاشات ZATCA
2. **في Onboarding Wizard:** لما `environment === 'sandbox'` اعمل خانة OTP معبّأة مسبقاً بـ `123345` مع ملاحظة "هذا هو الـ OTP الافتراضي للـ Sandbox"
3. **في قائمة الفواتير:** علامة ⚠️ على الفواتير المقبولة مع تحذيرات (`validationResults.warningMessages.length > 0`)
4. **زر إعادة الإرسال** فقط للفواتير بحالة `FAILED`
5. **عرض `lastError`** من `/zatca/units/:id/status` بشكل مقروء بدون أي secret

### أخفه أو أوقفه مؤقتاً:
1. **خيارا `simulation` و `production`** في الـ Wizard (غير مكتملان في الباك إند)
2. **زر "اختبار الاتصال"** (`POST /zatca/test`) حتى يُصلَح في الباك إند
3. **زر "إرسال Credit Note"** للمرتجعات (Endpoint غير موجود بعد)

---

## 🚧 نقاط ناقصة في الباك إند — يتجنبها الفرونت

| الناقص | السبب / التأثير |
|--------|----------------|
| `GET /zatca/units` — قائمة الوحدات | الـ Wizard لا يستطيع عرض الوحدات الموجودة |
| أي `endpoint` لـ `/zatca/settings` | جدول `ZatcaSettings` موجود في DB لكن لا API له — لا يمكن تعديل بيانات البائع من الواجهة |
| إرسال Credit Note لـ ZATCA | المرتجعات تُنشئ `CreditNote` بحالة `DRAFT` بس لا توجد طريقة لإرسالها |
| معالجة HTTP 303 (Clearance Disabled) | دليل ZATCA يقول إن Clearance قد يُرجع 303 ويطلب استخدام Reporting — الكود الحالي لا يعالجها |
| معالجة HTTP 409 (Duplicate) | يجب معالجته كنجاح (فاتورة مُرسَلة مسبقاً) |
| `PATCH /sales/:id/cancel` لا يتحقق من الفاتورة | يسمح بإلغاء بيع فاتورته مُرسَلة لـ ZATCA |
| عنوان المشتري التفصيلي | الفاتورة القياسية تتطلب (شارع + رقم مبنى + حي + مدينة + رمز بريدي) — العميل حالياً عنده `address` نص حر |

---

## 🔑 الصلاحيات (Permissions)

| الصلاحية | الوصف |
|-----------|-------|
| `sales:view` | عرض المبيعات |
| `sales:create` | إنشاء مبيعات |
| `purchases:view` | عرض المشتريات |
| `purchases:create` | إنشاء مشتريات |
| `inventory:view` | عرض المخزون |
| `products:view` | عرض المنتجات |
| `products:create` | إضافة منتجات |
| `customers:view` | عرض العملاء |
| `customers:create` | إضافة عملاء |
| `reports:view` | عرض التقارير |
| `zatca:view` | عرض حالة ZATCA وسجلاتها |
| `zatca:onboard` | ربط وحدات ZATCA (للمدير فقط) |

---

## 💡 نصائح التكامل العامة

### Axios Interceptor
```typescript
const api = axios.create({ baseURL: 'http://localhost:3000/api/v1' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### صيغة الـ Response
```json
// Success
{ "success": true, "message": "...", "data": { ... } }

// Paginated
{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 20, "total": 150, "pages": 8 } }

// Error
{ "success": false, "message": "رسالة الخطأ", "errors": [...] }
```

### عرض QR Code
```tsx
<img src={invoice.qrCode} alt="ZATCA QR" />
// qrCode يأتي من الـ API كـ data URL جاهزة (data:image/png;base64,...)
```

### مكتبات مقترحة
| المكتبة | الاستخدام |
|---------|-----------|
| `axios` | HTTP Client |
| `@tanstack/react-query` | Data Fetching + Caching |
| `react-to-print` | طباعة الفواتير |
| `recharts` | رسوم بيانية في Dashboard |
| `@react-oauth/google` | Google OAuth |
| `react-hook-form` + `zod` | Forms + Validation |

---

## 🏁 ترتيب تطوير الشاشات المقترح

```
Phase 1 — الأساسيات:
  ✅ Login / Auth Context / RBAC
  ✅ Dashboard (Reports Charts)
  ✅ Settings: Units, Categories, Warehouses

Phase 2 — الأطراف والمنتجات:
  ✅ Suppliers Management
  ✅ Customers Management (مع مراعاة vatNumber)
  ✅ Products Management

Phase 3 — العمليات:
  ✅ Purchases (فاتورة شراء)
  ✅ Sales / POS (فاتورة بيع)
  ✅ Inventory View

Phase 4 — الإدارة:
  ✅ Returns Management
  ✅ Stock Counts
  ✅ Users & Roles

Phase 5 — ZATCA (sandbox فقط):
  ✅ ZATCA Onboarding Wizard (sandbox فقط)
      + بانر "بيئة تجريبية"
      + OTP مملوء مسبقاً بـ 123345
  ✅ Invoices List مع حالات ZATCA وعلامة التحذير
  ✅ Invoice Print (مع QR Code)
  ✅ ZATCA Logs (بدون secrets)
```

---

*📅 آخر تحديث: أكتوبر 2026 | مبني على الكود الفعلي للنظام*
