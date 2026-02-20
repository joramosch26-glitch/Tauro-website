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

  seo: {
    title: "Tauro Painting | Luxury Residential & Commercial Painting in Utah",
    description:
      "Tauro Painting delivers high-end residential and commercial painting in Utah. Luxury finishes, clean prep, flawless results. Get a free estimate today.",
  },
} as const;
