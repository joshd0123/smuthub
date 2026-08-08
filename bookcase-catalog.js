// smutHub bookcase product catalog.
// Checkout URLs stay null until Stripe products are created.
// Only products marked live can be previewed; a preview never grants ownership.
window.SMUTHUB_BOOKCASE_CATALOG = {
  currency: "CAD",
  foundersKey: {
    status: "gated",
    priceCents: 2900,
    capacity: 100,
    remaining: null,
    // Model (revised 2026-08-07): 8 immersive worlds free in year one, then
    // founder pricing on every release after. All bookcase customization is
    // free for everyone. Supersedes the old "every world, current and future".
    promise: "Eight immersive worlds free in your first year, then founder pricing for life.",
    foundersFreeWorlds: 8,
    liveProofProductKey: "world_moonlit_reading_room"
  },
  products: [
    {
      key: "world_moonlit_reading_room",
      type: "world",
      name: "Moonlit Reading Room",
      eyebrow: "The live Founder’s Key proof",
      description: "A finished premium world with an arched moon window, responsive clock, candlelight, fairy visitors and a shelf that remembers.",
      // Preview free (logged-out); full entry is a one-time $4.99 unlock (intro
      // loss-leader) or free with the Founder's Key. Set 2026-08-07.
      priceCents: 499,
      introDiscount: true,
      badge: "LIVE · $4.99",
      availability: "live",
      includedWithFoundersKey: true,
      worldKey: "moonlit",
      checkoutUrl: null,
      includes: ["Moonlit room", "Reading candle", "Memory book", "Ambient clock"]
    },
    {
      key: "world_candlelit_boudoir",
      type: "world",
      name: "Candlelit Boudoir",
      eyebrow: "Launch world",
      description: "Deep rose velvet, warm brass and a private midnight reading retreat.",
      priceCents: null,
      badge: "IN DEVELOPMENT",
      availability: "coming_soon",
      includedWithFoundersKey: true,
      worldKey: "boudoir",
      checkoutUrl: null,
      includes: ["Boudoir room", "Velvet shelf", "Golden-hour lighting", "6 matching props"]
    },
    {
      key: "pack_fairy_visitors",
      type: "interaction",
      name: "Fairy Visitors",
      eyebrow: "Interactive add-on",
      description: "Call a trio of fairies into the room and discover the bookmark they leave behind.",
      priceCents: null,
      badge: "LIVE IN MOONLIT",
      availability: "live",
      includedWithFoundersKey: true,
      interactionKey: "fairies",
      checkoutUrl: null,
      includes: ["3 fairies", "Fairy lantern", "Hidden bookmark interaction"]
    },
    {
      key: "pack_witching_hour",
      type: "interaction",
      name: "The Witching Hour",
      eyebrow: "Interactive add-on",
      description: "A working grandfather clock that moves your shelf from midnight to dawn.",
      priceCents: null,
      badge: "LIVE IN MOONLIT",
      availability: "live",
      includedWithFoundersKey: true,
      interactionKey: "clock",
      checkoutUrl: null,
      includes: ["Animated clock", "3 time states", "Midnight and dawn lighting"]
    },
    {
      key: "bundle_founders_sanctuary",
      type: "bundle",
      name: "Founder’s Sanctuary",
      eyebrow: "Best launch value",
      description: "The complete launch collection for readers who want the whole room on day one.",
      priceCents: null,
      badge: "FOUNDER EXCLUSIVE",
      availability: "coming_soon",
      includedWithFoundersKey: true,
      worldKey: "boudoir",
      checkoutUrl: null,
      includes: ["Candlelit Boudoir", "Fairy Visitors", "The Witching Hour", "Founder plaque"]
    }
  ],
  releases: [
    {
      key: "world_dark_academia",
      name: "The Rainbound Archive",
      release: "Up next",
      description: "A dark-academia library with rain on the windows and notes hidden in the margins.",
      type: "World pack",
      includedWithFoundersKey: true
    },
    {
      key: "world_dragons_hoard",
      name: "The Dragon’s Hoard",
      release: "Planned",
      description: "A volcanic treasure room where a tiny dragon guards your five-star reads.",
      type: "World pack",
      includedWithFoundersKey: true
    },
    {
      key: "pack_familiar_companions",
      name: "Familiar Companions",
      release: "Planned",
      description: "Choose a raven, fox or shadow cat that reacts when you finish a book.",
      type: "Interaction pack",
      includedWithFoundersKey: true
    },
    {
      key: "world_haunted_manor",
      name: "The Haunted Manor",
      release: "Seasonal concept",
      description: "A seasonal gothic room with flickering portraits and a secret midnight visitor.",
      type: "Seasonal world",
      includedWithFoundersKey: true
    }
  ]
};
