export function prepareMigrations(files, schema) {
  // Preserve checked-in history and Wrangler's original migration names.
  // Only these historically duplicated TEXT additions may be omitted.
  const repairs = {
    '0003_application_salary.sql': ['application_captures', ['salary']],
    '0004_user_analytics_metadata.sql': ['users', ['email_domain', 'email_domain_type', 'country']]
  };
  return files.map(file => {
    const repair = repairs[file.name];
    if (!repair) return {...file};
    const [table, names] = repair;
    const columns = schema[table];
    if (!Array.isArray(columns)) throw new Error(`Missing schema for ${table}`);
    let sql = file.sql;
    for (const name of names) {
      const column = columns.find(column => column.name === name);
      if (column && column.type.toUpperCase() !== 'TEXT') throw new Error(`Unexpected type for ${table}.${name}`);
      // A missing table is created by the unchanged 0001/0002 baseline,
      // which already includes these columns. Existing old schemas still need ADD.
      if (column || columns.length === 0) {
        sql = sql.replace(new RegExp(`ALTER TABLE ${table} ADD COLUMN ${name} TEXT;`, 'g'), `-- ${table}.${name} already supplied by baseline/schema.`);
      }
    }
    if (!sql.replace(/--[^\n]*/g, '').trim()) sql += '\nSELECT 1;\n';
    return {...file, sql};
  });
}
