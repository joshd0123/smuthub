# Living Relic System

Premium bookshelf art should behave like a collectible object, not a looping
background video. Each relic or world can share one production contract:

1. **Hero still** — the authoritative, responsive artwork and reduced-motion
   fallback. Keep personalization and meaningful text out of the bitmap.
2. **Depth layers** — two to five transparent foreground assets for parallax,
   light response, and pointer/touch interaction.
3. **Cinematic loop** — an optional six-to-ten-second source clip generated from
   the hero still, edited into a seamless, low-motion WebM/MP4 enhancement.
4. **Masks** — luminance or alpha masks for windows, gems, candlelight, fog,
   curtains, and objects that must react independently.
5. **Interaction timeline** — deterministic states such as idle, hover, tap,
   discovered, and reduced-motion. Generated video never owns navigation or
   important state.

## Video-generation workflow

Use image-to-video from the approved hero still so the identity does not drift.
Prompt for a static camera and one or two localized motions: a ruby breathing
with light, moonlight passing over metal, petals stirring, or mist moving behind
tracery. Export the strongest clip, trim it into a loop, and compress it for the
web. The live page must retain the still and CSS/canvas layers when video is
disabled, slow to load, or covered by `prefers-reduced-motion`.

## Performance guardrails

- Load cinematic media only after the hero still and core bookshelf are ready.
- Use one active loop per viewport; pause it when offscreen or the tab is hidden.
- Ship responsive poster frames and a mobile bitrate, not one desktop master.
- Never bake reader names, book metadata, badges, prices, or founder numbers into
  generated media.
- Treat audio as explicitly user-initiated and optional.

The Founder’s Key v5 is the first implementation: a transparent hero frame, a
separate ruby-heart depth plane, a live name, and an integrated live number
socket. Future rooms can extend the same contract without replacing the UI.
