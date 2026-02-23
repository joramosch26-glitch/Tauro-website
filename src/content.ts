export const content = {
  brand: {
    name: "Tauro Painting",
    tagline: "Luxury Finishes",
    cta: "Get a Free Estimate",
  },

  contact: {
    phone: "(XXX) XXX-XXXX",
    email: "info@tauropainting.com",
    areas: ["Utah County", "Salt Lake County", "Park City"],
  },

  hero: {
    title: "Luxury Residential & Commercial Painting in Utah",
    subtitle:
      "High-end craftsmanship, clean lines, and flawless finishes for custom homes and premium builds.",
  },

  // ✅ Ahora services es array de OBJETOS (con image/description/features)
  services: [
    {
      title: "Interior Painting",
      image: "/services/interior.jpg",
      description:
        "We transform interior spaces with impeccable finishes that elevate your home's aesthetics. We use premium low-VOC paints for a healthy environment.",
      features: ["Walls & ceilings", "Trim & moldings", "Specialty finishes", "Custom colors"],
    },
    {
      title: "Exterior Painting",
      image: "/services/exterior.jpg",
      description:
        "We protect and beautify your property's facade with durable paints designed to withstand Utah’s extreme weather conditions.",
      features: ["Residential facades", "Decks & patios", "Doors & windows", "Siding"],
    },
    {
      title: "Cabinets & Woodwork",
      image: "/services/cabinets.jpg",
      description:
        "We refinish your cabinets with factory-quality finishes that give new life to kitchens and bathrooms.",
      features: ["Kitchen cabinets", "Bathroom vanities", "Interior doors", "Moldings"],
    },
    {
      title: "Luxury Finishes",
      image: "/services/luxury.jpg",
      description:
        "Specialized decorative finishes for custom homes and high-end residential projects.",
      features: ["Venetian plaster", "Metallic finishes", "Textured walls", "Custom detailing"],
    },
  ],

 projects: [
  {
    id: "mountain-view-residence",
    image: "/interior-luxury-1.jpg",
    title: "Mountain View Residence",
    location: "Park City, UT",
    category: "Interior",
    description: "Complete interior painting of 8,000 sq ft home",
  },
  {
    id: "desert-villa",
    image: "/villa-exterior.jpg",
    title: "Desert Villa",
    location: "St. George, UT",
    category: "Exterior",
    description: "Exterior painting of Mediterranean villa",
  },
  {
    id: "gourmet-kitchen",
    image: "/kitchen-luxury.jpg",
    title: "Gourmet Kitchen",
    location: "Salt Lake City, UT",
    category: "Cabinetry",
    description: "Cabinet refinishing and premium enamel finish",
  },
  {
    id: "executive-dining-room",
    image: "/Projects/project-4.jpg",
    title: "Executive Dining Room",
    location: "Provo, UT",
    category: "Interior",
    description: "Interior repaint with refined trim work and crisp line detailing",
  },
  {
    id: "master-spa-suite",
    image: "/spa-suite.jpg",
    title: "Master Spa Suite",
    location: "Lehi, UT",
    category: "Interior",
    description: "Luxury bathroom refresh with smooth finishes and durable coatings",
  },
  {
    id: "executive-office",
    image: "/executive-office.jpg",
    title: "Executive Office",
    location: "Orem, UT",
    category: "Interior",
    description: "Warm, high-end office transformation with clean modern tones",
  },
],

  seo: {
    title: "Tauro Painting | Luxury Residential & Commercial Painting in Utah",
    description:
      "Tauro Painting delivers high-end residential and commercial painting in Utah. Luxury finishes, clean prep, flawless results. Get a free estimate today.",
  },
} as const;
