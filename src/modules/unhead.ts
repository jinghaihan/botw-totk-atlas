import type { UserModule } from '@/types'
import { createHead } from '@unhead/vue/client'
import { dataUrl } from '@/games/data-resource'
import { description, name } from '../../package.json'

export const install: UserModule = ({ app }) => {
  const head = createHead({
    init: [
      {
        title: name,
        meta: [
          {
            name: 'description',
            content: description,
          },
        ],
        link: [
          {
            rel: 'icon',
            type: 'image/svg+xml',
            href: () => dataUrl('favicon.svg?v=atlas'),
          },
        ],
      },
    ],
  })
  app.use(head)
}
