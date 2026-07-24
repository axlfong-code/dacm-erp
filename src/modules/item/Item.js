/** Item/service-part master data. */
const ItemModule = Object.freeze({
  list: function(search) {
    var options = typeof search === 'object' && search !== null ? search : { search: search };
    var keyword = String(options.search || '').trim().toLowerCase();
    var category = String(options.category || '').trim().toLowerCase();
    var type = String(options.type || '').trim().toUpperCase();
    var status = String(options.status || '').trim().toUpperCase();
    var stocks = Database.all('STOCK');
    return Database.all('ITEMS').map(function(item) {
      var quantity = stocks.filter(function(stock) { return String(stock.ItemCode) === String(item.ItemCode); })
        .reduce(function(total, stock) { return total + Number(stock.Quantity || 0); }, 0);
      return Object.assign({}, item, { Quantity: quantity, SellableStock: Math.max(0, quantity), ItemTypeLabel: itemTypeLabel(item.Category) });
    }).filter(function(item) {
      if (category && String(item.Category || '').toLowerCase().indexOf(category) < 0) return false;
      if (type && String(item.Category || '').toUpperCase() !== type) return false;
      if (status && String(item.Status || '').toUpperCase() !== status) return false;
      return !keyword || [item.ItemCode, item.ItemName, item.Category, item.Unit, item.Status].some(function(value) { return String(value || '').toLowerCase().indexOf(keyword) >= 0; });
    }).sort(function(a, b) { return String(a.ItemName).localeCompare(String(b.ItemName)); });
  },
  save: function(input) {
    input = input || {};
    var price = Number(input.SellingPrice || 0);
    if (!isFinite(price) || price < 0) throw new Error('Harga jual tidak valid.');
    var data = { ItemName: String(input.ItemName || '').trim(), Category: String(input.Category || '').trim(), Unit: String(input.Unit || '').trim(), SellingPrice: price, Status: String(input.Status || 'ACTIVE').trim() };
    Utils.require(data.ItemName, 'Nama item wajib diisi.'); Utils.require(data.Unit, 'Satuan wajib diisi.');
    if (input.ItemCode) return Database.update('ITEMS', input.ItemCode, data);
    var manualCode = String(input.ManualItemCode || '').trim().toUpperCase();
    if (String(input.CodeMode || '').toUpperCase() === 'MANUAL') {
      Utils.require(manualCode, 'Kode barang manual wajib diisi.');
      if (Database.findById('ITEMS', manualCode)) throw new Error('Kode barang sudah terdaftar: ' + manualCode);
      return Database.insert('ITEMS', data, manualCode);
    }
    return Database.insert('ITEMS', data);
  },
  get: function(itemCode) { return Database.findById('ITEMS', itemCode); }
});

function itemList(search) { return ItemModule.list(search); }
function itemSave(data) { return ItemModule.save(data); }
function itemGet(itemCode) { return ItemModule.get(itemCode); }

function itemTypeLabel(value) {
  value = String(value || '').toUpperCase();
  if (value === 'INVENTORY') return 'Persediaan';
  if (value === 'NON_INVENTORY') return 'Non Persediaan';
  if (value === 'JASA') return 'Jasa';
  return value || 'Umum';
}
