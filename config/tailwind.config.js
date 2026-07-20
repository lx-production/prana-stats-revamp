import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

/** @type {import('tailwindcss').Config} */
export default {
  // Absolute paths so content scanning works no matter where this config lives
  content: [
    path.join(root, 'index.html'),
    path.join(root, '*.{js,jsx,ts,tsx}'),
    path.join(root, 'components/**/*.{js,jsx,ts,tsx}'),
    path.join(root, 'features/**/*.{js,jsx,ts,tsx}'),
    path.join(root, 'hooks/**/*.{js,jsx,ts,tsx}'),
    path.join(root, 'pages/**/*.{js,jsx,ts,tsx}'),
    path.join(root, 'utils/**/*.{js,jsx,ts,tsx}'),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
