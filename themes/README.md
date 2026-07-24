# Bookshelf theme art — drop-in backdrops (no designer needed)

## Generated v1 world

The first immersive world is now included at:

`themes/moonlit-reading-room/room-v1.jpg`

It is used directly by the Moonlit Reading Room in the zoomed shelf view. The
older theme-art switch below still controls the full-bookcase backdrop system
and does not need to be enabled for this new world.

Its interactive add-ons use optimized transparent artwork at:

- `themes/moonlit-reading-room/addons/clock-v3.png`
- `themes/moonlit-reading-room/addons/candle-v4.png`
- `themes/moonlit-reading-room/addons/fairies-v3.png`

The bookcase, shelves, books, brass plates and lighting are all drawn in code.
What turns it from "nice UI" into a **wallpaper-worthy scene** is one background
image per theme: the *room* the bookcase stands in. The code is already wired
for it — you just add the images and flip one switch.

## How to add art (≈10 minutes, free)

1. Generate one image per theme in any AI image tool (Midjourney, DALL·E,
   Bing Image Creator (free), Leonardo, Krea, etc.) using the prompts below.
2. Size **tall/portrait**, about **1080 × 2160** (phone wallpaper shape).
   Export as JPG and compress to **under ~400 KB** (e.g. squoosh.app) — the
   site sends `no-cache`, so every visit re-downloads it.
3. Save each as `room.jpg` in its theme folder:
   ```
   themes/walnut/room.jpg
   themes/noir/room.jpg
   themes/faerie/room.jpg
   themes/academia/room.jpg
   themes/boudoir/room.jpg
   ```
4. In `smuthub-bookcase.html`, change `const THEME_ART=false;` to `true`.
5. Commit + push. Cloudflare auto-deploys; the bookcase now stands in your art.

Until you do this, the page uses the built-in CSS gradients (and makes **no**
requests for missing images). You can add themes one at a time.

## Composition tip
The wooden cabinet sits **centered, ~560px wide**, in front of this image, so
the art's **top, bottom and side edges** show most. Ask for an atmospheric room
with the **center vertical band kept simple/empty** (no competing furniture
dead-center). In the zoomed shelf view the image is full-bleed behind one shelf.

## Prompts (tweak freely)

**Walnut (free):**
> Cozy antique private library at golden hour, warm candlelight, deep mahogany
> walls, floating dust motes, soft god-rays, empty center, vertical 9:19,
> painterly, atmospheric, ultra-detailed, no text.

**Noir (free):**
> Moody noir study at night, charcoal walls, a single cold moonbeam, rain
> streaking a tall window, desaturated with one rose-pink neon accent,
> cinematic, vertical 9:19, empty center, no text.

**Faerie Court (premium):**
> Enchanted fae-court library, mossy carved stone, glowing bioluminescent vines,
> drifting fireflies, emerald and antique-gold palette, ethereal mist, magical,
> vertical 9:19, fantasy illustration, empty center, no text.

**Dark Academia (premium):**
> Dark-academia reading hall, tall arched windows with autumn light, aged
> leather and brass, lit candles, scholarly and moody, oil-painting feel,
> vertical 9:19, empty center, no text.

**Candlelit Boudoir (premium):**
> Candlelit boudoir reading nook, deep rose velvet drapery, warm low light,
> intimate and cozy, soft bokeh, painterly, vertical 9:19, empty center, no text.

> Shelf-view backdrops (Velvet / Library / Window / Night, etc.) currently use
> built-in CSS. If you later want art there too, we can extend this same
> drop-in pattern to `themes/<key>/<backdrop>.jpg`.
