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
    sizeNote: "1.0HP \u2013 2.0HP",
    fee: 15000,
    includes: [
      "Wall mounting & drilling",
      "Refrigerant line & drainage",
      "Vacuum test & gas check",
      "First-run calibration",
    ],
    upcharge: "Add \u20A65,000 per HP above 2.0",
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
    upcharge: "Free above 500L \u2014 included with delivery",
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
    sizeNote: "32\" \u2013 75\" displays",
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
    body: "Tell us what you bought, where you are, and when you\u2019d like us to come. Takes under 2 minutes \u2014 you don\u2019t need to have purchased from Voltory.",
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
    title: "Done \u2014 With Proof",
    body: "Photo of the completed install is shared by SMS for your records. Your manufacturer warranty stays fully intact, with our 90-day workmanship guarantee on top.",
  },
];

export const INSTALL_COVERAGE = [
  { zone: "Lagos", sla: "Same day or next day", color: "var(--ok)" },
  { zone: "Abuja FCT", sla: "Same day or next day", color: "var(--ok)" },
  { zone: "Port Harcourt, Ibadan, Kano", sla: "Within 24\u201348 hours", color: "var(--p)" },
  { zone: "All other state capitals", sla: "Within 2\u20133 working days", color: "var(--p)" },
  { zone: "Remote / non-capital areas", sla: "Quoted on request", color: "var(--mut)" },
];

export const INSTALL_TRUST = [
  {
    icon: "BadgeCheck",
    title: "Certified Technicians",
    body: "Every installer is brand-certified and identity-verified \u2014 you\u2019ll see their photo on the booking confirmation.",
  },
  {
    icon: "ShieldCheck",
    title: "Warranty Stays Intact",
    body: "Our installation is manufacturer-approved \u2014 your warranty isn\u2019t voided. We also add a 90-day workmanship guarantee.",
  },
  {
    icon: "Receipt",
    title: "Transparent Pricing",
    body: "Fees published upfront. No hidden charges, no surprise upsells. What we quote is what you pay.",
  },
];

export const INSTALL_FAQ = [
  {
    q: "Do I have to buy the appliance from Voltory to book installation?",
    a: "No. We install appliances bought anywhere \u2014 just tell us the brand and model when you book. We treat external-purchase installs with the same warranty protection as our own.",
  },
  {
    q: "Will installation void my manufacturer warranty?",
    a: "No. Our technicians follow each brand\u2019s official installation manual, and we share photo records of the install so the warranty stays fully intact. Voltory installation is manufacturer-recognised across all the brands we stock.",
  },
  {
    q: "What if my appliance turns out to be faulty during installation?",
    a: "If we detect a manufacturing defect during install, we stop, document the issue with photo evidence, and \u2014 if you bought from Voltory \u2014 arrange immediate replacement at no extra charge. For external purchases, we provide the documentation you need to claim with the seller.",
  },
  {
    q: "Do you supply the mounting bracket / hose / accessories?",
    a: "Standard fittings (brackets for TVs, gas hoses, water lines) can be added to your booking. We\u2019ll confirm the parts cost upfront when you book \u2014 nothing surprise-added on the day.",
  },
  {
    q: "Can you remove and dispose of my old appliance?",
    a: "Yes. Add the disposal service when booking. Most appliances cost \u20A65,000 to dispose of responsibly; refrigerators and ACs cost more due to refrigerant handling requirements.",
  },
  {
    q: "What happens after install \u2014 do I get a receipt?",
    a: "You receive an SMS with photos of the completed install, the technician\u2019s details, and your installation certificate (PDF by email if you provide one). Keep this with your warranty paperwork.",
  },
];