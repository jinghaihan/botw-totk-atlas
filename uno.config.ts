import { createLocalFontProcessor } from '@unocss/preset-web-fonts/local'
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetWind4,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import { categoryIconClasses, explorationIcons } from './src/games/category-icons'

export default defineConfig({
  safelist: categoryIconClasses,
  shortcuts: [
    ['flex-center', 'flex items-center justify-center'],
    ['flex-col-center', 'flex flex-col items-center justify-center'],
  ],
  presets: [
    presetWind4(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      collections: { hyrule: () => explorationIcons },
    }),
    presetTypography(),
    presetWebFonts({
      fonts: {
        sans: 'Geist',
        serif: 'Geist',
        mono: 'Geist Mono',
      },
      processors: createLocalFontProcessor(),
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
})
