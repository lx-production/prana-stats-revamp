import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
  plugins: [
    // Point Tailwind at the sibling config now that PostCSS lives under config/
    tailwindcss({ config: path.join(__dirname, 'tailwind.config.js') }),
    autoprefixer(),
  ],
}
