// Stub postgres-js for CF Workers (dns.resolve not available).
// .mjs so webpack 5 static ESM analysis sees the default export.

function stubbedSql() {
  return Object.assign(Promise.resolve([]), { end: () => Promise.resolve() });
}

export default function stubbedPostgres() {
  const sql = function(strings, ...values) { return stubbedSql(); };
  sql.end = () => Promise.resolve();
  sql.unsafe = () => stubbedSql();
  sql.begin = (fn) => fn(sql);
  sql.resolve = () => {};
  sql.options = { parsers: {} };  // drizzle-orm accesses client.options.parsers at init
  return sql;
}
