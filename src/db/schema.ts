import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'

export const categories = pgTable('categories', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
})

export const products = pgTable(
  'products',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'), // TipTap HTML
    price: integer('price').notNull(), // JPY, no minor unit — never a float
    stock: integer('stock').notNull().default(0),
    imageUrl: text('image_url'),
    isPublished: boolean('is_published').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_product_category').on(t.categoryId),
    index('idx_product_published').on(t.isPublished),
  ],
)
