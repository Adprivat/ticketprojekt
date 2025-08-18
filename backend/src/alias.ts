import moduleAlias from 'module-alias';
import path from 'path';

// When compiled, this file becomes dist/alias.js. Map '@' to the dist root.
const distRoot = __dirname; // e.g., /app/backend/dist
moduleAlias.addAliases({
  '@': distRoot,
});
