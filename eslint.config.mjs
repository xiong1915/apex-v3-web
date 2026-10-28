import {defineConfig,globalIgnores} from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

// Start the new gate with the migrated runtime and its integration points.
// Existing unrelated files are not silently rewritten to establish a lint baseline.
export default defineConfig([
 ...nextVitals,
 globalIgnores(['.next/**','node_modules/**','next-env.d.ts']),
]);
