// Stub postgres-js for CF Workers (dns.resolve not available).
// Returns a no-op SQL client so drizzle can init without crashing.
// Any actual query will fail at runtime (only /api/telemetry uses this).

function stubbedSql() {
  return Object.assign(Promise.resolve([]), { end: () => Promise.resolve() });
}

function stubbedPostgres() {
  const sql = function(strings, ...values) { return stubbedSql(); };
  sql.end = () => Promise.resolve();
  sql.unsafe = () => stubbedSql();
  sql.begin = (fn) => fn(sql);
  sql.resolve = () => {};
  return sql;
}

stubbedPostgres.default = stubbedPostgres;
module.exports = stubbedPostgres;
module.exports.default = stubbedPostgres;
