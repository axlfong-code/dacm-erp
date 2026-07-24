/** Supplier master data for inventory purchasing. */
const SupplierModule = Object.freeze({
  list: function(search) {
    var keyword = String(search || '').trim().toLowerCase();
    return Database.all('SUPPLIERS').filter(function(supplier) {
      return !keyword || [supplier.SupplierID, supplier.SupplierName, supplier.Phone, supplier.ContactPerson].some(function(value) {
        return String(value || '').toLowerCase().indexOf(keyword) >= 0;
      });
    }).sort(function(a, b) { return String(a.SupplierName).localeCompare(String(b.SupplierName)); });
  },
  save: function(input) {
    input = input || {};
    var data = {
      SupplierName: String(input.SupplierName || '').trim(),
      Phone: String(input.Phone || '').trim(),
      Address: String(input.Address || '').trim(),
      ContactPerson: String(input.ContactPerson || '').trim(),
      Status: String(input.Status || 'ACTIVE').trim()
    };
    Utils.require(data.SupplierName, 'Nama supplier wajib diisi.');
    return input.SupplierID ? Database.update('SUPPLIERS', input.SupplierID, data) : Database.insert('SUPPLIERS', data);
  },
  get: function(supplierId) { return Database.findById('SUPPLIERS', supplierId); }
});

function supplierList(search) { return SupplierModule.list(search); }
function supplierSave(data) { return SupplierModule.save(data); }
function supplierGet(supplierId) { return SupplierModule.get(supplierId); }
