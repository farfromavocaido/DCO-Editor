// Run through the same tsx CLI as export-client-preview-site.ts. Keeping this
// as a TypeScript entry avoids Node-version-dependent ESM named-export detection
// for a TS module compiled as CommonJS in this package.
import {layoutSequencePlansSource} from '../../lib/layout-transitions';
process.stdout.write(layoutSequencePlansSource());
