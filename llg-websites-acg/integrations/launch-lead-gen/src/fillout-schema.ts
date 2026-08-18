export const CONTACT_CONSENT_VERSION = "llg-contact-consent-v1";

export const CONTACT_CONSENT_TEXT =
  "By submitting, you agree that this website and its service provider partners may contact you by call or text about your request. Consent is not a condition of purchase. Message and data rates may apply. Reply STOP to opt out.";

export const FILLOUT_URL_PARAMETERS = [
  "site_key",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "campaign_id",
  "campaign_name",
  "ad_group_id",
  "ad_group_name",
  "ad_id",
  "ad_name",
  "keyword",
  "match_type",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "rdt_cid",
  "ttclid",
  "li_fat_id",
  "landing_page_url",
  "referrer_url",
  "visitor_id",
  "session_id",
  "clarity_session_id",
] as const;

export interface FormQuestionSpec {
  key: string;
  prompt: string;
  type: "multiple_choice" | "multiselect" | "short_text" | "long_text" | "yes_no";
  options?: readonly string[];
  required?: boolean;
}

export interface VerticalFormSpec {
  templateKey: string;
  serviceSlug: string;
  name: string;
  questions: readonly FormQuestionSpec[];
}

export const VERTICAL_FORM_SPECS: readonly VerticalFormSpec[] = [
  {
    templateKey: "drainage",
    serviceSlug: "drainage",
    name: "Drainage & French Drains",
    questions: [
      { key: "project_type", prompt: "What drainage help do you need?", type: "multiselect", options: ["French drain", "Yard drainage", "Downspout drainage", "Channel drain", "Sump pump", "Drain cleaning", "Not sure"], required: true },
      { key: "water_location", prompt: "Where is the water problem?", type: "multiselect", options: ["Yard", "Foundation", "Basement", "Crawlspace", "Driveway or patio", "Other"], required: true },
      { key: "issue_timing", prompt: "When does the problem happen?", type: "multiple_choice", options: ["Every rain", "Heavy rain only", "Constantly", "Not sure"], required: true },
      { key: "recent_flooding", prompt: "Is there active or recent flooding?", type: "yes_no", required: true },
    ],
  },
  {
    templateKey: "retaining-walls",
    serviceSlug: "retaining-walls",
    name: "Retaining Walls",
    questions: [
      { key: "project_type", prompt: "What retaining wall work do you need?", type: "multiple_choice", options: ["New wall", "Replace a wall", "Repair a wall", "Inspection or design help"], required: true },
      { key: "wall_length", prompt: "About how long is the wall?", type: "multiple_choice", options: ["Under 25 ft", "25–50 ft", "51–100 ft", "Over 100 ft", "Not sure"], required: true },
      { key: "wall_height", prompt: "About how tall is the wall?", type: "multiple_choice", options: ["Under 3 ft", "3–4 ft", "5–6 ft", "Over 6 ft", "Not sure"], required: true },
      { key: "wall_material", prompt: "Preferred wall material", type: "multiple_choice", options: ["Concrete block", "Natural stone", "Poured concrete", "Timber", "No preference"], required: true },
    ],
  },
  {
    templateKey: "concrete-pavers",
    serviceSlug: "concrete-pavers",
    name: "Concrete & Pavers",
    questions: [
      { key: "project_type", prompt: "What would you like built or repaired?", type: "multiselect", options: ["Driveway", "Patio", "Walkway", "Pool deck", "Slab", "Paver installation", "Concrete repair", "Other"], required: true },
      { key: "project_size", prompt: "Approximate project size", type: "multiple_choice", options: ["Under 250 sq ft", "250–500 sq ft", "501–1,000 sq ft", "Over 1,000 sq ft", "Not sure"], required: true },
      { key: "surface_condition", prompt: "What is there now?", type: "multiple_choice", options: ["Bare soil or gravel", "Existing concrete", "Existing pavers", "Other surface", "Not sure"], required: true },
      { key: "material_preference", prompt: "Material preference", type: "multiple_choice", options: ["Concrete", "Pavers", "Stamped concrete", "No preference"], required: true },
    ],
  },
  {
    templateKey: "crawlspace",
    serviceSlug: "crawlspace",
    name: "Crawlspace Services",
    questions: [
      { key: "project_type", prompt: "What crawlspace help do you need?", type: "multiselect", options: ["Encapsulation", "Waterproofing", "Dehumidifier", "Mold remediation", "Insulation", "Structural repair", "Inspection", "Not sure"], required: true },
      { key: "crawlspace_issues", prompt: "What are you noticing?", type: "multiselect", options: ["Standing water", "Musty odor", "Visible mold", "High humidity", "Sagging floors", "Pests", "Other"], required: true },
      { key: "active_water", prompt: "Is there active water in the crawlspace now?", type: "yes_no", required: true },
      { key: "prior_work", prompt: "Has the crawlspace had prior waterproofing or repairs?", type: "multiple_choice", options: ["Yes", "No", "Not sure"], required: true },
    ],
  },
  {
    templateKey: "decks-patios",
    serviceSlug: "decks-patios",
    name: "Decks, Patios & Outdoor Living",
    questions: [
      { key: "project_type", prompt: "What outdoor project are you planning?", type: "multiselect", options: ["New deck", "Deck repair", "Covered patio", "Pergola", "Outdoor kitchen", "Screened porch", "Other"], required: true },
      { key: "project_size", prompt: "Approximate project size", type: "multiple_choice", options: ["Under 200 sq ft", "200–400 sq ft", "401–700 sq ft", "Over 700 sq ft", "Not sure"], required: true },
      { key: "material_preference", prompt: "Preferred material", type: "multiple_choice", options: ["Pressure-treated wood", "Cedar or hardwood", "Composite", "No preference"], required: true },
      { key: "hoa_permit", prompt: "Do you know whether HOA approval or a permit is required?", type: "multiple_choice", options: ["Yes", "No", "Not sure"], required: true },
    ],
  },
  {
    templateKey: "fencing",
    serviceSlug: "fencing",
    name: "Fencing",
    questions: [
      { key: "project_type", prompt: "What fence work do you need?", type: "multiple_choice", options: ["New fence", "Replace a fence", "Fence repair", "Gate installation or repair"], required: true },
      { key: "fence_material", prompt: "Preferred fence material", type: "multiple_choice", options: ["Wood", "Vinyl", "Aluminum", "Chain link", "Composite", "No preference"], required: true },
      { key: "linear_footage", prompt: "Approximate fence length", type: "multiple_choice", options: ["Under 100 ft", "100–200 ft", "201–400 ft", "Over 400 ft", "Not sure"], required: true },
      { key: "existing_fence", prompt: "Does an existing fence need removal?", type: "multiple_choice", options: ["Yes", "No", "Part of it", "Not sure"], required: true },
    ],
  },
  {
    templateKey: "landscaping-lawn",
    serviceSlug: "landscaping-lawn",
    name: "Landscaping, Lawn & Irrigation",
    questions: [
      { key: "project_type", prompt: "What services are you interested in?", type: "multiselect", options: ["Landscape design", "Lawn maintenance", "Sod or seeding", "Planting", "Hardscaping", "Sprinkler installation", "Sprinkler repair", "Cleanup"], required: true },
      { key: "property_size", prompt: "Approximate property size", type: "multiple_choice", options: ["Under 1/4 acre", "1/4–1/2 acre", "1/2–1 acre", "Over 1 acre", "Not sure"], required: true },
      { key: "service_frequency", prompt: "Is this a one-time project or ongoing service?", type: "multiple_choice", options: ["One-time project", "Ongoing service", "Both", "Not sure"], required: true },
      { key: "irrigation_present", prompt: "Is there an existing irrigation system?", type: "multiple_choice", options: ["Yes", "No", "Not sure"], required: true },
    ],
  },
  {
    templateKey: "tree-land-clearing",
    serviceSlug: "tree-land-clearing",
    name: "Tree Service & Land Clearing",
    questions: [
      { key: "project_type", prompt: "What work do you need?", type: "multiselect", options: ["Tree removal", "Tree trimming", "Stump grinding", "Emergency tree service", "Lot or land clearing", "Brush removal", "Other"], required: true },
      { key: "tree_count", prompt: "How many trees or how much area is involved?", type: "multiple_choice", options: ["1 tree", "2–5 trees", "6+ trees", "A section of land", "Not sure"], required: true },
      { key: "near_hazards", prompt: "Is the work near a home, road, fence, or power line?", type: "multiple_choice", options: ["Yes", "No", "Not sure"], required: true },
      { key: "emergency", prompt: "Is this an urgent safety issue?", type: "yes_no", required: true },
    ],
  },
  {
    templateKey: "bathroom-remodeling",
    serviceSlug: "bathroom-remodeling",
    name: "Bathroom Remodeling",
    questions: [
      { key: "project_type", prompt: "What bathroom work are you planning?", type: "multiselect", options: ["Full remodel", "Shower or tub", "Vanity and countertops", "Flooring", "Accessibility upgrade", "Fixture replacement", "Other"], required: true },
      { key: "bathroom_type", prompt: "Which bathroom is this?", type: "multiple_choice", options: ["Primary bathroom", "Guest bathroom", "Half bath", "Multiple bathrooms"], required: true },
      { key: "layout_change", prompt: "Will plumbing fixtures move to new locations?", type: "multiple_choice", options: ["Yes", "No", "Not sure"], required: true },
      { key: "budget_range", prompt: "Estimated project budget", type: "multiple_choice", options: ["Under $10,000", "$10,000–$20,000", "$20,001–$40,000", "Over $40,000", "Not sure"], required: true },
    ],
  },
  {
    templateKey: "pool-service",
    serviceSlug: "pool-service",
    name: "Pool Service",
    questions: [
      { key: "project_type", prompt: "What pool service do you need?", type: "multiselect", options: ["Routine cleaning", "Green pool cleanup", "Equipment repair", "Leak detection", "Resurfacing", "Pool inspection", "Other"], required: true },
      { key: "pool_type", prompt: "What type of pool do you have?", type: "multiple_choice", options: ["In-ground concrete", "In-ground fiberglass", "In-ground vinyl", "Above-ground", "Not sure"], required: true },
      { key: "active_issue", prompt: "Is the pool currently unusable or losing water?", type: "yes_no", required: true },
      { key: "service_frequency", prompt: "Do you need one-time or recurring service?", type: "multiple_choice", options: ["One-time", "Recurring", "Not sure"], required: true },
    ],
  },
  {
    templateKey: "hvac",
    serviceSlug: "hvac",
    name: "Heating & Cooling",
    questions: [
      { key: "project_type", prompt: "What HVAC help do you need?", type: "multiple_choice", options: ["AC repair", "Heating repair", "System replacement", "New installation", "Maintenance", "Indoor air quality", "Not sure"], required: true },
      { key: "system_type", prompt: "What type of system do you have?", type: "multiple_choice", options: ["Central HVAC", "Heat pump", "Mini-split", "Furnace", "Not sure"], required: true },
      { key: "system_age", prompt: "About how old is the system?", type: "multiple_choice", options: ["Under 5 years", "5–10 years", "11–15 years", "Over 15 years", "Not sure"], required: true },
      { key: "no_conditioning", prompt: "Are you currently without heating or cooling?", type: "yes_no", required: true },
    ],
  },
  {
    templateKey: "gutter-cleaning",
    serviceSlug: "gutter-cleaning",
    name: "Gutter Cleaning & Repair",
    questions: [
      { key: "project_type", prompt: "What gutter service do you need?", type: "multiselect", options: ["Cleaning", "Repair", "New gutters", "Gutter guards", "Downspout work", "Not sure"], required: true },
      { key: "home_stories", prompt: "How many stories is the building?", type: "multiple_choice", options: ["1", "2", "3+", "Not sure"], required: true },
      { key: "gutter_length", prompt: "Approximate gutter length", type: "multiple_choice", options: ["Under 100 ft", "100–200 ft", "Over 200 ft", "Not sure"], required: true },
      { key: "gutter_guards", prompt: "Are gutter guards installed now?", type: "multiple_choice", options: ["Yes", "No", "Not sure"], required: true },
    ],
  },
  {
    templateKey: "painting",
    serviceSlug: "painting",
    name: "Painting",
    questions: [
      { key: "project_type", prompt: "What painting do you need?", type: "multiselect", options: ["Interior", "Exterior", "Cabinets", "Deck or fence", "Commercial", "Other"], required: true },
      { key: "project_size", prompt: "Approximate project size", type: "multiple_choice", options: ["1–2 rooms", "3–5 rooms", "Whole home", "Exterior", "Commercial space", "Not sure"], required: true },
      { key: "surface_condition", prompt: "Is significant prep or repair needed?", type: "multiple_choice", options: ["Yes", "No", "Not sure"], required: true },
      { key: "paint_selected", prompt: "Have colors or products been selected?", type: "multiple_choice", options: ["Yes", "No", "Partly"], required: true },
    ],
  },
  {
    templateKey: "handyman",
    serviceSlug: "handyman",
    name: "Handyman Services",
    questions: [
      { key: "project_type", prompt: "What handyman work do you need?", type: "multiselect", options: ["Drywall", "Doors or trim", "Mounting or assembly", "Minor plumbing", "Minor electrical", "Carpentry", "Punch list", "Other"], required: true },
      { key: "job_count", prompt: "How many separate tasks are on your list?", type: "multiple_choice", options: ["1", "2–3", "4–6", "7+"], required: true },
      { key: "materials_ready", prompt: "Do you already have the needed materials?", type: "multiple_choice", options: ["Yes", "Some", "No", "Not sure what is needed"], required: true },
      { key: "estimated_duration", prompt: "How large does the job seem?", type: "multiple_choice", options: ["Under 2 hours", "Half day", "Full day", "Multiple days", "Not sure"], required: true },
    ],
  },
  {
    templateKey: "junk-removal",
    serviceSlug: "junk-removal",
    name: "Junk Removal",
    questions: [
      { key: "project_type", prompt: "What needs to be removed?", type: "multiselect", options: ["Household junk", "Furniture", "Appliances", "Yard debris", "Construction debris", "Estate or whole-home cleanout", "Other"], required: true },
      { key: "junk_volume", prompt: "About how much material is there?", type: "multiple_choice", options: ["A few items", "1/4 truck", "1/2 truck", "Full truck or more", "Not sure"], required: true },
      { key: "access_challenges", prompt: "Are there stairs, narrow access, or heavy items?", type: "multiple_choice", options: ["Yes", "No", "Not sure"], required: true },
      { key: "hazardous_items", prompt: "Does the load include paint, chemicals, fuel, or other hazardous material?", type: "multiple_choice", options: ["Yes", "No", "Not sure"], required: true },
    ],
  },
  {
    templateKey: "hurricane-services",
    serviceSlug: "hurricane-services",
    name: "Hurricane Preparation & Recovery",
    questions: [
      { key: "project_type", prompt: "What hurricane service do you need?", type: "multiselect", options: ["Storm shutters", "Impact windows or doors", "Property preparation", "Post-storm inspection", "Debris cleanup", "Emergency repairs", "Other"], required: true },
      { key: "property_type", prompt: "What type of property is this?", type: "multiple_choice", options: ["Single-family home", "Condo or townhome", "Commercial property", "Other"], required: true },
      { key: "opening_count", prompt: "Approximately how many windows and doors are involved?", type: "multiple_choice", options: ["1–5", "6–10", "11–20", "20+", "Not sure"], required: true },
      { key: "emergency", prompt: "Is this an active storm-related emergency?", type: "yes_no", required: true },
    ],
  },
  {
    templateKey: "home-watch",
    serviceSlug: "home-watch",
    name: "Home Watch",
    questions: [
      { key: "project_type", prompt: "What home watch help do you need?", type: "multiselect", options: ["Routine inspections", "Storm preparation", "Post-storm inspection", "Vendor access", "Arrival or departure service", "Other"], required: true },
      { key: "property_type", prompt: "What type of property is this?", type: "multiple_choice", options: ["Single-family home", "Condo", "Townhome", "Other"], required: true },
      { key: "visit_frequency", prompt: "How often would you like the property checked?", type: "multiple_choice", options: ["Weekly", "Every two weeks", "Monthly", "As needed", "Not sure"], required: true },
      { key: "property_vacant", prompt: "Is the property currently vacant?", type: "yes_no", required: true },
    ],
  },
  {
    templateKey: "foundation-repair",
    serviceSlug: "foundation-repair",
    name: "Foundation Repair",
    questions: [
      { key: "project_type", prompt: "What foundation help do you need?", type: "multiple_choice", options: ["Inspection", "Crack repair", "Settlement repair", "Piering or leveling", "Waterproofing", "Not sure"], required: true },
      { key: "foundation_symptoms", prompt: "What are you noticing?", type: "multiselect", options: ["Wall or floor cracks", "Sticking doors or windows", "Uneven floors", "Bowing walls", "Water intrusion", "Exterior brick cracks", "Other"], required: true },
      { key: "foundation_type", prompt: "What type of foundation do you have?", type: "multiple_choice", options: ["Slab", "Crawlspace", "Basement", "Pier and beam", "Not sure"], required: true },
      { key: "prior_inspection", prompt: "Has an engineer or foundation company inspected it?", type: "multiple_choice", options: ["Yes", "No", "Not sure"], required: true },
    ],
  },
] as const;
