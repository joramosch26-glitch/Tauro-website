export const content = {
  brand: {
    name: "Tauro Painting",
    tagline: "Custom Home Finishes",
    cta: "Request a Walkthrough",
  },

  contact: {
    phone: "(801) 928-9520",
    email: "tauropaintingutah@gmail.com",
    areas: ["Utah County", "Salt Lake County", "Park City"],
  },

  hero: {
    title: "High-End House Painting & Custom Home Finishes in Utah",
    subtitle:
      "Precision painting, cabinetry, woodwork, and exterior finishes for custom homes and premium residential construction.",
  },

  services: [
    {
      title: "Interior Painting",
      image: "/tauro/interior-open-plan.webp",
      description:
        "Walls, ceilings, trim, doors, and architectural details finished with disciplined preparation and consistent coverage.",
      features: ["Walls & ceilings", "Trim & millwork", "Doors", "New construction"],
    },
    {
      title: "Exterior Painting",
      image: "/tauro/exterior-custom-home.webp",
      description:
        "Exterior coating systems selected and applied for custom residences and Utah's demanding climate.",
      features: ["Custom homes", "Siding & stucco", "Doors & windows", "Exterior wood"],
    },
    {
      title: "Cabinets & Woodwork",
      image: "/tauro/office-woodwork.webp",
      description:
        "High-detail enamel, stain, and clear finishes for cabinetry, millwork, doors, and architectural woodwork.",
      features: ["Cabinetry", "Stain & clear coat", "Interior doors", "Architectural millwork"],
    },
    {
      title: "Custom Homes",
      image: "/tauro/interior-living.webp",
      description:
        "Painting systems and project coordination designed for luxury new construction, remodels, and builder-led work.",
      features: ["Early priming", "Builder coordination", "Premium finish systems", "Punch & closeout"],
    },
  ],

  projects: [
    {
      id: "architectural-interior",
      image: "/tauro/interior-living.webp",
      title: "Architectural Interior",
      location: "Utah",
      category: "Custom Home",
      description: "High-detail interior finish across walls, trim, ceilings, and architectural features.",
    },
    {
      id: "custom-entry",
      image: "/tauro/entry-door.webp",
      title: "Custom Entry Finish",
      location: "Utah",
      category: "Woodwork",
      description: "Stained entry system with a clean, consistent clear finish.",
    },
    {
      id: "architectural-woodwork",
      image: "/tauro/woodwork-detail.webp",
      title: "Architectural Woodwork",
      location: "Utah",
      category: "Wood Finish",
      description: "Detailed wood finish work designed to preserve depth, tone, and material character.",
    },
    {
      id: "custom-exterior",
      image: "/tauro/exterior-residence.webp",
      title: "Custom Residence Exterior",
      location: "Utah",
      category: "Exterior",
      description: "Durable exterior coating system with careful masking and surface preparation.",
    },
    {
      id: "custom-cabinetry",
      image: "/tauro/cabinetry.webp",
      title: "Custom Cabinetry",
      location: "Utah",
      category: "Cabinetry",
      description: "Smooth cabinetry and millwork finish with refined detail work.",
    },
    {
      id: "great-room",
      image: "/tauro/interior-great-room.webp",
      title: "Refined Interior",
      location: "Utah",
      category: "Interior",
      description: "Interior painting and finish work integrated with a high-end residential design.",
    },
  ],

  seo: {
    title: "High-End House Painters in Utah County | Tauro Painting",
    description:
      "Tauro Painting specializes in high-end custom home painting, cabinetry, wood finishes, and exterior painting across Utah County, Park City, and surrounding areas.",
  },
} as const;
