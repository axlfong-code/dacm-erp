/** Basic credential lookup. Password hashing should be added before production deployment. */
const Auth = Object.freeze({
  login: function(username, password) {
    Utils.require(username, 'Username wajib diisi.');
    Utils.require(password, 'Password wajib diisi.');
    username = String(username || '').trim();
    password = String(password || '').trim();
    var user = Database.all('USERS', { noCache: true }).filter(function(record) {
      return String(record.Username || '').trim().toLowerCase() === username.toLowerCase()
        && String(record.Password || '').trim() === password
        && String(record.Status || '').trim() === 'ACTIVE';
    })[0];
    if (!user) throw new Error('Username atau password tidak valid.');
    return Object.assign({}, user, { FullName: user.FullName || user.Username, Password: undefined });
  },
  hasRole: function(user, roles) {
    return (Array.isArray(roles) ? roles : [roles]).indexOf(user.Role) >= 0;
  }
});

function sanitizeUser_(user) {
  if (!user) return null;
  var copy = Object.assign({}, user);
  delete copy.Password;
  return copy;
}

function userList(search) {
  var keyword = String(search || '').trim().toLowerCase();
  return Database.all('USERS', { noCache: true }).filter(function(user) {
    return !keyword || [user.UserID, user.Username, user.FullName, user.Role, user.Branch, user.Status].some(function(value) {
      return String(value || '').toLowerCase().indexOf(keyword) >= 0;
    });
  }).map(sanitizeUser_).sort(function(a, b) {
    return String(a.FullName || a.Username).localeCompare(String(b.FullName || b.Username));
  });
}

function userGet(userId) {
  return sanitizeUser_(Database.findById('USERS', userId));
}

function userSave(input) {
  input = input || {};
  var username = String(input.Username || '').trim();
  var password = String(input.Password || '').trim();
  var data = {
    Username: username,
    FullName: String(input.FullName || '').trim(),
    Role: String(input.Role || 'USER').trim().toUpperCase(),
    Branch: String(input.Branch || 'D').trim().toUpperCase(),
    Status: String(input.Status || 'ACTIVE').trim().toUpperCase()
  };
  Utils.require(username, 'Username wajib diisi.');
  Utils.require(data.FullName, 'Nama user wajib diisi.');
  var duplicate = Database.all('USERS', { noCache: true }).filter(function(user) {
    return String(user.Username || '').trim().toLowerCase() === username.toLowerCase()
      && String(user.UserID || '') !== String(input.UserID || '');
  })[0];
  if (duplicate) throw new Error('Username sudah digunakan.');
  if (input.UserID) {
    if (password) data.Password = password;
    return sanitizeUser_(Database.update('USERS', input.UserID, data));
  }
  Utils.require(password, 'Password wajib diisi untuk user baru.');
  data.Password = password;
  data.CreatedAt = new Date();
  return sanitizeUser_(Database.insert('USERS', data));
}
