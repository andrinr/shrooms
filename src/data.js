/* Species profiles shared by browser and API. See CONTRIBUTING.md.
   Numeric preferences are provisional hypotheses, not fitted probabilities. */
window.SHROOMS_SPECIES = {
  "porcini": {
    "name": "Porcini",
    "local": "Steinpilz",
    "latin": "Boletus edulis",
    "months": [
      7,
      8,
      9,
      10
    ],
    "temp": [
      9,
      19
    ],
    "host": {
      "beech": 1,
      "oak": 0.75,
      "conifer": 0.9,
      "other": 0.5
    },
    "canopy": "closed",
    "note": "Tree partners, a sheltered canopy and moisture after rain.",
    "sources": [
      {
        "title": "First Nature — Boletus edulis",
        "url": "https://www.first-nature.com/fungi/boletus-edulis.php"
      }
    ],
    "unmapped": [
      "Soil chemistry"
    ]
  },
  "chanterelle": {
    "name": "Chanterelle",
    "local": "Eierschwamm",
    "latin": "Cantharellus cibarius",
    "months": [
      6,
      7,
      8,
      9,
      10
    ],
    "temp": [
      11,
      21
    ],
    "host": {
      "beech": 0.85,
      "oak": 1,
      "conifer": 0.8,
      "other": 0.6
    },
    "canopy": "closed",
    "note": "Broadleaf or mixed forest. Soil acidity is not yet included.",
    "sources": [
      {
        "title": "First Nature — Cantharellus cibarius",
        "url": "https://www.first-nature.com/fungi/cantharellus-cibarius.php"
      }
    ],
    "unmapped": [
      "Soil chemistry"
    ]
  },
  "horn": {
    "name": "Horn of plenty",
    "local": "Totentrompete",
    "latin": "Craterellus cornucopioides",
    "months": [
      8,
      9,
      10,
      11
    ],
    "temp": [
      8,
      18
    ],
    "host": {
      "beech": 1,
      "oak": 0.95,
      "conifer": 0.15,
      "other": 0.5
    },
    "canopy": "closed",
    "note": "A preference for broadleaf woods, especially beech and oak.",
    "sources": [
      {
        "title": "First Nature — Craterellus cornucopioides",
        "url": "https://www.first-nature.com/fungi/craterellus-cornucopioides.php"
      }
    ],
    "unmapped": [
      "Soil chemistry"
    ]
  },
  "parasol": {
    "name": "Parasol",
    "local": "Riesenschirmling",
    "latin": "Macrolepiota procera",
    "months": [
      7,
      8,
      9,
      10,
      11
    ],
    "temp": [
      11,
      22
    ],
    "host": null,
    "canopy": "open",
    "note": "More open canopy and forest edges. Open grassland is outside this forest map.",
    "sources": [
      {
        "title": "First Nature — Macrolepiota procera",
        "url": "https://www.first-nature.com/fungi/macrolepiota-procera.php"
      }
    ],
    "unmapped": [
      "Open grassland"
    ]
  },
  "bay": {
    "name": "Bay bolete",
    "local": "Maronenröhrling",
    "latin": "Imleria badia",
    "months": [
      7,
      8,
      9,
      10,
      11
    ],
    "temp": [
      8,
      18
    ],
    "host": {
      "beech": 0.7,
      "oak": 0.6,
      "conifer": 1,
      "other": 0.4
    },
    "canopy": "closed",
    "note": "Conifer and mixed woodland. Acidic soil preference is not yet mapped.",
    "sources": [
      {
        "title": "First Nature — Imleria badia",
        "url": "https://www.first-nature.com/fungi/imleria-badia.php"
      }
    ],
    "unmapped": [
      "Soil chemistry"
    ]
  },
  "hedgehog": {
    "name": "Wood hedgehog",
    "local": "Semmelstoppelpilz",
    "latin": "Hydnum repandum",
    "months": [
      8,
      9,
      10,
      11
    ],
    "temp": [
      7,
      17
    ],
    "host": {
      "beech": 1,
      "oak": 0.8,
      "conifer": 0.85,
      "other": 0.7
    },
    "canopy": "closed",
    "note": "Damp broadleaf and mixed woods; moss and leaf litter are not yet mapped.",
    "sources": [
      {
        "title": "First Nature — Hydnum repandum",
        "url": "https://www.first-nature.com/fungi/hydnum-repandum.php"
      }
    ],
    "unmapped": [
      "Moss cover",
      "Leaf litter"
    ]
  },
  "saffron": {
    "name": "Saffron milkcap",
    "local": "Echter Reizker",
    "latin": "Lactarius deliciosus",
    "months": [
      8,
      9,
      10,
      11
    ],
    "temp": [
      8,
      18
    ],
    "host": {
      "beech": 0.05,
      "oak": 0.05,
      "conifer": 0.05,
      "other": 0.05
    },
    "requiredTree": "pine",
    "canopy": "open",
    "note": "Pine partner: uses mapped pine share, not general conifer cover. Soil chemistry is not yet included.",
    "sources": [
      {
        "title": "First Nature — Lactarius deliciosus",
        "url": "https://www.first-nature.com/fungi/lactarius-deliciosus.php"
      }
    ],
    "unmapped": [
      "Soil chemistry"
    ]
  },
  "winter": {
    "name": "Winter chanterelle",
    "local": "Trompetenpfifferling",
    "latin": "Craterellus tubaeformis",
    "months": [
      9,
      10,
      11
    ],
    "temp": [
      5,
      15
    ],
    "host": {
      "beech": 0.5,
      "oak": 0.4,
      "conifer": 1,
      "other": 0.4
    },
    "canopy": "closed",
    "note": "Late-season conifer woodland. Moss and acidic soil are not mapped; the canopy preference is provisional.",
    "unmapped": [
      "Moss cover",
      "Soil acidity"
    ],
    "sources": [
      {
        "title": "First Nature — Cantharellus tubaeformis (synonym)",
        "url": "https://www.first-nature.com/fungi/cantharellus-tubaeformis.php"
      }
    ]
  },
  "slippery": {
    "name": "Slippery jack",
    "local": "Butterpilz",
    "latin": "Suillus luteus",
    "months": [
      7,
      8,
      9,
      10,
      11
    ],
    "temp": [
      8,
      18
    ],
    "host": {
      "beech": 0,
      "oak": 0,
      "conifer": 1,
      "other": 0
    },
    "requiredTree": "pine",
    "canopy": "open",
    "note": "Pine-associated woodland. Uses mapped pine share where available; soil chemistry and tree age are not mapped.",
    "unmapped": [
      "Soil chemistry",
      "Tree age"
    ],
    "sources": [
      {
        "title": "First Nature — Suillus luteus",
        "url": "https://www.first-nature.com/fungi/suillus-luteus.php"
      }
    ]
  },
  "spruce_milkcap": {
    "name": "Spruce milkcap",
    "local": "Fichtenreizker",
    "latin": "Lactarius deterrimus",
    "months": [
      7,
      8,
      9,
      10,
      11
    ],
    "temp": [
      8,
      18
    ],
    "host": {
      "beech": 0,
      "oak": 0,
      "conifer": 1,
      "other": 0
    },
    "requiredTree": "spruce",
    "canopy": "closed",
    "note": "Spruce partner: uses mapped spruce share, not general conifer cover. Soil chemistry is not mapped.",
    "unmapped": [
      "Soil chemistry"
    ],
    "sources": [
      {
        "title": "NDFF — Lactarius deterrimus",
        "url": "https://www.verspreidingsatlas.nl/0069170"
      }
    ]
  },
  "charcoal": {
    "name": "Charcoal burner",
    "local": "Frauentäubling",
    "latin": "Russula cyanoxantha",
    "months": [
      7,
      8,
      9,
      10
    ],
    "temp": [
      10,
      20
    ],
    "host": {
      "beech": 1,
      "oak": 0.95,
      "conifer": 0.25,
      "other": 0.65
    },
    "canopy": "closed",
    "note": "Broadleaf woodland, particularly beech and oak. Soil chemistry and leaf litter are not mapped.",
    "unmapped": [
      "Soil chemistry",
      "Leaf litter"
    ],
    "sources": [
      {
        "title": "NDFF — Russula cyanoxantha habitat observations",
        "url": "https://www.verspreidingsatlas.nl/biodiversiteit/habitat-distribution.aspx?soortnummer=10126300"
      },
      {
        "title": "First Nature — Russula cyanoxantha",
        "url": "https://www.first-nature.com/fungi/russula-cyanoxantha.php"
      }
    ]
  }
};
