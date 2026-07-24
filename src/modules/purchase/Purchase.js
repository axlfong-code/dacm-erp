function parsePurchaseDate(value) {
  var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Tanggal pembelian wajib diisi.');
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Purchase receipts that add inventory stock. */
const PurchaseModule = Object.freeze({
  list: function(search) {
    var keyword = String(search || '').trim().toLowerCase();
    return Database.all('PURCHASE').map(function(purchase) {
      var supplier = Database.findById('SUPPLIERS', purchase.SupplierID);
      var item = Database.findById('ITEMS', purchase.ItemCode);
      return Object.assign({}, purchase, {
        SupplierName: supplier ? supplier.SupplierName : '-',
        ItemName: item ? item.ItemName : '-',
        Unit: item ? item.Unit : '',
        PurchaseDateText: Utils.formatDate(purchase.PurchaseDate, APP.DATE_FORMAT)
      });
    }).filter(function(purchase) {
      return !keyword || [purchase.PurchaseNo, purchase.SupplierName, purchase.ItemName, purchase.Status].some(function(value) {
        return String(value || '').toLowerCase().indexOf(keyword) >= 0;
      });
    }).sort(function(a, b) { return String(b.PurchaseNo).localeCompare(String(a.PurchaseNo)); });
  },
  formOptions: function() {
    return { suppliers: SupplierModule.list(''), items: ItemModule.list('') };
  },
  receive: function(input) {
    input = input || {};
    var supplierId = String(input.SupplierID || '').trim();
    var itemCode = String(input.ItemCode || '').trim();
    var branch = String(input.Branch || APP.DEFAULT_BRANCH).trim();
    var quantity = Number(input.Quantity);
    var unitCost = Number(input.UnitCost || 0);
    if (!Database.findById('SUPPLIERS', supplierId)) throw new Error('Supplier tidak ditemukan.');
    if (!Database.findById('ITEMS', itemCode)) throw new Error('Item tidak ditemukan.');
    if (!isFinite(quantity) || quantity <= 0) throw new Error('Jumlah pembelian harus lebih besar dari nol.');
    if (!isFinite(unitCost) || unitCost < 0) throw new Error('Harga beli tidak valid.');
    var purchase = Database.insert('PURCHASE', {
      PurchaseDate: parsePurchaseDate(input.PurchaseDate),
      SupplierID: supplierId,
      Branch: branch,
      ItemCode: itemCode,
      Quantity: quantity,
      UnitCost: unitCost,
      TotalCost: quantity * unitCost,
      Status: 'RECEIVED',
      Notes: String(input.Notes || '').trim()
    });
    StockModule.adjust({ ItemCode: itemCode, Branch: branch, QuantityChange: quantity, MinimumStock: input.MinimumStock || 0 });
    Logger.log('PURCHASE_RECEIVE', 'PURCHASE', purchase.PurchaseNo, { itemCode: itemCode, quantity: quantity, branch: branch });
    return purchase;
  }
});

function purchaseList(search) { return PurchaseModule.list(search); }
function purchaseFormOptions() { return PurchaseModule.formOptions(); }
function purchaseReceive(data) { return PurchaseModule.receive(data); }
