// Bundles the app's real store + cloud engine for Node, with the native modules swapped for the web SDK.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const app = fileURLToPath(new URL('../../../app', import.meta.url));
await build({
  entryPoints: [`${here}device.ts`],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: `${here}out/device.mjs`,
  loader: { '.webp': 'empty', '.png': 'empty' },
  nodePaths: [`${app}/node_modules`, `${here}../node_modules`],
  alias: {
    '@/assets': `${app}/assets`,
    '@': `${app}/src`,
    '@react-native-firebase/firestore': `${here}shims/firestore.ts`,
    '@react-native-firebase/auth': `${here}shims/auth.ts`,
    '@react-native-firebase/storage': `${here}shims/storage.ts`,
    '@react-native-google-signin/google-signin': `${here}shims/google.ts`,
    'expo-image-manipulator': `${here}shims/manipulator.ts`,
    'react-native': `${here}shims/rn.ts`,
    '@react-native-async-storage/async-storage': `${here}shims/storage-async.ts`,
  },
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  logLevel: 'warning',
});
