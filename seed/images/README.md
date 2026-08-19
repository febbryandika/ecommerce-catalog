# Seed product images

Drop one photo per product in this folder. `pnpm db:seed` reads the directory, uploads what it
finds to Cloudflare R2 under a stable `seed/<slug>` key, and writes the resulting public URL onto
the product row.

## Rules

- **Name the file after the product slug**, listed below. The slug is the contract — the seed
  matches on it exactly.
- **Extension** must be `.jpg`, `.jpeg`, `.png` or `.webp`. Anything else is ignored.
- **Size** 5 MB or less, matching the limit `/api/upload` enforces on admin uploads.
- **Shape** roughly square works best; the grid renders cards at a 1:1 aspect.
- **A missing file is not an error.** That product seeds with no image and is named in the
  script's summary line, so you can add it later and re-run.

## Re-running

The R2 key is derived from the slug, so the seed uploads a given photo exactly once — a second
run finds the object already there and skips it. To _replace_ a photo, delete the object from
the bucket (`seed/<slug>.<ext>`) and run the seed again; overwriting the local file alone will
not do it.

Products that already exist in the database are left alone, except that a `NULL` `image_url`
gets filled in. So seeding before R2 was configured and re-running afterwards works.

## Expected filenames

`.jpg` is shown below, but any accepted extension works.

### Audio

- `aurora-over-ear-headphones.jpg`
- `nocturne-wireless-earbuds.jpg`
- `kaze-portable-bluetooth-speaker.jpg`
- `sora-studio-monitor-pair.jpg`
- `meridian-usb-c-dac.jpg`
- `hoshi-open-back-headphones.jpg`
- `tsuki-desktop-amplifier.jpg`

### Cameras

- `lumen-m2-mirrorless-body.jpg`
- `lumen-35mm-prime-lens.jpg`
- `lumen-24-70mm-zoom-lens.jpg`
- `kiri-compact-travel-camera.jpg`
- `anchor-carbon-tripod.jpg`
- `field-camera-messenger-bag.jpg`

### Computers

- `kotori-14-ultrabook.jpg`
- `kotori-16-creator-laptop.jpg`
- `slate-pro-mechanical-keyboard.jpg`
- `slate-compact-65-keyboard.jpg`
- `orbit-vertical-mouse.jpg`
- `panorama-34-ultrawide-monitor.jpg`
- `hub-eight-port-usb-c-dock.jpg`

### Home & Kitchen

- `kettle-precision-gooseneck.jpg`
- `hikari-pour-over-coffee-set.jpg`
- `nagomi-cast-iron-skillet.jpg`
- `mori-ceramic-knife-block-set.jpg`
- `cloud-air-purifier.jpg`
- `tatami-reed-diffuser-trio.jpg`

### Wearables

- `meridian-smartwatch-series-4.jpg`
- `meridian-sport-band-pack.jpg`
- `pulse-fitness-tracker.jpg`
- `halo-sleep-ring.jpg`
- `trail-gps-running-watch.jpg`
