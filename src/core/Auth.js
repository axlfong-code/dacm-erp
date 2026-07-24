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
