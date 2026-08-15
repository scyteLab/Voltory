/**
 * ============================================================
 *  INSTALLATION SERVICES CONFIG
 *  Editable here; the page is dumb. When the admin lands,
 *  this becomes a database table; the page doesn't change.
 *
 *  Pricing is in Naira. Fees are the standard installation cost
 *  per unit; complex jobs (high-floor ACs, multi-split systems)
 *  are quoted on site after a visit.
 * ============================================================
 */

export const INSTALL_APPLIANCES = [
  {
    id: "ac-split",
    icon: "AirVent",
    name: "Split Air Conditioner",
    sizeNote: "1.0HP – 2.0HP",
    fee: 15000,
    includes: [
      "Wall mounting & drilling",
      "Refrigerant line & drainage",
      "Vacuum test & gas check",
      "First-run calibration",
    ],
    upcharge: "Add ₦5,000 per HP above 2.0",
  },
  {
    id: "fridge",
    icon: "Refrigerator",
    name: "Refrigerator",
    sizeNote: "Single, double-door, side-by-side",
    fee: 8000,
    includes: [
      "Positioning & levelling",
      "24-hour settling check",
      "Water line setup (if applicable)",
      "Temperature calibration",
    ],
    upcharge: "Free above 500L — included with delivery",
  },
  {
    id: "washing-machine",
    icon: "WashingMachine",
    name: "Washing Machine",
    sizeNote: "Top & front load",
    fee: 10000,
    includes: [
      "Water inlet & drain connection",
      "Levelling for vibration control",
      "Transit-bolt removal",
      "Test cycle verification",
    ],
    upcharge: "Built-in or stacked: quote on site",
  },
  {
    id: "tv-mount",
    icon: "Tv",
    name: "TV Wall Mount",
    sizeNote: "32\" – 75\" displays",
    fee: 12000,
    includes: [
      "Wall bracket installation",
      "Cable concealment (basic)",
      "Soundbar mounting (if supplied)",
      "Initial setup & tuning",
    ],
    upcharge: "Bracket sold separately if not included",
  },
  {
    id: "gas-cooker",
    icon: "CookingPot",
    name: "Gas Cooker",
    sizeNote: "Standalone & built-in",
    fee: 7500,
    includes: [
      "Gas regulator & hose check",
      "Burner test on all rings",
      "Leak detection (soap test)",
      "Oven calibration",
    ],
    upcharge: "Cylinder & hose sold separately",
  },
  {
    id: "water-heater",
    icon: "Zap",
    name: "Water Heater",
    sizeNote: "Electric & gas storage",
    fee: 9000,
    includes: [
      "Wall mounting (storage type)",
      "Hot & cold water line setup",
      "Pressure relief valve check",
      "Initial heating test",
    ],
    upcharge: "Plumbing modifications quoted on site",
  },
];

export const INSTALL_STEPS = [
  {
    n: 1,
    title: "Book Installation",
    body: "Tell us what you bought, where you are, and when you’d like us to come. Takes under 2 minutes — you don’t need to have purchased from NAVEN.",
  },
  {
    n: 2,
    title: "We Confirm a Slot",
    body: "A technician calls within 2 hours to confirm the appointment, walk you through what to prepare, and answer any questions about the install.",
  },
  {
    n: 3,
    title: "Certified Install On-Site",
    body: "Our technician arrives in branded uniform with all standard tools. They unbox, install, test, and walk you through how to use your new appliance.",
  },
  {
    n: 4,
    title: "Done — With Proof",
    body: "Photo of the completed install is shared by SMS for your records. Your manufacturer warranty stays fully intact, with our 90-day workmanship guarantee on top.",
  },
];

export const INSTALL_COVERAGE = [
  { zone: "Lagos", sla: "Same day or next day", color: "var(--ok)" },
  { zone: "Abuja FCT", sla: "Same day or next day", color: "var(--ok)" },
  { zone: "Port Harcourt, Ibadan, Kano", sla: "Within 24–48 hours", color: "var(--p)" },
  { zone: "All other state capitals", sla: "Within 2–3 working days", color: "var(--p)" },
  { zone: "Remote / non-capital areas", sla: "Quoted on request", color: "var(--mut)" },
];

export const INSTALL_TRUST = [
  {
    icon: "BadgeCheck",
    title: "Certified Technicians",
    body: "Every installer is brand-certified and identity-verified — you’ll see their photo on the booking confirmation.",
  },
  {
    icon: "ShieldCheck",
    title: "Warranty Stays Intact",
    body: "Our installation is manufacturer-approved — your warranty isn’t voided. We also add a 90-day workmanship guarantee.",
  },
  {
    icon: "Receipt",
    title: "Transparent Pricing",
    body: "Fees published upfront. No hidden charges, no surprise upsells. What we quote is what you pay.",
  },
];

export const INSTALL_FAQ = [
  {
    q: "Do I have to buy the appliance from NAVEN to book installation?",
    a: "No. We install appliances bought anywhere — just tell us the brand and model when you book. We treat external-purchase installs with the same warranty protection as our own.",
  },
  {
    q: "Will installation void my manufacturer warranty?",
    a: "No. Our technicians follow each brand’s official installation manual, and we share photo records of the install so the warranty stays fully intact. NAVEN installation is manufacturer-recognised across all the brands we stock.",
  },
  {
    q: "What if my appliance turns out to be faulty during installation?",
    a: "If we detect a manufacturing defect during install, we stop, document the issue with photo evidence, and — if you bought from NAVEN — arrange immediate replacement at no extra charge. For external purchases, we provide the documentation you need to claim with the seller.",
  },
  {
    q: "Do you supply the mounting bracket / hose / accessories?",
    a: "Standard fittings (brackets for TVs, gas hoses, water lines) can be added to your booking. We’ll confirm the parts cost upfront when you book — nothing surprise-added on the day.",
  },
  {
    q: "Can you remove and dispose of my old appliance?",
    a: "Yes. Add the disposal service when booking. Most appliances cost ₦5,000 to dispose of responsibly; refrigerators and ACs cost more due to refrigerant handling requirements.",
  },
  {
    q: "What happens after install — do I get a receipt?",
    a: "You receive an SMS with photos of the completed install, the technician’s details, and your installation certificate (PDF by email if you provide one). Keep this with your warranty paperwork.",
  },
];