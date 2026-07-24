/** Vehicle master-data service and web-app endpoints. */
const VehicleModule = Object.freeze({
  list: function(search) {
    var options = typeof search === 'object' && search !== null ? search : { search: search };
    var keyword = String(options.search || '').trim().toLowerCase();
    var customerId = String(options.customerId || '').trim();
    var brand = String(options.brand || '').trim().toLowerCase();
    return Database.all('VEHICLES').filter(function(vehicle) {
      if (customerId && String(vehicle.CustomerID) !== customerId) return false;
      if (brand && String(vehicle.Brand || '').trim().toLowerCase() !== brand) return false;
      if (!keyword) return true;
      return [vehicle.VehicleID, vehicle.PlateNumber, vehicle.Brand, vehicle.Model, vehicle.Year, vehicle.Color].some(function(value) { return String(value || '').toLowerCase().indexOf(keyword) >= 0; });
    }).map(function(vehicle) {
      var customer = Database.findById('CUSTOMERS', vehicle.CustomerID);
      return Object.assign({}, vehicle, { CustomerName: customer ? customer.CustomerName : '-' });
    }).sort(function(a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); });
  },
  save: function(input) {
    input = input || {};
    var data = { CustomerID: String(input.CustomerID || '').trim(), PlateNumber: String(input.PlateNumber || '').toUpperCase().replace(/\s+/g, ' ').trim(), Brand: String(input.Brand || '').trim(), Model: String(input.Model || '').trim(), Year: String(input.Year || '').trim(), Color: String(input.Color || '').trim(), EngineNo: String(input.EngineNo || '').trim(), ChassisNo: String(input.ChassisNo || '').trim(), LastKM: Number(input.LastKM || 0) };
    Utils.require(data.CustomerID, 'Pelanggan wajib dipilih.');
    if (!Database.findById('CUSTOMERS', data.CustomerID)) throw new Error('Pelanggan tidak ditemukan.');
    Utils.require(data.PlateNumber, 'Nomor polisi wajib diisi.'); Utils.require(data.Brand, 'Merek kendaraan wajib diisi.');
    var duplicate = Database.query('VEHICLES', { PlateNumber: data.PlateNumber })[0];
    if (duplicate && duplicate.VehicleID !== input.VehicleID) throw new Error('Nomor polisi sudah terdaftar pada kendaraan lain.');
    if (data.LastKM < 0 || isNaN(data.LastKM)) throw new Error('Kilometer terakhir tidak valid.');
    var saved = input.VehicleID ? Database.update('VEHICLES', input.VehicleID, data) : Database.insert('VEHICLES', data);
    return {
      VehicleID: saved.VehicleID,
      CustomerID: saved.CustomerID,
      PlateNumber: saved.PlateNumber,
      Brand: saved.Brand,
      Model: saved.Model,
      Year: saved.Year,
      Color: saved.Color,
      EngineNo: saved.EngineNo,
      ChassisNo: saved.ChassisNo,
      LastKM: saved.LastKM
    };
  },
  get: function(vehicleId) { return Database.findById('VEHICLES', vehicleId); },
  remove: function(vehicleId) {
    Utils.require(vehicleId, 'ID kendaraan wajib diisi.');
    var vehicle = Database.findById('VEHICLES', vehicleId);
    if (!vehicle) throw new Error('Kendaraan tidak ditemukan.');
    if (Database.query('WORKORDER', { VehicleID: vehicleId }).length) {
      throw new Error('Kendaraan masih memiliki Work Order. Kendaraan tidak bisa dihapus.');
    }
    Database.remove('VEHICLES', vehicleId);
    return { success: true, VehicleID: vehicleId };
  }
});

function vehicleList(search) { return VehicleModule.list(search); }
function vehicleSave(data) { return VehicleModule.save(data); }
function vehicleGet(vehicleId) { return VehicleModule.get(vehicleId); }
function vehicleDelete(vehicleId) { return VehicleModule.remove(vehicleId); }
