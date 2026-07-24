/**
 * DACM ERP - Spreadsheet table definitions.
 * Add a module by adding its definition here; Database.createDatabase() will
 * create the corresponding worksheet and header automatically.
 */
const SCHEMA = Object.freeze({
  BRANCH: { sheet: SHEET.BRANCH, primaryKey: 'BranchCode', columns: ['BranchCode', 'BranchName', 'Address', 'Phone', 'Status', 'CreatedAt'] },
  USERS: { sheet: SHEET.USERS, primaryKey: 'UserID', prefix: 'USR', columns: ['UserID', 'Username', 'Password', 'FullName', 'Role', 'Branch', 'Status', 'CreatedAt'] },
  ROLES: { sheet: SHEET.ROLES, primaryKey: 'RoleCode', columns: ['RoleCode', 'RoleName', 'Description', 'Status', 'CreatedAt'] },
  CUSTOMERS: { sheet: SHEET.CUSTOMERS, primaryKey: 'CustomerID', prefix: 'CUS', columns: ['CustomerID', 'CustomerName', 'Phone', 'WhatsApp', 'Address', 'CreatedAt'] },
  VEHICLES: { sheet: SHEET.VEHICLES, primaryKey: 'VehicleID', prefix: 'VEH', columns: ['VehicleID', 'CustomerID', 'PlateNumber', 'Brand', 'Model', 'Year', 'Color', 'EngineNo', 'ChassisNo', 'LastKM', 'CreatedAt'] },
  REGISTER: { sheet: SHEET.REGISTER, primaryKey: 'RegisterNo', prefix: 'REG', columns: ['RegisterNo', 'RegisterDate', 'Branch', 'CustomerID', 'VehicleID', 'Complaint', 'Recommendation', 'EstimatedTotal', 'Status', 'Notes', 'WorkOrderNo', 'PIC', 'CreatedAt'] },
  DIAGNOSIS: { sheet: SHEET.DIAGNOSIS, primaryKey: 'DiagnosisNo', prefix: 'DIA', columns: ['DiagnosisNo', 'RegisterNo', 'TechnicianID', 'DiagnosisDate', 'Finding', 'Recommendation', 'Status', 'CreatedAt'] },
  APPROVAL: { sheet: SHEET.APPROVAL, primaryKey: 'ApprovalNo', prefix: 'APR', columns: ['ApprovalNo', 'RegisterNo', 'ApprovalDate', 'Status', 'ApprovedBy', 'Notes', 'CreatedAt'] },
  WORKORDER: { sheet: SHEET.WORKORDER, primaryKey: 'WorkOrderNo', prefix: 'WO', columns: ['WorkOrderNo', 'RegisterNo', 'TechnicianID', 'StartDate', 'FinishDate', 'Status', 'Notes', 'CreatedAt', 'CustomerID', 'VehicleID', 'Branch', 'Odometer', 'Complaint', 'ComplaintDetail', 'Observation', 'Recommendation', 'WorkItems', 'EstimatedTotal', 'ApprovalStatus', 'ApprovedAt', 'InitialLowPress', 'InitialHighPress', 'InitialTemp', 'FinalLowPress', 'FinalHighPress', 'FinalTemp'] },
  WORKORDER_ITEMS: { sheet: SHEET.WORKORDER_ITEMS, primaryKey: 'WorkOrderItemNo', prefix: 'WOI', columns: ['WorkOrderItemNo', 'WorkOrderNo', 'LineNo', 'GroupName', 'ItemName', 'Qty', 'Price', 'Subtotal', 'Source', 'CreatedAt'] },
  QC: { sheet: SHEET.QC, primaryKey: 'QCNo', prefix: 'QC', columns: ['QCNo', 'WorkOrderNo', 'QCDate', 'InspectorID', 'Status', 'Notes', 'CreatedAt'] },
  INVOICE: { sheet: SHEET.INVOICE, primaryKey: 'InvoiceNo', prefix: 'INV', columns: ['InvoiceNo', 'RegisterNo', 'WorkOrderNo', 'InvoiceDate', 'GrandTotal', 'Status', 'CreatedAt'] },
  PAYMENT: { sheet: SHEET.PAYMENT, primaryKey: 'PaymentNo', prefix: 'PAY', columns: ['PaymentNo', 'InvoiceNo', 'PaymentDate', 'Method', 'Amount', 'ReferenceNo', 'CreatedAt'] },
  ITEMS: { sheet: SHEET.ITEMS, primaryKey: 'ItemCode', prefix: 'ITM', columns: ['ItemCode', 'ItemName', 'Category', 'Unit', 'SellingPrice', 'Status', 'CreatedAt'] },
  STOCK: { sheet: SHEET.STOCK, primaryKey: 'StockNo', prefix: 'STK', columns: ['StockNo', 'Branch', 'ItemCode', 'Quantity', 'MinimumStock', 'UpdatedAt'] },
  SUPPLIERS: { sheet: SHEET.SUPPLIERS, primaryKey: 'SupplierID', prefix: 'SUP', columns: ['SupplierID', 'SupplierName', 'Phone', 'Address', 'ContactPerson', 'Status', 'CreatedAt'] },
  PURCHASE: { sheet: SHEET.PURCHASE, primaryKey: 'PurchaseNo', prefix: 'PUR', columns: ['PurchaseNo', 'PurchaseDate', 'SupplierID', 'Branch', 'ItemCode', 'Quantity', 'UnitCost', 'TotalCost', 'Status', 'Notes', 'CreatedAt'] },
  LOG: { sheet: SHEET.LOG, primaryKey: 'LogID', prefix: 'LOG', columns: ['LogID', 'LogDate', 'User', 'Action', 'Entity', 'EntityID', 'Details'] }
});
