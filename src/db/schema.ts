import { pgTable, text, integer, boolean, timestamp, unique, index } from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { user } from './auth-schema'

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

export const cartItems = pgTable(
  'cart_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
  },
  // addToCart upserts through this constraint (SPEC 5.1).
  (t) => [unique('uq_cart_item').on(t.userId, t.productId)],
)

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
  },
  // toggleWishlist does delete-or-insert against this constraint (SPEC 3.5).
  (t) => [unique('uq_wishlist_item').on(t.userId, t.productId)],
)
