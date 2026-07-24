/** Customer master-data service and web-app endpoints. */
const CustomerModule = Object.freeze({
  list: function(search) {
    var options = typeof search === 'object' && search !== null ? search : { search: search };
    var keyword = String(options.search || '').trim().toLowerCase();
    var nonActive = String(options.nonActive || 'ALL').trim().toUpperCase();
    var category = String(options.category || '').trim().toLowerCase();
    return Database.all('CUSTOMERS').filter(function(customer) {
      var statusText = String(customer.Status || customer.NonActive || 'ACTIVE').trim().toUpperCase();
      var isInactive = statusText === 'INACTIVE' || statusText === 'NONACTIVE' || statusText === 'NON AKTIF' || statusText === 'YA' || statusText === 'YES' || statusText === 'TRUE';
      if (nonActive === 'YES' && !isInactive) return false;
      if (nonActive === 'NO' && isInactive) return false;
      if (category) {
        var categoryText = [customer.Category || 'Umum', customer.CustomerCategory, customer.Address, customer.CustomerName]
          .map(function(value) { return String(value || '').toLowerCase(); }).join(' ');
        if (categoryText.indexOf(category) < 0) return false;
      }
      if (!keyword) return true;
      return [customer.CustomerID, customer.CustomerName, customer.Phone, customer.WhatsApp]
        .some(function(value) { return String(value || '').toLowerCase().indexOf(keyword) >= 0; });
    }).sort(function(a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); });
  },
  save: function(input) {
    input = input || {};
    var data = { CustomerName: String(input.CustomerName || '').trim(), Phone: String(input.Phone || '').trim(), WhatsApp: String(input.WhatsApp || '').trim(), Address: String(input.Address || '').trim() };
    Utils.require(data.CustomerName, 'Nama pelanggan wajib diisi.');
    if (!data.Phone && !data.WhatsApp) throw new Error('Nomor telepon atau WhatsApp wajib diisi.');
    var saved = input.CustomerID ? Database.update('CUSTOMERS', input.CustomerID, data) : Database.insert('CUSTOMERS', data);
    return {
      CustomerID: saved.CustomerID,
      CustomerName: saved.CustomerName,
      Phone: saved.Phone,
      WhatsApp: saved.WhatsApp,
      Address: saved.Address
    };
  },
  get: function(customerId) { return Database.findById('CUSTOMERS', customerId); },
  remove: function(customerId) {
    Utils.require(customerId, 'ID pelanggan wajib diisi.');
    var customer = Database.findById('CUSTOMERS', customerId);
    if (!customer) throw new Error('Pelanggan tidak ditemukan.');
    if (Database.query('VEHICLES', { CustomerID: customerId }).length) {
      throw new Error('Pelanggan masih memiliki data kendaraan. Hapus/pindahkan kendaraan terlebih dahulu.');
    }
    if (Database.query('WORKORDER', { CustomerID: customerId }).length) {
      throw new Error('Pelanggan masih memiliki Work Order. Pelanggan tidak bisa dihapus.');
    }
    Database.remove('CUSTOMERS', customerId);
    return { success: true, CustomerID: customerId };
  }
});

function customerList(search) { return CustomerModule.list(search); }
function customerSave(data) { return CustomerModule.save(data); }
function customerGet(customerId) { return CustomerModule.get(customerId); }
function customerDelete(customerId) { return CustomerModule.remove(customerId); }
