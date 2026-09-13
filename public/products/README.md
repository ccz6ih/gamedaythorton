# Product images

Drop shop product photos in this folder.

## Naming

Lower case, hyphens instead of spaces, punctuation dropped. The extension can be
`.jpg`, `.jpeg`, `.png`, `.webp` or `.avif`.

| Product | File |
|---|---|
| Renew Eye Complex | `renew-eye-complex.jpg` |
| Glow C+ Brightening Serum | `glow-c-brightening-serum.jpg` |
| Mandelic Resurfacing Serum 8% | `mandelic-resurfacing-serum-8.jpg` |
| H.A. Collagen Boosting Serum | `h-a-collagen-boosting-serum.jpg` |

Then run:

```
node scripts/link-product-images.cjs            # shows what it would do
node scripts/link-product-images.cjs --write    # applies it
```

It prints three lists every time: what it linked, which products still have no
image, and which files matched nothing. If a file is misnamed it appears in the
third list rather than being silently ignored.

## Size

Square, around 1000×1000. The shop crops to a square and the basket shows the
same file small, so anything much larger is bandwidth nobody uses. Under ~300 KB
each keeps the shop fast on a phone.

## A note on where these come from

These are a supplier's product photographs. Use the ones the supplier provides
for stockists — they are licensed for exactly this — rather than pulling images
off a retail site. If in doubt, ask them for the asset pack; brands with a
professional line almost always have one.
