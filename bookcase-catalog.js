// smutHub bookcase product catalog.
// Checkout URLs stay null until Stripe products are created.
// The UI can preview every product without granting ownership.
window.SMUTHUB_BOOKCASE_CATALOG = {
  currency: "CAD",
  products: [
    {
      key: "world_moonlit_reading_room",
      type: "world",
      name: "Moonlit Reading Room",
      eyebrow: "Included with every bookshelf",
      description: "An arched moon window, velvet curtains, candlelight and a shelf that remembers.",
      priceCents: 0,
      badge: "FREE",
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
      priceCents: 799,
      badge: "LAUNCH",
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
      priceCents: 299,
      badge: "ADD-ON",
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
      priceCents: 299,
      badge: "ADD-ON",
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
      priceCents: 999,
      badge: "BUNDLE",
      worldKey: "boudoir",
      checkoutUrl: null,
      includes: ["Candlelit Boudoir", "Fairy Visitors", "The Witching Hour", "Founder plaque"]
    }
  ],
  releases: [
    {
      key: "world_dark_academia",
      name: "The Rainbound Archive",
      release: "August 2026",
      description: "A dark-academia library with rain on the windows and notes hidden in the margins.",
      type: "World pack",
      targetPriceCents: 699
    },
    {
      key: "world_dragons_hoard",
      name: "The Dragon’s Hoard",
      release: "Late August 2026",
      description: "A volcanic treasure room where a tiny dragon guards your five-star reads.",
      type: "World pack",
      targetPriceCents: 799
    },
    {
      key: "pack_familiar_companions",
      name: "Familiar Companions",
      release: "September 2026",
      description: "Choose a raven, fox or shadow cat that reacts when you finish a book.",
      type: "Interaction pack",
      targetPriceCents: 399
    },
    {
      key: "world_haunted_manor",
      name: "The Haunted Manor",
      release: "October 2026",
      description: "A seasonal gothic room with flickering portraits and a secret midnight visitor.",
      type: "Seasonal world",
      targetPriceCents: 899
    }
  ]
};
