/** Current inventory balance by branch and item. */
const StockModule = Object.freeze({
  list: function(search) {
    var keyword = String(search || '').trim().toLowerCase();
    return Database.all('STOCK').map(function(stock) {
      var item = Database.findById('ITEMS', stock.ItemCode);
      return Object.assign({}, stock, { ItemName: item ? item.ItemName : '-', Unit: item ? item.Unit : '-', LowStock: Number(stock.Quantity || 0) <= Number(stock.MinimumStock || 0) });
    }).filter(function(stock) { return !keyword || [stock.ItemCode, stock.ItemName, stock.Branch].some(function(value) { return String(value || '').toLowerCase().indexOf(keyword) >= 0; }); })
      .sort(function(a, b) { return a.LowStock === b.LowStock ? String(a.ItemName).localeCompare(String(b.ItemName)) : (a.LowStock ? -1 : 1); });
  },
  adjust: function(input) {
    input = input || {};
    var itemCode = String(input.ItemCode || '').trim(); var branch = String(input.Branch || APP.DEFAULT_BRANCH).trim(); var delta = Number(input.QuantityChange);
    if (!Database.findById('ITEMS', itemCode)) throw new Error('Item tidak ditemukan.');
    if (!isFinite(delta) || delta === 0) throw new Error('Perubahan stok tidak boleh nol.');
    var stock = Database.query('STOCK', { ItemCode: itemCode, Branch: branch })[0];
    var minimum = input.MinimumStock === '' || input.MinimumStock == null ? Number(stock ? stock.MinimumStock : 0) : Number(input.MinimumStock);
    if (!isFinite(minimum) || minimum < 0) throw new Error('Stok minimum tidak valid.');
    var quantity = Number(stock ? stock.Quantity : 0) + delta;
    if (quantity < 0) throw new Error('Stok tidak mencukupi untuk pengeluaran ini.');
    var result = stock ? Database.update('STOCK', stock.StockNo, { Quantity: quantity, MinimumStock: minimum, UpdatedAt: new Date() }) : Database.insert('STOCK', { Branch: branch, ItemCode: itemCode, Quantity: quantity, MinimumStock: minimum, UpdatedAt: new Date() });
    Logger.log('STOCK_ADJUST', 'STOCK', result.StockNo, { change: delta, quantity: quantity, itemCode: itemCode, branch: branch });
    return result;
  }
});

function stockList(search) { return StockModule.list(search); }
function stockAdjust(data) { return StockModule.adjust(data); }
