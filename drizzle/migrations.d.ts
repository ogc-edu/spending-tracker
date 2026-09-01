/**
 * Type declaration for the drizzle-kit generated migration bundle
 * (drizzle/migrations.js). Declared here so tsc never parses migrations.js —
 * its `import m0000 from './0000_*.sql'` statements are inlined by
 * babel-plugin-inline-import at build time and are not resolvable by tsc.
 * Mirrors `MigrationConfig` in drizzle-orm/expo-sqlite/migrator.
 */
declare const migrations: {
  journal: {
    entries: {
      idx: number;
      version: string;
      when: number;
      tag: string;
      breakpoints: boolean;
    }[];
  };
  migrations: Record<string, string>;
};

export default migrations;
