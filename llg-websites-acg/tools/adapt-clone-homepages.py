from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
from pathlib import Path
from urllib.parse import urlsplit

from bs4 import BeautifulSoup, Comment, NavigableString
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCES = Path(r"C:\Users\Justin Abrams\OneDrive\Documents\Playground\.codex-work\llg-clone-sources")
TAR_SOURCES = Path(r"C:\Users\Justin Abrams\OneDrive\Documents\Playground\.codex-work\llg-clone-sources-tar")
BRAND_ASSETS = ROOT / "assets" / "brand"
STOCK_ASSETS = ROOT / "assets" / "stock"
PORTFOLIO_DATA = json.loads((ROOT / "data" / "sites.json").read_text(encoding="utf-8")) if (ROOT / "data" / "sites.json").is_file() else {"sites": []}
SITE_RECORDS = {
    key: site
    for site in PORTFOLIO_DATA.get("sites", [])
    for key in (site["siteKey"].lower(), site["directory"].lower())
}

ARROW_RE = re.compile(r"[→←↗↘➜➝➞➤▶►❯‹›]+");
PHONE_RE = re.compile(r"(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}")
EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
IMAGE_RE = re.compile(r"\.(?:avif|gif|jpe?g|png|webp)(?:[?#][^\"')\s]*)?$", re.I)


CONFIGS = [
    {
        "target": "connecticut-drain-pros",
        "source": SOURCES / "horizonfix-clone/horizonfix-clone/site",
        "brand": "Connecticut Drain Pros",
        "source_names": ["Horizon Fix", "HorizonFix", "Horizon"],
        "phone": "860-744-5564",
        "tel": "+18607445564",
        "email": "info@connecticutdrainpros.com",
        "domain": "connecticutdrainpros.com",
        "title": "Connecticut Drain Pros | Outdoor Drainage Specialists",
        "description": "French drains, yard drainage, storm pipe and water-control systems for Greater Connecticut properties.",
        "images": [
            "images/pgh/photo-drainage-project_type-french-drain-640.jpg",
            "images/pgh/photo-drainage-project_type-yard-drainage-640.jpg",
            "images/pgh/photo-drainage-project_type-downspout-drainage-640.jpg",
            "images/pgh/photo-drainage-water_location-foundation-640.jpg",
        ],
        "hero": "images/pgh/photo-drainage-project_type-french-drain.webp",
        "h1": ["Trusted Connecticut drainage specialists, day and night"],
        "h2": [
            "Drainage solutions that solve the source of the problem",
            "About Connecticut Drain Pros",
            "Built for the way water actually moves",
            "Get in touch",
        ],
        "h3": ["French drain systems", "Yard drainage", "Stormwater control", "Basement water control", "Downspout drainage", "Contact information", "Quick links", "Services", "Contact info", "Serving Greater Connecticut"],
        "paragraphs": [
            "French drains, yard drainage, storm pipe and water-control systems designed around your property, not a one-size-fits-all fix.",
            "Our in-house crew evaluates grades, runoff and existing drainage before recommending a practical system that keeps water moving.",
            "Interior and exterior systems relieve groundwater pressure and direct water safely away from the home.",
            "Catch basins, trench drains and grading solutions address standing water and saturated lawns.",
            "Downspout extensions and buried pipe systems move roof runoff to a safe discharge point.",
            "Call for a free on-site assessment or send the basics and our team will follow up.",
        ],
        "nav": ["Home", "Services", "About", "Projects", "Service areas", "Contact"],
        "terms": {"Licensed and experienced plumbers": "Experienced drainage crews", "Sewer and Main Line": "Stormwater drainage", "Sewer & Main Line": "Stormwater drainage", "plumbers": "drainage specialists", "plumber": "drainage specialist", "plumbing": "drainage", "water heater": "yard drainage", "sewer line": "stormwater", "24/7": "responsive", "emergency": "urgent drainage", "South Shore": "Greater Connecticut", "Massachusetts": "Connecticut"},
        "accent": "#1386d9",
        "font": "Arial, Helvetica, sans-serif",
    },
    {
        "target": "dallas-drain-guys",
        "source": TAR_SOURCES / "minuteman-clone/minuteman-clone/site",
        "brand": "Dallas Drain Guys",
        "source_names": ["Minuteman Plumbing, Heating & Cooling", "Minuteman Plumbing", "Minuteman"],
        "phone": "214-833-6141",
        "tel": "+12148336141",
        "email": "info@dallasdrainguys.com",
        "domain": "dallasdrainguys.com",
        "title": "Dallas Drain Guys | Drainage Done Right",
        "description": "French drains, yard drainage and stormwater control for Dallas-Fort Worth homes.",
        "images": [
            "images/photo-drainage-project_type-french-drain-640.jpg",
            "images/photo-drainage-project_type-yard-drainage-640.jpg",
            "images/photo-drainage-project_type-channel-drain-640.jpg",
            "images/photo-drainage-project_type-downspout-drainage-640.jpg",
            "images/photo-drainage-water_location-foundation-640.jpg",
        ],
        "hero": "images/photo-drainage-project_type-french-drain.webp",
        "h1": ["Reliable drainage services from Dallas Drain Guys"],
        "h2": ["Our drainage services", "From diagnosis to solution", "What our customers say", "The trusted drainage experts near you", "The Dallas Drain Guys difference", "Frequently asked questions", "Dallas Drain Guys proudly offers", "Request a free assessment", "Our company", "Drainage services", "Contact"],
        "h3": ["Contact us today", "French drains", "Yard drainage", "Stormwater control", "Expert assessment", "Clear communication", "Efficient execution", "Workmanship you can trust", "Dallas-Fort Worth", "North Texas", "Still have questions?", "What drainage services do you provide?", "Do you handle urgent drainage problems?", "Which areas do you serve?"],
        "paragraphs": [
            "We design and install drainage systems that protect North Texas homes from standing water, runoff and foundation trouble.",
            "Every project begins with a careful walk of the property and a clear explanation of where the water is coming from.",
            "French drain systems relieve subsurface water pressure before it reaches foundations and living spaces.",
            "Catch basins, channel drains and grading improvements address soggy lawns, patios and low areas.",
            "Buried storm pipe and downspout connections move roof runoff to a reliable discharge point.",
            "You receive a practical plan in plain language before work begins, followed by an organized installation and final walkthrough.",
            "Tell us what is happening and a drainage specialist will follow up with the next step.",
        ],
        "reviews": [
            "They walked us through the whole plan, showed us where the water was coming from, and the yard looks better than before.",
            "The crew was on time, professional and left our property clean. The first big rain proved the system works.",
            "Straightforward estimate, no pressure, and a real solution for the water pooling along our foundation.",
        ],
        "nav": ["Home", "Drainage services", "French drains", "Yard drainage", "Stormwater", "Our process", "Reviews", "Service area", "About", "Contact"],
        "terms": {"Kitchen & Bathroom Fixtures": "Channel and trench drains", "Ductless Mini Splits": "Channel drain installation", "Air Conditioning": "Stormwater control", "AC Installation": "Yard drainage installation", "AC Maintenance": "Drainage maintenance", "AC Repair": "French drain installation", "Leak Detection": "Drainage diagnosis", "Pipe Repair": "Buried drainage pipe", "Sump Pumps": "Sump pump drainage", "Water Filtration": "Downspout drainage", "Gas Fittings": "Stormwater control", "Heat Pumps": "Foundation drainage", "Home Protection Plan": "Drainage assessment", "Service Scalers": "Dallas Drain Guys", "powered by": "Built for", "plumbing": "drainage", "heating": "yard drainage", "air conditioning": "stormwater control", "cooling": "stormwater control", "HVAC": "drainage", "water heater": "French drain", "boiler": "yard drain", "furnace": "storm pipe", "Become a Member": "Get an Estimate", "Book Now": "Request a Quote", "Lifetime Workmanship Guarantee": "Workmanship Focus", "financing": "project planning", "Cambridge": "Dallas", "Boston": "Dallas-Fort Worth", "South Shore": "North Texas", "Hingham": "Dallas", "Duxbury": "Plano", "Massachusetts": "Texas"},
        "accent": "#d9252a",
        "font": "Arial, Helvetica, sans-serif",
    },
    {
        "target": "louisville-precision-walls",
        "source": SOURCES / "pinks-concrete-clone/pinks-concrete-clone",
        "brand": "Louisville Precision Walls",
        "source_names": ["Pink's Concrete Design", "Pink’s Concrete Design", "Pinks Concrete Design", "Pink's"],
        "phone": "502-490-3600",
        "tel": "+15024903600",
        "email": "info@louisvilleprecisionwalls.com",
        "domain": "louisvilleprecisionwalls.com",
        "title": "Louisville Precision Walls | Precisely Built. Perfectly Finished.",
        "description": "Custom retaining walls, drainage-ready site work and outdoor hardscapes in Louisville, Kentucky.",
        "images": [
            "images/hero-background-optimized.png",
            "images/jabhook040_photorealistic_3d_isometric_render_lidar_render_of_1b567f96-ad88-4545-9913-5edd7618960d_1.png",
            "images/architect02116_modern_family_home_Architectural_Digest_style_sl_faa1d8d1-99f0-487f-9ed9-56b36c159dad.png",
            "images/5ceb879a-d9ad-40fe-bfd3-179442d937c3.png",
            "images/jabhook040_photorealistic_3d_isometric_render_lidar_render_of_53642a66-78ba-45ae-a49e-56ef8244b0f1_1.png",
            "images/jabhook040_photorealistic_3d_isometric_render_lidar_render_of_38739219-1b70-4f0e-8073-6dd1e82fc178_2.png",
            "images/sprizzy5133_how_far_should_a_fire_pit_be_from_a_house_--v_7_880811e0-4a3a-429d-af48-bf0a0b9d62f9.png",
            "images/ChatGPT Image Jan 14, 2026, 08_45_13 PM.png",
        ],
        "hero": "images/hero-background-optimized.png",
        "h1": ["Transform your property with Louisville Precision Walls"],
        "h2": ["Why Louisville Precision Walls?", "Our retaining wall services", "Our 3-step process", "Customers love our work", "Retaining wall solutions built to perform", "Hire us for consulting", "Our recent projects", "Serving communities around Louisville", "Get a free estimate"],
        "h3": ["Segmental block walls", "Natural stone walls", "Custom concrete walls", "Drainage-ready wall systems", "Wall repair and replacement", "Grade correction", "Outdoor hardscapes", "Commercial retaining walls", "Free quote for your project", "Plan your wall design", "Final inspection and walkthrough", "Louisville", "Jefferson County", "Oldham County", "Shelby County"],
        "paragraphs": [
            "Custom retaining walls that do their job beautifully, from site preparation and drainage to the last refined detail.",
            "We combine measured layout, structural preparation and careful finishing so each wall belongs on the property.",
            "Choose from segmental block, natural stone and concrete systems selected for the site, grade and desired finish.",
            "Every project starts with a site visit, continues with a clear plan and finishes with a detailed final walkthrough.",
            "Our work balances structure, drainage and craftsmanship for a result designed to perform over time.",
            "Tell us about your grade, failing wall or outdoor plan and we will help define the right next step.",
        ],
        "reviews": ["They communicated clearly, respected the property and built a wall that looks exceptional.", "The process was organized from the estimate through the final walkthrough.", "Beautiful finish, careful workmanship and a team we would gladly recommend."],
        "nav": ["Home", "Why us", "Wall systems", "Process", "Reviews", "Projects", "Service area", "Free estimate"],
        "terms": {"concrete flooring": "retaining walls", "flooring": "wall construction", "floor": "wall", "concrete": "retaining wall", "Epoxy": "segmental block", "specialty coatings": "outdoor hardscapes", "over 20 years": "from plan to finish", "Fairfield County": "Jefferson County", "Fairfield": "Louisville", "Westchester County": "Oldham County", "New York City": "Louisville", "Florida": "Shelby County"},
        "accent": "#bd5c3f",
        "font": "Montserrat, Arial, sans-serif",
    },
    {
        "target": "morgantown-fence-pros",
        "source": TAR_SOURCES / "welborn-garage-clone/welborn-garage-clone/site",
        "brand": "Morgantown Fence Pros",
        "source_names": ["Welborn Garage Doors", "Welborn Garage", "Welborn"],
        "phone": "304-648-4298",
        "tel": "+13046484298",
        "email": "info@morgantownfencepros.com",
        "domain": "morgantownfencepros.com",
        "title": "Morgantown Fence Pros | Boundaries Built Better",
        "description": "Custom wood, vinyl, aluminum and chain-link fencing for Morgantown properties.",
        "images": [
            "https://lirp.cdn-website.com/a4d7a2d1/dms3rep/multi/opt/Morgantown+Fence+Installation+%2810%29-1104w.jpeg",
            "https://lirp.cdn-website.com/a4d7a2d1/dms3rep/multi/opt/Morgantown+Fence+Installation+%286%29-1104w.jpeg",
            "https://lirp.cdn-website.com/a4d7a2d1/dms3rep/multi/opt/Morgantown+Fence+Installation+%285%29-1104w.jpeg",
            "https://lirp.cdn-website.com/a4d7a2d1/dms3rep/multi/opt/Morgantown+Fence+Installation+%287%29-1104w.jpeg",
            "https://lirp.cdn-website.com/a4d7a2d1/dms3rep/multi/opt/Morgantown+Fence+Installation+%289%29-1104w.jpeg",
        ],
        "hero": "https://lirp.cdn-website.com/a4d7a2d1/dms3rep/multi/opt/Morgantown+Fence+Installation+%2810%29-1104w.jpeg",
        "h1": ["Best fence company near you in Morgantown"],
        "h2": ["Morgantown's trusted local fence company", "Fence services on this page", "Residential and commercial fence installation", "Fence styles we offer", "Serving Morgantown neighborhoods", "How to choose a reputable fence company", "Your highly rated local fence contractor", "Why choose Morgantown Fence Pros?", "Contact us today", "Call today"],
        "h3": ["On this page", "Get a free fence estimate", "Wood fence installation", "Vinyl fence installation", "Aluminum fencing", "Chain-link fencing", "Gate installation", "Privacy fences", "Fence repair", "Check credentials and experience", "Look for local expertise", "Verify customer feedback", "Evaluate the range of services", "Ask about workmanship", "Local and responsive", "Built for your property", "Professional installation", "Our service area", "A fence guide worth reading"],
        "paragraphs": [
            "Custom wood, vinyl, aluminum and chain-link fencing built around your property, your purpose and your curb appeal.",
            "We help you choose a fence that provides the right balance of privacy, security, durability and style.",
            "Every installation starts with a careful layout and site review, followed by organized work and a final walkthrough.",
            "From classic wood privacy fences to low-maintenance vinyl and metal systems, our team builds boundaries that fit.",
            "Tell us about your property and priorities and we will help you plan the right fence for the space.",
            "Morgantown homeowners count on clear communication, professional installation and a finished fence that looks at home.",
        ],
        "reviews": ["They took time to explain the options, kept the site clean and built a fence that fits our yard perfectly.", "The crew arrived when promised and the finished work was better than we expected.", "Professional from the estimate through the final walkthrough. We love the new privacy fence."],
        "nav": ["Home", "Fence options", "Wood fencing", "Vinyl fencing", "Metal fencing", "Fence repair", "Why us", "Reviews", "Service area", "Contact"],
        "terms": {"5-Star Garage Door Company": "Local fence company", "Award Winning Garage Services": "Professional fence services", "Best Garage Door Installations and Replacements": "Fence installations and replacements", "Your Highest Rated, Local Garage Door Company": "Your local fence company", "The Original Full Service Garage Door Company": "Full-service fence company", "garage doors": "fences", "garage door": "fence", "garage": "fence", "same-day service": "your fence project", "book now": "request a quote", "schedule online": "request a quote", "open 7 days a week": "call for availability", "over 25 years": "across the local area", "voted the #1": "your local", ", TX": ", WV", "DFW": "Morgantown", "Dallas": "Morgantown", "Fort Worth": "Morgantown", "Texas": "West Virginia", "springs": "posts", "opener": "gate"},
        "accent": "#ffd400",
        "font": "Arial, Helvetica, sans-serif",
    },
    {
        "target": "Pittsburgh-French-Drain-Site",
        "source": SOURCES / "roofrightnow-clone/roofrightnow-clone/site",
        "brand": "Pittsburgh French Drain",
        "source_names": ["Roof Right Now", "RoofRightNow"],
        "phone": "412-850-4615",
        "tel": "+14128504615",
        "email": "info@pghfrenchdrain.com",
        "domain": "pghfrenchdrain.com",
        "title": "Pittsburgh French Drain | Control Water. Protect What Matters.",
        "description": "French drains, basement drainage and outdoor water-control systems for Pittsburgh homes.",
        "images": [
            "images/pgh/photo-drainage-project_type-french-drain-640.jpg",
            "images/pgh/photo-drainage-water_location-basement-640.jpg",
            "images/pgh/photo-drainage-project_type-yard-drainage-640.jpg",
            "images/pgh/photo-drainage-project_type-channel-drain-640.jpg",
            "images/pgh/photo-drainage-project_type-downspout-drainage-640.jpg",
            "images/pgh/photo-drainage-water_location-foundation-640.jpg",
            "images/pgh/photo-drainage-water_location-crawlspace-640.jpg",
            "images/pgh/photo-drainage-water_location-driveway-or-patio-640.jpg",
            "images/pgh/photo-drainage-water_location-yard-640.jpg",
        ],
        "hero": "images/pgh/photo-drainage-project_type-french-drain.webp",
        "h1": ["Trusted for one reason: drainage that works"],
        "h2": ["Create your free drainage estimate", "A complete water-control plan", "Pittsburgh French Drain service areas", "Our signature system: diagnose, direct, defend"],
        "h3": ["In just a few minutes", "French drain installation", "Basement water control", "Yard drainage", "Downspout drainage", "Foundation drainage", "Crawlspace drainage", "Driveway and patio drainage", "Stormwater control", "Diagnose", "Direct", "Defend"],
        "paragraphs": [
            "Smart drainage systems for Pittsburgh homes, built to move water away from foundations, basements, yards and hardscapes.",
            "Tell us where the water appears and our team will help define the next step for your property.",
            "Our process accounts for source, grade, pressure, route and discharge so the complete system works together.",
            "We install French drains, basement drainage, yard drainage and stormwater systems throughout the Pittsburgh area.",
            "Every recommendation is explained clearly before work begins and installed with long-term performance in mind.",
        ],
        "nav": ["Home", "Drainage services", "Our system", "Service area", "Free estimate", "Call now"],
        "terms": {"roofing": "drainage", "roof": "drain", "shingle": "drainage system", "warranty": "water-control plan", "4.9—star rated by 100+ customers": "Local drainage specialists", "4.9 star rated by 100+ customers": "Local drainage specialists", "50—year product warranties": "Clear project recommendations", "50-year product warranties": "Clear project recommendations", "rated a+": "Professional drainage service", "Five-star review": "Customer feedback", "GAF": "Pittsburgh", "Boston": "Pittsburgh", "Houston": "Allegheny County", "Austin": "South Hills", "Atlanta": "North Hills", "North Jersey": "Monroeville", "Fairfield": "Cranberry Township", "South Florida": "Bethel Park", "Charlotte": "Mt. Lebanon", "Richmond": "Robinson Township"},
        "accent": "#d9252a",
        "font": "Ubuntu, Arial, sans-serif",
    },
]


SOURCE_PROFILES = {
    "horizonfix": {
        "root": SOURCES / "horizonfix-clone/horizonfix-clone/site",
        "source_names": ["Horizon Fix Plumbing", "Horizon Fix", "HorizonFix", "Horizon"],
        "accent": "#1386d9", "font": "Arial, Helvetica, sans-serif",
        "terms": ["plumbing", "plumber", "water heater", "sewer line", "fixture installation", "drain cleaning", "pipe leak repair", "South Shore", "Massachusetts", "24/7", "emergency"],
    },
    "minuteman": {
        "root": TAR_SOURCES / "minuteman-clone/minuteman-clone/site",
        "source_names": ["Minuteman Plumbing, Heating & Cooling", "Minuteman Plumbing", "Minuteman"],
        "accent": "#d9252a", "font": "Arial, Helvetica, sans-serif",
        "terms": ["plumbing", "plumber", "HVAC", "heating", "air conditioning", "cooling", "water heater", "furnace", "boiler", "Kitchen & Bathroom Fixtures", "Leak Detection", "Pipe Repair", "Sump Pumps", "Water Filtration", "Gas Fittings", "Heat Pumps", "AC Repair", "AC Installation", "AC Maintenance", "Ductless Mini Splits", "Home Protection Plan", "Service Scalers", "Financing", "Boston", "Cambridge", "Hingham", "Massachusetts", "South Shore"],
    },
    "pinks-concrete": {
        "root": SOURCES / "pinks-concrete-clone/pinks-concrete-clone",
        "source_names": ["Pink's Concrete Design", "Pink’s Concrete Design", "Pinks Concrete Design", "Pink's"],
        "accent": "#bd5c3f", "font": "Montserrat, Arial, sans-serif",
        "terms": ["concrete flooring", "flooring", "epoxy", "specialty coatings", "Fairfield County", "Fairfield", "Westchester County", "New York City", "Florida"],
    },
    "roofrightnow": {
        "root": SOURCES / "roofrightnow-clone/roofrightnow-clone/site",
        "source_names": ["Roof Right Now", "RoofRightNow"],
        "accent": "#d9252a", "font": "Ubuntu, Arial, sans-serif",
        "terms": ["roofing", "roofer", "roof replacement", "roof repair", "roof estimate", "roof", "shingle", "GAF", "Boston", "Houston", "Atlanta", "North Jersey", "South Florida", "Richmond"],
    },
    "welborn-garage": {
        "root": TAR_SOURCES / "welborn-garage-clone/welborn-garage-clone/site",
        "source_names": ["Welborn Garage Doors", "Welborn Garage", "Welborn"],
        "accent": "#ffd400", "font": "Arial, Helvetica, sans-serif",
        "terms": ["garage doors", "garage door", "garage", "opener", "springs", "DFW", "Dallas", "Fort Worth", "Texas", "same-day service", "open 7 days a week"],
    },
    "cincinnati-painting": {
        "root": SOURCES / "cincinnati-painting-clone/cincinnati-painting-clone/site",
        "source_names": ["Cincinnati Painting Co", "Cincinnati Painting Company", "cincinnatipaintingco"],
        "accent": "#ee5835", "font": "Arial, Helvetica, sans-serif",
        "terms": ["Cincinnati", "Mason", "West Chester", "Montgomery", "Fairfield", "Loveland", "licensed", "insured", "best painters", "the best"],
    },
    "nextgen-windows": {
        "root": SOURCES / "nextgen-windows-clone/nextgen-windows-clone",
        "source_names": ["Next Generation Windows", "NextGen Windows", "Next Generation"],
        "accent": "#e96a2c", "font": "Arial, Helvetica, sans-serif",
        "terms": ["windows and doors", "window installation", "replacement windows", "shop windows", "shop doors", "windows", "doors", "Newtown Square", "Philadelphia", "Winding Way", "Pennsylvania", " PA ", "68th anniversary", "lifetime warranties", "trusted by thousands", "200 In The Nation", "brand partners"],
    },
    "trips-windows-small": {
        "root": SOURCES / "trips-windows-clone/trips-windows-clone",
        "source_names": ["Trip's Windows", "Trips Windows", "Trip’s Windows", "Trip's"],
        "accent": "#ee5f35", "font": "Arial, Helvetica, sans-serif",
        "terms": ["residential window cleaning", "commercial window cleaning", "window cleaning", "pressure washing", "gutter cleaning", "solar panel cleaning", "screen repair", "Venice", "Santa Monica", "Beverly Hills", "Los Angeles", "Sell Your Business to Trip"],
    },
    "trips-windows-full": {
        "root": SOURCES / "tripswindows-clone/tripswindows-clone/site",
        "source_names": ["Trip's Windows", "Trips Windows", "Trip’s Windows", "Trip's"],
        "accent": "#ee5f35", "font": "Arial, Helvetica, sans-serif",
        "terms": ["residential window cleaning", "commercial window cleaning", "window cleaning", "pressure washing", "gutter cleaning", "solar panel cleaning", "screen repair", "Venice", "Santa Monica", "Beverly Hills", "Los Angeles", "Sell Your Business to Trip"],
    },
}


TRADE_CONTENT = {
    "Drainage": {
        "noun": "drainage", "service": "drainage service",
        "h1": "Practical drainage planning for {location} properties",
        "headings": ["Drainage options for your property", "A clear path from assessment to installation", "French drains and yard drainage", "Stormwater routing", "Downspout drainage", "Foundation water control", "How the process works", "Plan a property assessment", "Serving {location}", "Recent drainage work", "What customers say"],
        "paragraphs": ["Drainage work starts with understanding where water enters, how it moves, and where it can discharge safely.", "Available services include French drains, yard drainage, downspout routing, channel drains, and foundation water-control planning.", "A site visit can document grades, runoff, low areas, and existing drainage before a project scope is prepared.", "Tell us where water collects and when it happens, and we will help organize the next step for your property."]
    },
    "Crawlspace": {
        "noun": "crawlspace", "service": "crawlspace service",
        "h1": "Crawlspace solutions planned for {location} homes",
        "headings": ["Crawlspace services", "Moisture and drainage planning", "Encapsulation planning", "Vapor barrier options", "Crawlspace drainage", "Dehumidification planning", "Inspection and project scope", "Plan a crawlspace assessment", "Serving {location}", "Crawlspace solutions", "What customers say"],
        "paragraphs": ["Crawlspace work begins with a review of moisture entry, drainage, ground conditions, ventilation, and visible problem areas.", "Potential project scopes may include vapor barriers, encapsulation, drainage, dehumidification, and access improvements.", "Recommendations are prepared around the conditions observed at the property and the homeowner's priorities.", "Describe the moisture, odor, standing water, or comfort issue you are seeing and we will help plan the next step."]
    },
    "Retaining walls": {
        "noun": "retaining wall", "service": "retaining wall service",
        "h1": "Retaining wall planning for {location} properties",
        "headings": ["Retaining wall options", "Site preparation and drainage", "Segmental block walls", "Natural stone walls", "Wall repair and replacement", "Grade and drainage planning", "From layout to walkthrough", "Plan a site assessment", "Serving {location}", "Recent wall projects", "What customers say"],
        "paragraphs": ["Retaining wall projects begin with a review of grade, access, drainage, existing conditions, and the intended use of the space.", "Material and layout options can be evaluated around the property, desired finish, and project scope.", "Drainage, base preparation, wall alignment, and site restoration are considered as part of the plan.", "Share the wall dimensions, visible movement, and desired finish so the assessment can start with the right details."]
    },
    "Pool service": {
        "noun": "pool", "service": "pool service",
        "h1": "Pool care planning for {location} properties",
        "headings": ["Pool service options", "Routine pool care", "Water testing and balancing", "Cleaning and debris removal", "Equipment checks", "Seasonal service planning", "A straightforward service process", "Request pool service information", "Serving {location}", "Pool care in action", "What customers say"],
        "paragraphs": ["Pool service can be planned around the pool's current condition, equipment, use, and preferred maintenance schedule.", "Potential service scopes include cleaning, water testing, chemical balancing, and visual equipment checks.", "A property review helps define the requested work and any items that need a separate specialist assessment.", "Tell us about the pool, equipment, current water condition, and the service schedule you have in mind."]
    },
    "Backyard construction": {
        "noun": "backyard construction", "service": "backyard construction",
        "h1": "Backyard projects planned for {location} properties",
        "headings": ["Backyard construction options", "Outdoor living layouts", "Patio and gathering areas", "Walkways and site features", "Drainage-aware planning", "Material and access review", "From concept to project scope", "Plan a site assessment", "Serving {location}", "Outdoor spaces", "What customers say"],
        "paragraphs": ["Backyard construction begins with a review of the available space, access, drainage, intended use, and preferred materials.", "Potential project scopes may include patios, walkways, gathering areas, and coordinated outdoor features.", "A site visit helps organize dimensions, existing conditions, priorities, and the next planning step.", "Tell us how you want to use the space and which features matter most, and we will help organize the project conversation."]
    },
    "Painting": {
        "noun": "painting", "service": "painting service",
        "h1": "Interior and exterior painting for {location} properties",
        "headings": ["Residential and commercial painting", "Interior painting", "Exterior painting", "Surface preparation", "Color planning", "Commercial painting", "A clear painting process", "Request a project conversation", "Serving {location}", "Recent painting work", "What customers say"],
        "paragraphs": ["Painting projects can be scoped around the surfaces, existing condition, color plan, access, and desired schedule.", "Available project types may include interior, exterior, residential, and commercial painting.", "A walkthrough helps document preparation needs, project boundaries, and the information needed for a written scope.", "Share the rooms or exterior areas, current surface condition, and preferred timing to begin the project conversation."]
    },
}


SAMPLE_REVIEWS = {
    "Drainage": [
        "They found where the water was entering, explained the plan clearly, and left the yard clean after the work.",
        "The crew communicated well from the first visit through the final walkthrough. Our drainage issue finally has a clear solution.",
        "Professional, organized, and easy to work with. We appreciated the straightforward recommendations.",
    ],
    "Crawlspace": [
        "They explained the moisture problem clearly and gave us a practical plan for the crawlspace.",
        "The crew was organized, careful inside the house, and left the work area clean when they finished.",
        "Communication was excellent from the inspection through the final walkthrough, and the space feels much better now.",
    ],
    "Retaining walls": [
        "The wall looks excellent and the team took time to explain the drainage and site preparation behind it.",
        "The process was organized from the initial visit through the final walkthrough, with clear communication throughout.",
        "They respected the property, kept the work area orderly, and delivered a finished wall that fits the landscape.",
    ],
    "Fencing": [
        "They helped us compare materials, kept the installation organized, and built a fence that fits the yard beautifully.",
        "The crew communicated clearly and the finished gate and fence line look great.",
        "Professional from the estimate through the walkthrough. We are very happy with the added privacy.",
    ],
    "Pool service": [
        "Clear communication, reliable service, and the pool looked great when the visit was complete.",
        "They explained what the water needed and gave us a straightforward plan for ongoing care.",
        "Professional, organized, and easy to schedule. We appreciated the attention to the equipment as well as the pool.",
    ],
    "Painting": [
        "The preparation was thorough, the crew kept everything protected, and the finished rooms look fantastic.",
        "They communicated clearly about colors, timing, and the work plan from start to finish.",
        "Professional and detail-oriented. The clean lines and careful cleanup made a real difference.",
    ],
    "Backyard construction": [
        "They listened to how we wanted to use the yard and turned it into a space that feels natural for our home.",
        "The project stayed organized and the team communicated clearly about the layout, materials, and next steps.",
        "We love the finished patio and how thoughtfully it connects with the rest of the backyard.",
    ],
}


CLONE_COPY_PROFILES = {
    "horizonfix": {
        "h1": "Straightforward {noun} help for {location} properties",
        "headings": ["Services built around the property", "A practical, property-first approach", "Understand the source", "Choose a workable route", "Plan the installation", "Review the finished scope", "About {brand}", "What happens next", "Request project information", "Serving {location}"],
        "paragraphs": ["Start with the conditions you can see, then trace how the problem moves through the property.", "A site assessment documents access, grade, existing systems, and the result you want before a scope is prepared.", "The recommendation should be clear enough to understand without relying on unsupported promises or one-size-fits-all language.", "Final materials, schedule, credentials, and pricing are confirmed by the serving provider before work begins.", "Use the request form to describe what is happening and where you are seeing it."],
        "nav": ["Home", "Services", "Approach", "About", "Project information", "Service area", "Contact"],
    },
    "minuteman": {
        "h1": "Local {noun} planning built around your property",
        "headings": ["Request project information", "Our {noun} services", "From assessment to a clear scope", "Document the conditions", "Explain the options", "Confirm the work", "Recent projects", "The {brand} approach", "Frequently asked questions", "Serving {location}", "Plan an assessment"],
        "paragraphs": ["A useful project plan begins with the symptoms, the affected areas, and the constraints that shape the work.", "The assessment separates immediate concerns from optional improvements and explains the next step in plain language.", "Available services and final recommendations depend on the conditions found at the property.", "Review the service options, process, and customer experiences as you plan the next step.", "Submit the property details below and the team will follow up about your request."],
        "nav": ["Home", "Services", "Assessment", "Process", "Project proof", "Service area", "About", "Contact"],
    },
    "pinks-concrete": {
        "h1": "Shape your property with carefully planned {noun}",
        "headings": ["Why {brand}?", "Our {noun} services", "A three-step project process", "Project highlights", "Solutions designed around the site", "Plan before construction", "Recent projects", "Serving {location}", "Request an assessment"],
        "paragraphs": ["Good project planning balances appearance, site conditions, drainage, access, and long-term use.", "The first visit documents what exists today and what the finished space needs to accomplish.", "Options are explained with a written scope before scheduling, materials, or construction details are finalized.", "Explore the materials, project steps, and design priorities that shape a successful installation.", "Tell us about the property and the outcome you are considering to start the assessment."],
        "nav": ["Home", "Why us", "Services", "Process", "Projects", "Service area", "Assessment"],
    },
    "roofrightnow": {
        "h1": "One clear plan for the {noun} problem in front of you",
        "headings": ["Create your project assessment", "A complete property plan", "Service options for {location}", "Start with the source", "Map the practical route", "Confirm the final scope", "Project terms in writing", "The {brand} three-part approach", "Request project information"],
        "paragraphs": ["Describe where the issue appears and what changes during weather, use, or seasonal conditions.", "The property review connects the visible symptoms to a practical route for the proposed work.", "Recommendations, materials, timing, and project terms are confirmed in writing after the relevant conditions are verified.", "No rating, warranty, credential, or completion-time claim is published until it is approved for this operator.", "Use the assessment form to provide the starting details for your property."],
        "nav": ["Home", "Service options", "Our approach", "Service area", "Assessment", "Contact"],
    },
    "welborn-garage": {
        "h1": "Local {noun} service planned for {location} properties",
        "headings": ["Project information", "Services on this page", "Options for the property", "How to compare the choices", "Plan around access and use", "Review materials and maintenance", "Confirm the project terms", "What customers say", "Why choose {brand}?", "Serving {location}", "Request an assessment"],
        "paragraphs": ["Choose the project around how the property is used, the conditions on site, and the result that matters most.", "A careful layout and assessment can identify access limits, existing conditions, and the decisions required before work begins.", "Ask for materials, workmanship details, schedule, and project terms to be confirmed in writing.", "Review service photography and customer experiences as you compare the available options.", "Share the property details to begin planning the next step."],
        "nav": ["Home", "Options", "Services", "Planning guide", "Project proof", "Service area", "Contact"],
    },
    "cincinnati-painting": {
        "h1": "A clearer plan for your {noun} project",
        "headings": ["Property-specific planning", "Interior project options", "Exterior project options", "Preparation and protection", "Color and finish decisions", "Residential project planning", "Commercial project planning", "What customers say", "Our process", "Request project information", "Serving {location}"],
        "paragraphs": ["A useful painting scope begins with the surfaces, current condition, access, preparation needs, and finish you want.", "The walkthrough identifies repairs, protection requirements, project boundaries, and color decisions before scheduling.", "Interior and exterior options are documented in plain language so materials and timing can be confirmed.", "Explore recent service imagery, preparation details, and customer experiences as you plan your project.", "Use the form to describe the rooms, exterior areas, or commercial space you are considering."],
        "nav": ["Home", "Interior", "Exterior", "Process", "Projects", "Service area", "Contact"],
    },
    "nextgen-windows": {
        "h1": "Stop guessing about your {noun} project",
        "headings": ["The next step for your property", "Options organized around the problem", "Project approach", "Compare the practical choices", "A clear project process", "Questions to ask before scheduling", "Plan your in-home assessment", "Project resources", "Serving {location}", "Contact {brand}"],
        "paragraphs": ["Begin with a review of the property, the visible symptoms, and the improvements you are trying to make.", "The assessment organizes possible solutions around access, condition, maintenance, and the expected result.", "Clear written recommendations make it easier to compare options before materials, schedule, or pricing are finalized.", "Explore the service options, project process, photography, and customer experiences available on this site.", "Request an assessment when you are ready to document the project details."],
        "nav": ["Home", "Options", "Projects", "Process", "Resources", "Service area", "Contact"],
    },
    "trips-windows-small": {
        "h1": "Let your {location} property work better",
        "headings": ["Practical care for the property", "Services arranged around your needs", "What the assessment covers", "What customers say", "Your local service area", "A clear three-step process", "Questions worth asking", "Request project information", "Contact {brand}"],
        "paragraphs": ["Thoughtful property service starts with the areas that need attention and the result you want to see.", "The assessment records access, condition, service priorities, and any constraints that affect the work.", "You receive a clear next step that reflects the conditions found at the property.", "Service imagery and customer experiences help explain what to expect from the process.", "Tell us about the property and the service you are considering."],
        "nav": ["Home", "Services", "About", "Service area", "Project information"],
    },
    "trips-windows-full": {
        "h1": "A polished plan for your {location} property",
        "headings": ["Property services with a clear next step", "Select the right service path", "Plan around access and condition", "Project highlights", "Where service is available", "A documented three-step process", "Your local service team", "Frequently asked questions", "Request an assessment", "Contact {brand}"],
        "paragraphs": ["Start by identifying the affected areas, the service priority, and the finished result you expect.", "A property review documents the current condition and the practical decisions needed before scheduling.", "The proposed scope should explain the work, exclusions, and next steps clearly enough to compare options.", "Explore the service photography, process, and customer experiences throughout the site.", "Use the request form to share the details needed for follow-up."],
        "nav": ["Home", "Services", "Process", "Projects", "Service area", "About", "Contact"],
    },
}


def load_remaining_configs() -> list[dict]:
    records = json.loads((Path(__file__).with_name("remaining-sites.json")).read_text(encoding="utf-8"))
    configs = []
    for record in records:
        profile = SOURCE_PROFILES[record["source"]]
        content = TRADE_CONTENT[record["trade"]]
        clone_copy = CLONE_COPY_PROFILES[record["source"]]
        location = record["location"]
        generic = content["noun"]
        site_record = SITE_RECORDS.get(record["target"].lower(), {})
        contact = site_record.get("contact", {})
        phone_ready = contact.get("phoneStatus") in {"callrail-active", "callrail-shared"}
        format_values = {"brand": record["brand"], "location": location, "trade": record["trade"], "noun": generic}
        location_terms = {
            "south shore", "massachusetts", "boston", "cambridge", "hingham",
            "fairfield county", "fairfield", "westchester county", "new york city", "florida",
            "houston", "atlanta", "north jersey", "south florida", "richmond",
            "dfw", "dallas", "fort worth", "texas", "newtown square", "philadelphia",
            "winding way", "pennsylvania", "pa", "broomall", "venice", "santa monica",
            "beverly hills", "los angeles", "cincinnati", "mason", "west chester",
            "montgomery", "loveland",
        }
        terms = {term: location if term.strip().lower() in location_terms else generic for term in profile["terms"]}
        terms.update({
            "free quote": "project information", "free estimate": "project information",
            "call now": "contact information", "call today": "contact information",
            "testimonials": "customer reviews", "google reviews": "customer reviews",
            "five-star": "customer", "5-star": "customer", "award winning": "local",
            # Source-export trust claims stay out of staging until the target business
            # supplies evidence. These substitutions preserve the clone's text slots.
            "48-hour": "Project details", "re-clean guarantee": "service follow-through",
            "Family-run": "Local service", "since 2020": "in the local area",
            "Licensed & insured": "Professional service",
            "40+ Years": "Local service experience",
            "Our family has served": "Serving",
            "customer ratings": "customer reviews",
            "100% Satisfaction Guaranteed": "Clear project scope",
            "Lifetime Workmanship Guarantee": "Workmanship details in writing",
            "Painting Done Right, Every Time.": "Painting planned around your property.",
            "Trusted by commercial clients across": "Project information for",
            "Proudly serving": "Serving",
            "Proudly serving Dallas-Fort Worth": f"Serving {location}",
            "Locations in Broomall and Newtown Square": f"Serving {location}",
            "Call For Garage Door": "Request an assessment",
            "Call For Garage Doors": "Request an assessment",
            "Call For garage": "Request an assessment",
            "Click Here to Book Now": "Choose a time to connect",
            "Squeaky clean. Never streaky.": "Property-specific planning.",
            "Get A Free Paint Preview And See Your Colors BEFORE You Paint It!": "Request project information and color planning",
            "Get A Free Paint Preview And See Your Colors BEFORE\u00a0You Paint It!": "Request project information and color planning",
            "Get a FREE Paint Preview!": "Request project information",
            "Get a FREE\u00a0Paint Preview!": "Request project information",
            "by paintingâ€™s Best": "for Pittsburgh properties",
            "by painting’s Best": "for Pittsburgh properties",
            "by painting's Best": "for Pittsburgh properties",
            "painting & painting": "residential & commercial",
        })
        configs.append({
            **record,
            "source": profile["root"],
            "source_id": record["source"],
            "source_names": profile["source_names"],
            "phone": contact.get("phone") if phone_ready else "Request service online",
            "tel": contact.get("tel") if phone_ready else None,
            "email": f"info@{record['domain']}",
            "title": f"{record['brand']} | {record['trade']} in {location}",
            "description": f"{record['trade']} services for {location} properties, with a clear assessment process and straightforward next steps.",
            "images": [f"media/project-placeholder-{index}.svg" for index in range(1, 5)],
            "hero": "media/hero-placeholder.svg",
            "h1": [clone_copy["h1"].format(**format_values)],
            "h2": [value.format(**format_values) for value in clone_copy["headings"]],
            "h3": [value.format(**format_values) for value in clone_copy["headings"]],
            "h4": [value.format(**format_values) for value in clone_copy["headings"]],
            "paragraphs": [value.format(**format_values) for value in clone_copy["paragraphs"]],
            "reviews": SAMPLE_REVIEWS[record["trade"]],
            "nav": clone_copy["nav"],
            "terms": terms,
            "accent": profile["accent"],
            "font": profile["font"],
            "staging_manifest": True,
        })
    return configs


def local_source_path(source_root: Path, raw: str) -> Path | None:
    if not raw or raw.startswith(("data:", "blob:", "mailto:", "tel:", "#")):
        return None
    path = urlsplit(raw).path
    if path.startswith("/"):
        path = path[1:]
    candidate = source_root / path
    return candidate if candidate.is_file() else None


def copy_runtime(source_root: Path, target_root: Path) -> None:
    dest_root = target_root / "clone-assets"
    allowed = {".css", ".js", ".mjs", ".woff", ".woff2", ".ttf", ".otf", ".eot"}
    for src in source_root.rglob("*"):
        if not src.is_file() or src.suffix.lower() not in allowed:
            continue
        rel = src.relative_to(source_root)
        dest = dest_root / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        text_suffix = src.suffix.lower() in {".css", ".js", ".mjs"}
        if not text_suffix:
            shutil.copy2(src, dest)
            continue
        data = src.read_text(encoding="utf-8", errors="ignore")
        if src.suffix.lower() == ".css":
            data = re.sub(r"url\((['\"]?)([^)'\"]+\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#][^)'\"]*)?)\1\)", 'url("data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=")', data, flags=re.I)
            data = re.sub(r"url\((['\"]?)/([^/'\"]+\.(?:woff2?|ttf|otf|eot))\1\)", r'url("\2")', data, flags=re.I)
            data = data.replace("✓", "").replace("→", "").replace("←", "")
            data = re.sub(r"content\s*:\s*(['\"])\\(?:2190|2192|260e)\s*;?\1", r"content:\1\1", data, flags=re.I)
        dest.write_text(data, encoding="utf-8")


def rewrite_asset_url(source_root: Path, raw: str) -> str:
    src = local_source_path(source_root, raw)
    if not src:
        return raw
    rel = src.relative_to(source_root).as_posix()
    return f"clone-assets/{rel}"


def image_dimensions(target_root: Path, src: str) -> tuple[int, int]:
    if src.startswith("http"):
        return 1200, 800
    try:
        with Image.open(target_root / src) as image:
            return image.width, image.height
    except Exception:
        return 1200, 800


def wordmark_svg(config: dict, target_root: Path) -> None:
    approved = BRAND_ASSETS / config["target"].lower()
    if not approved.is_dir():
        record = SITE_RECORDS.get(config["target"].lower())
        approved = BRAND_ASSETS / record["siteKey"] if record else approved
    if approved.is_dir() and (approved / "brandmark.svg").is_file():
        for filename in ("brandmark.svg", "brandmark.png", "brand-icon.png", "favicon.png"):
            source = approved / filename
            if source.is_file():
                shutil.copy2(source, target_root / filename)
        return
    words = config["brand"].split()
    split = max(1, len(words) // 2)
    top = " ".join(words[:split]).upper()
    bottom = " ".join(words[split:]).upper()
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 160" role="img" aria-labelledby="title">
  <title id="title">{html.escape(config["brand"])}</title>
  <rect width="520" height="160" rx="10" fill="#ffffff"/>
  <rect width="18" height="160" fill="{config["accent"]}"/>
  <text x="44" y="66" font-family="Arial, sans-serif" font-size="42" font-weight="800" fill="#111827">{html.escape(top)}</text>
  <text x="44" y="119" font-family="Arial, sans-serif" font-size="42" font-weight="800" fill="{config["accent"]}">{html.escape(bottom)}</text>
</svg>'''
    (target_root / "brandmark.svg").write_text(svg, encoding="utf-8")


TRADE_MEDIA = {
    "Drainage": ["generated-drainage-french-drain", "generated-drainage-yard", "generated-drainage-downspout"],
    "Crawlspace": ["generated-crawlspace-encapsulation", "generated-crawlspace-inspection", "generated-crawlspace-dehumidifier"],
    "Retaining walls": ["generated-wall-new", "generated-wall-stone", "generated-wall-repair"],
    "Fencing": ["generated-fence-new", "generated-fence-wood", "generated-fence-gate"],
    "Pool service": ["generated-pool-cleaning", "generated-pool-equipment", "generated-pool-inspection"],
    "Painting": ["generated-painting-interior", "generated-painting-exterior", "generated-painting-commercial"],
    "Backyard construction": ["generated-backyard-design", "generated-backyard-hardscape", "generated-backyard-patio"],
}


def prepare_trade_media(config: dict, target_root: Path) -> bool:
    names = TRADE_MEDIA.get(config.get("trade"), [])
    sources = [STOCK_ASSETS / f"{name}.webp" for name in names]
    if not sources or not all(source.is_file() for source in sources):
        return False
    media_root = target_root / "media"
    media_root.mkdir(parents=True, exist_ok=True)
    local = []
    for index, source in enumerate(sources, start=1):
        destination = media_root / f"representative-{index}.webp"
        shutil.copy2(source, destination)
        local.append(destination.relative_to(target_root).as_posix())
    config["hero"] = local[0]
    config["images"] = [local[0], local[1], local[2], local[1]]
    config["representative_media"] = True
    return True


def write_placeholder_media(config: dict, target_root: Path) -> None:
    media_root = target_root / "media"
    media_root.mkdir(parents=True, exist_ok=True)
    labels = ["Hero photo pending", "Project photo pending", "Detail photo pending", "Process photo pending", "Team photo pending"]
    files = ["hero-placeholder.svg", *[f"project-placeholder-{index}.svg" for index in range(1, 5)]]
    family = config.get("source_id", "horizonfix")
    family_art = {
        "horizonfix": '<path d="M-80 760C260 450 520 930 900 540s650-120 820-360v900H-80Z" fill="#ffffff" opacity=".10"/><path d="M-40 860C340 610 570 1030 1010 650s620-80 760-250" fill="none" stroke="{accent}" stroke-width="38" opacity=".72"/>',
        "minuteman": '<rect x="0" y="0" width="520" height="1000" fill="#071b39"/><rect x="520" y="0" width="92" height="1000" fill="{accent}"/><path d="M720 140h720M720 330h540M720 520h650M720 710h480" stroke="#fff" stroke-width="24" opacity=".18"/>',
        "pinks-concrete": '<rect x="110" y="120" width="640" height="760" rx="42" fill="#fff" opacity=".12"/><rect x="810" y="210" width="620" height="250" rx="32" fill="{accent}" opacity=".45"/><rect x="810" y="520" width="450" height="290" rx="32" fill="#fff" opacity=".16"/>',
        "roofrightnow": '<path d="M0 170 310 0l260 160L850 0l300 190L1430 0l170 110v890H0Z" fill="#fff" opacity=".08"/><path d="M0 720 390 430l280 210 330-310 600 430" fill="none" stroke="{accent}" stroke-width="34" opacity=".65"/>',
        "welborn-garage": '<path d="M0 0h840L420 1000H0Z" fill="#050505"/><path d="M690 0h310L580 1000H270Z" fill="{accent}" opacity=".9"/><path d="M1040 120h420v140h-420zm0 250h420v140h-420zm0 250h420v140h-420z" fill="#fff" opacity=".18"/>',
        "cincinnati-painting": '<path d="M-40 260C300 40 460 420 820 170s530 110 850-80" fill="none" stroke="{accent}" stroke-width="150" opacity=".55"/><path d="M-70 700C260 500 520 850 900 620s520 60 780-130" fill="none" stroke="#fff" stroke-width="96" opacity=".18"/>',
        "nextgen-windows": '<rect x="150" y="110" width="1300" height="780" rx="24" fill="#f8fbff" opacity=".18"/><path d="M800 110v780M150 500h1300" stroke="#fff" stroke-width="28" opacity=".42"/><path d="M190 150h570v310H190z" fill="{accent}" opacity=".22"/>',
        "trips-windows-small": '<circle cx="1190" cy="230" r="190" fill="{accent}" opacity=".48"/><path d="M0 740C310 520 500 620 760 430s520-160 840-30v600H0Z" fill="#fff" opacity=".44"/><path d="M0 810C390 600 610 780 940 560s490-120 660-20" fill="none" stroke="#20579a" stroke-width="24" opacity=".55"/>',
        "trips-windows-full": '<rect x="120" y="100" width="1360" height="800" rx="54" fill="#fff" opacity=".10"/><path d="M573 100v800M1027 100v800M120 500h1360" stroke="#fff" stroke-width="18" opacity=".28"/><circle cx="1260" cy="275" r="150" fill="{accent}" opacity=".62"/>',
    }.get(family, '')
    for index, (filename, label) in enumerate(zip(files, labels)):
        shade = 17 + index * 4
        art = family_art.format(accent=config["accent"])
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" role="img" aria-labelledby="title desc">
  <title id="title">{html.escape(label)}</title>
  <desc id="desc">Clone-family staging placeholder for {html.escape(config["brand"])}.</desc>
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(215 24% {shade}%)"/><stop offset="1" stop-color="hsl(210 18% {shade + 15}%)"/></linearGradient></defs>
  <rect width="1600" height="1000" fill="url(#bg)"/>
  {art}
  <rect x="72" y="820" width="710" height="112" rx="18" fill="#fff" opacity=".92"/>
  <rect x="72" y="820" width="18" height="112" rx="9" fill="{config["accent"]}"/>
  <text x="124" y="868" font-family="Arial, sans-serif" font-size="30" font-weight="800" fill="#101820">{html.escape(config["brand"])}</text>
  <text x="124" y="908" font-family="Arial, sans-serif" font-size="24" fill="#475569">{html.escape(label)}</text>
</svg>'''
        (media_root / filename).write_text(svg, encoding="utf-8")


def write_staging_handoff(config: dict, target_root: Path) -> None:
    (target_root / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
    (target_root / "_headers").write_text("/*\n  X-Robots-Tag: noindex, nofollow\n", encoding="utf-8")
    manifest = {
        "schemaVersion": 1,
        "stage": "staging",
        "site": {"slug": config["target"], "displayName": config["brand"], "domain": config["domain"], "trade": config["trade"], "location": config["location"]},
        "sourceAdoption": {"package": config["sourceLabel"], "homepageExport": str((config["source"] / "index.html").resolve()), "preserved": ["homepage DOM and classes", "local CSS/JS/fonts", "section order", "source breakpoints"]},
        "brand": {"status": "approved-board-extract", "sourceBoard": SITE_RECORDS.get(config["target"].lower(), {}).get("brandSystem", {}).get("boardFile"), "wordmarkFile": "brandmark.svg", "logoFile": "brandmark.png", "iconFile": "brand-icon.png", "faviconFile": "favicon.png"},
        "photos": {"status": "representative-stock" if config.get("representative_media") else "target-supplied", "disclosure": "Representative imagery is not presented as completed work by this operator." if config.get("representative_media") else None, "slots": [{"file": config["hero"], "role": "hero"}, *[{"file": value, "role": "representative" if config.get("representative_media") else "project"} for value in config["images"]]]},
        "reviews": {"status": "interim-copy", "items": config.get("reviews", [])},
        "phone": {"status": SITE_RECORDS.get(config["target"].lower(), {}).get("contact", {}).get("phoneStatus", "not-configured"), "display": config.get("phone"), "tel": config.get("tel")},
        "address": {"status": "pending-verified-intake", "value": None},
        "gbp": {"status": "pending-verified-intake", "url": None},
        "claims": {"status": "pending-verified-intake", "credentials": [], "awards": [], "warranties": []},
        "intake": {"status": "pending-production-endpoint", "stagingMode": "mailto", "email": config["email"], "storesSubmissions": False},
        "indexing": {"status": "blocked-for-staging", "metaRobots": "noindex,nofollow", "robotsTxt": "Disallow: /", "xRobotsTag": "noindex, nofollow"},
    }
    (target_root / "content-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def replace_terms(text: str, config: dict) -> str:
    value = text
    for source_name in sorted(config["source_names"], key=len, reverse=True):
        value = re.sub(re.escape(source_name), config["brand"], value, flags=re.I)
    value = PHONE_RE.sub(config["phone"], value)
    value = EMAIL_RE.sub(config["email"], value)
    for old in sorted(config["terms"], key=len, reverse=True):
        new = config["terms"][old]
        value = re.sub(re.escape(old), new, value, flags=re.I)
    value = re.sub(
        r"\bcall for\s+(?:crawlspace|fences?|backyard construction)\b",
        "Request an assessment",
        value,
        flags=re.I,
    )
    value = ARROW_RE.sub("", value)
    value = value.replace("★★★★★", "Five-star review").replace("★★★★", "Four-star review").replace("✓", "")
    return value


def service_area_label(config: dict) -> str:
    location = config.get("location")
    if not location:
        record = SITE_RECORDS.get(config["target"].lower(), {})
        city = record.get("city")
        state = record.get("state")
        location = ", ".join(value for value in (city, state) if value)
    return f"Serving {location}" if location else "Service area information"


def append_review_section(soup: BeautifulSoup, config: dict) -> None:
    reviews = config.get("reviews") or SAMPLE_REVIEWS.get(config.get("trade"), SAMPLE_REVIEWS["Drainage"])
    for old in soup.select("[data-llg-reviews]"):
        old.decompose()
    section = soup.new_tag("section")
    section["class"] = "llg-review-section"
    section["data-llg-reviews"] = ""
    inner = soup.new_tag("div")
    inner["class"] = "llg-review-inner"
    eyebrow = soup.new_tag("p")
    eyebrow["class"] = "llg-review-eyebrow"
    eyebrow.string = config["brand"]
    heading = soup.new_tag("h2")
    heading.string = "What customers say"
    grid = soup.new_tag("div")
    grid["class"] = "llg-review-grid"
    names = ("Michael R.", "Amanda K.", "Jordan T.")
    for index, review in enumerate(reviews[:3]):
        quote = soup.new_tag("blockquote")
        quote["class"] = "llg-review-card"
        copy = soup.new_tag("p")
        copy.string = review
        attribution = soup.new_tag("footer")
        attribution.string = names[index % len(names)]
        quote.extend((copy, attribution))
        grid.append(quote)
    inner.extend((eyebrow, heading, grid))
    section.append(inner)
    main = soup.find("main") or soup.body
    main.append(section)


def replace_visible_text(soup: BeautifulSoup, replacements: dict[str, str]) -> None:
    for node in list(soup.find_all(string=True)):
        if isinstance(node, Comment) or node.parent.name in ("script", "style"):
            continue
        value = str(node)
        for old, new in replacements.items():
            value = re.sub(re.escape(old), new, value, flags=re.I)
        if value != str(node):
            node.replace_with(value)


def cleanup_target_content(soup: BeautifulSoup, config: dict) -> None:
    """Remove remaining visible source facts without changing adopted structure or classes."""
    domain = config["domain"]
    if soup.html.has_attr("data-wf-domain"):
        soup.html["data-wf-domain"] = f"www.{domain}"

    media_type = {
        ".png": "image/png",
        ".webp": "image/webp",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
    }.get(Path(urlsplit(config["hero"]).path).suffix.lower(), "image/jpeg")
    metadata = {
        ("property", "og:title"): config["title"],
        ("property", "og:description"): config["description"],
        ("property", "og:url"): f"https://{domain}",
        ("property", "og:site_name"): config["brand"],
        ("property", "og:image"): config["hero"],
        ("property", "og:image:alt"): f"{config['brand']} project",
        ("property", "og:image:type"): media_type,
        ("name", "twitter:title"): config["title"],
        ("name", "twitter:description"): config["description"],
        ("name", "twitter:image"): config["hero"],
        ("name", "twitter:image:alt"): f"{config['brand']} project",
        ("name", "twitter:image:type"): media_type,
    }
    for (attribute, key), value in metadata.items():
        tags = soup.find_all("meta", attrs={attribute: key})
        if not tags:
            tag = soup.new_tag("meta")
            tag[attribute] = key
            soup.head.append(tag)
            tags = [tag]
        for tag in tags:
            tag["content"] = value

    target = config["target"]
    if target == "connecticut-drain-pros":
        stats = ["Site", "Plan", "Route", "Flow"]
        labels = ["Property assessment", "Clear recommendation", "Careful installation", "Final walkthrough"]
        for index, value in enumerate(stats):
            tag = soup.select_one(f".counter-{index}")
            if tag:
                tag.string = value
                label = tag.find_next_sibling("p")
                if label:
                    label.string = labels[index]
        replace_visible_text(soup, {"draining": "drainage", "drainers": "drainage specialists", "Greater Connecticut MA": "Greater Connecticut"})

    if target == "dallas-drain-guys":
        location_map = {
            "Abington": "Addison", "Allston": "Allen", "Arlington": "Arlington", "Back Bay": "Bishop Arts",
            "Beacon Hill": "Casa Linda", "Belmont": "Carrollton", "Braintree": "Cedar Hill", "Brighton": "Coppell",
            "Brookline": "Dallas", "Charlestown": "DeSoto", "Chestnut Hill": "Duncanville", "Cohasset": "Farmers Branch",
            "East Bridgewater": "Flower Mound", "Halifax": "Frisco", "Hanover": "Garland", "Hanson": "Grand Prairie",
            "Holbrook": "Highland Park", "Lexington": "Irving", "Marshfield": "Lake Highlands", "Medford": "Las Colinas",
            "Milton": "Lewisville", "Newton": "McKinney", "Norwell": "Mesquite", "Quincy": "North Dallas",
            "Rockland": "Oak Cliff", "Scituate": "Plano", "Somerville": "Richardson", "South Boston": "South Dallas",
            "South End": "University Park", "Waltham": "The Colony", "Watertown": "Uptown", "Weymouth": "West Dallas",
            "Whitman": "Westlake",
        }
        replace_visible_text(soup, location_map)
        replace_visible_text(soup, {
            "Kitchen & Bathroom Fixtures": "Channel and trench drains",
            "Leak Detection": "Drainage diagnosis",
            "Pipe Repair": "Buried drainage pipe",
            "Sump Pumps": "Sump pump drainage",
            "Water Filtration": "Downspout drainage",
            "Gas Fittings": "Stormwater control",
            "Heat Pumps": "Foundation drainage",
            "AC Repair": "French drain installation",
            "AC Installation": "Yard drainage installation",
            "AC Maintenance": "Drainage maintenance",
            "Ductless Mini Splits": "Channel drain installation",
            "Home Protection Plan": "Drainage assessment",
            "Service Scalers": "Dallas Drain Guys",
            "powered by": "Built for",
        })
        for tag in soup.select(".text-info-footer"):
            if re.search(r"Garden Street|Recreation Park|Suite\s*#?4|\bMA\s+0\d{4}", tag.get_text(" ", strip=True), re.I):
                tag.clear()
                tag.string = "Serving Dallas-Fort Worth, Texas"

    if target == "louisville-precision-walls":
        nav = soup.select_one("header .main-nav > ul")
        if nav:
            labels = ["Wall systems", "Why us", "Process"]
            for item, label in zip(nav.find_all("li", recursive=False), labels):
                anchor = item.find("a", recursive=False)
                if anchor:
                    anchor.string = label
        phone = soup.select_one("header .header-phone")
        if phone:
            phone.string = f"Call {config['phone']}"

    if target == "morgantown-fence-pros":
        replace_visible_text(soup, {
            "Morgantown, TX": "Morgantown, WV",
            "5-Star fence Company": "Local fence company",
            "Award Winning fence Services": "Professional fence services",
            "Best fence Installations and Replacements": "Fence installations and replacements",
            "Your Highest Rated, Local fence Company": "Your local fence company",
            "The Original Full Service fence Company": "Full-service fence company",
            "Ratings and Awards:": "Customer priorities:",
            "Look for high ratings and industry awards, which indicate reliable service and customer satisfaction.": "Look for clear communication, durable materials and workmanship suited to your property.",
        })

    if target == "Pittsburgh-French-Drain-Site":
        replace_visible_text(soup, {"drain Replacement": "French drain installation", "drain Repair": "Drainage repair", "drain Estimate": "Drainage estimate"})


def is_tracking_script(tag) -> bool:
    src = " ".join(str(value) for value in tag.attrs.values()).lower()
    body = tag.get_text(" ", strip=True).lower()
    blocked = ("googletag", "google-analytics", "gtag(", "facebook", "fbq(", "clickcease", "hotjar", "callrail", "clarity", "doubleclick", "leadconnector", "linkedin", "lintrk", "analytics.min", "wp-admin/admin-ajax")
    return any(term in src or term in body for term in blocked)


def make_override_css(config: dict) -> str:
    hero = config["hero"].replace("'", "%27")
    return f'''/* Target substitutions layered over the adopted clone stylesheet. */
:root {{ --target-accent: {config["accent"]}; --target-ink: #101820; }}
html {{ scroll-behavior: smooth; overflow-x: hidden; }}
body {{ overflow-x: hidden; font-family: {config["font"]}; }}
img {{ max-width: 100%; height: auto; }}
a, button, input, select, textarea, summary {{ outline-offset: 4px; }}
:focus-visible {{ outline: 3px solid var(--target-accent) !important; box-shadow: 0 0 0 3px #fff !important; }}
.clone-skip {{ position: fixed; z-index: 2147483647; left: 1rem; top: -5rem; background: #fff; color: #111; padding: .75rem 1rem; font-weight: 800; }}
.clone-skip:focus {{ top: 1rem; }}
.clone-wordmark {{ display: inline-flex; align-items: center; min-width: 180px; max-width: 260px; }}
.clone-wordmark img {{ display: block; width: 100%; height: auto; }}
header .elementor-widget-image {{ overflow: visible !important; transform: none !important; }}
header img[src$="brandmark.svg"] {{ display: block !important; width: 100% !important; max-width: 260px !important; height: auto !important; margin: 0 auto !important; object-fit: contain !important; object-position: center !important; transform: none !important; clip-path: none !important; }}
.clone-field-label {{ display: block; margin: 0 0 .35rem; color: inherit; font: 700 .8rem/1.2 {config["font"]}; }}
.clone-staging-notice {{ width: 100%; margin: 0 0 .75rem; padding: .65rem .8rem; border: 1px solid currentColor; border-radius: .25rem; font: 600 .78rem/1.35 {config["font"]}; }}
.llg-review-section {{ padding: clamp(3.5rem, 7vw, 6.5rem) 1rem; background: #f7f7f5; color: #101820; }}
.llg-review-inner {{ width: min(76rem, 100%); margin: 0 auto; }}
.llg-review-eyebrow {{ margin: 0 0 .65rem; color: var(--target-accent); font: 800 .78rem/1.2 {config["font"]}; letter-spacing: .14em; text-transform: uppercase; }}
.llg-review-section h2 {{ margin: 0 0 1.5rem; font-size: clamp(2rem, 5vw, 4rem); line-height: 1; }}
.llg-review-grid {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }}
.llg-review-card {{ margin: 0; padding: clamp(1.25rem, 2vw, 2rem); border-top: 4px solid var(--target-accent); background: #fff; box-shadow: 0 14px 34px rgba(16,24,32,.10); }}
.llg-review-card p {{ margin: 0 0 1.25rem; font-size: 1rem; line-height: 1.65; }}
.llg-review-card footer {{ font-weight: 800; }}
.hero, [class*="hero"], [class*="Hero"] {{ --target-hero-image: url("{hero}"); }}
.hero {{ background-image: linear-gradient(90deg, rgba(7,18,29,.72), rgba(7,18,29,.2)), var(--target-hero-image); background-size: cover; background-position: center; }}
[class*="cookie"], [id*="cookie"], [class*="chat"], [id*="chat"], [class*="popup"], [class*="Popup"], iframe {{ display: none !important; }}
[id^="cd-"] {{ font-size: 0 !important; color: transparent !important; }}
[id^="cd-"]::after {{ content: "--"; font-size: 1rem; color: #101820; }}
[class*="testimonial"] svg, [class*="rating"] svg, [class*="reviews"] svg {{ visibility: hidden !important; }}
form input, form select, form textarea, form button {{ min-height: 44px; }}
form textarea {{ min-height: 96px; }}
@media (max-width: 767px) {{
  .clone-wordmark {{ min-width: 130px; max-width: 190px; }}
  body {{ min-width: 0; }}
  h1 {{ overflow-wrap: anywhere; }}
  .llg-review-grid {{ grid-template-columns: 1fr; }}
}}
@media (prefers-reduced-motion: reduce) {{
  *, *::before, *::after {{ scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }}
}}
'''


def adapt(config: dict) -> None:
    config.setdefault("reviews", SAMPLE_REVIEWS.get(config.get("trade"), SAMPLE_REVIEWS["Drainage"]))
    source_root = config["source"]
    target_root = ROOT / config["target"]
    source_html = source_root / "index.html"
    if not source_html.is_file():
        raise FileNotFoundError(source_html)

    target_root.mkdir(parents=True, exist_ok=True)
    if config.get("staging_manifest"):
        if not prepare_trade_media(config, target_root):
            write_placeholder_media(config, target_root)
        write_staging_handoff(config, target_root)
    copy_runtime(source_root, target_root)
    wordmark_svg(config, target_root)

    soup = BeautifulSoup(source_html.read_text(encoding="utf-8", errors="ignore"), "html.parser")
    soup.html["lang"] = "en"

    stylesheet_hrefs = [str(tag.get("href")) for tag in soup.select('link[rel="stylesheet"]') if tag.get("href")]

    for comment in soup.find_all(string=lambda value: isinstance(value, Comment)):
        comment.extract()
    for tag in list(soup.find_all("script")):
        src = str(tag.get("src", ""))
        script_type = str(tag.get("type", "")).lower()
        body = tag.get_text(" ", strip=True)
        if config.get("staging_manifest") and any(timer_id in body for timer_id in ("cd-days", "cd-hours", "cd-minutes", "cd-seconds")):
            tag.decompose()
            continue
        if is_tracking_script(tag) or "ld+json" in script_type or src.startswith(("http://", "https://")):
            tag.decompose()
            continue
        if src:
            if not local_source_path(source_root, src):
                tag.decompose()
                continue
            tag["src"] = rewrite_asset_url(source_root, src)
        elif len(body) > 500 or any(name.lower() in body.lower() for name in config["source_names"]):
            # Large inline payloads contain source application data and would re-hydrate source copy.
            # Local runtime files stay adopted; the static source DOM remains the rendering basis.
            tag.decompose()
    for tag in list(soup.find_all("link")):
        if tag.attrs is None:
            continue
        href = tag.get("href")
        if href:
            rel = " ".join(tag.get("rel", [])).lower()
            if ("preconnect" in rel or "dns-prefetch" in rel) and str(href).startswith(("http://", "https://", "//")):
                tag.decompose()
                continue
            if ("stylesheet" in rel or "preload" in rel or "modulepreload" in rel) and not local_source_path(source_root, href):
                tag.decompose()
                continue
            tag["href"] = rewrite_asset_url(source_root, href)

    for tag in list(soup.find_all("meta")):
        if tag.attrs is None:
            continue
        marker = f"{tag.get('name', '')} {tag.get('property', '')} {tag.get('http-equiv', '')}".lower()
        if any(term in marker for term in ("domain-verification", "site-verification", "facebook-domain", "google-site", "msvalidate")):
            tag.decompose()

    for tag in soup.find_all(True):
        for attribute in [name for name in tag.attrs if str(name).lower().startswith("on")]:
            tag.attrs.pop(attribute, None)
        for attr, raw in list(tag.attrs.items()):
            if isinstance(raw, list):
                continue
            value = str(raw)
            if attr in {"content", "data-wf-domain", "data-name", "title", "aria-label", "placeholder"}:
                value = replace_terms(value, config)
                if IMAGE_RE.search(urlsplit(value).path):
                    value = config["images"][0]
                tag[attr] = value

    for tag in list(soup.find_all(["iframe", "noscript"])):
        tag.decompose()
    for tag in list(soup.find_all("source")):
        # Each responsive source belongs to source photography; the target img fallback carries explicit dimensions.
        tag.decompose()

    for canonical in soup.select('link[rel="canonical"]'):
        canonical.decompose()
    for meta in soup.select('meta[name="robots"]'):
        meta.decompose()
    robots = soup.new_tag("meta")
    robots["name"] = "robots"
    robots["content"] = "noindex,nofollow"
    soup.head.append(robots)
    if soup.title:
        soup.title.string = config["title"]
    else:
        title = soup.new_tag("title")
        title.string = config["title"]
        soup.head.append(title)
    description = soup.find("meta", attrs={"name": "description"})
    if not description:
        description = soup.new_tag("meta")
        description["name"] = "description"
        soup.head.append(description)
    description["content"] = config["description"]
    og_title = soup.find("meta", attrs={"property": "og:title"})
    if not og_title:
        og_title = soup.new_tag("meta")
        og_title["property"] = "og:title"
        soup.head.append(og_title)
    og_title["content"] = config["title"]
    og_description = soup.find("meta", attrs={"property": "og:description"})
    if not og_description:
        og_description = soup.new_tag("meta")
        og_description["property"] = "og:description"
        soup.head.append(og_description)
    og_description["content"] = config["description"]

    # Remove source favicons and substitute a target-owned wordmark anywhere a source logo/badge was rendered.
    for tag in list(soup.find_all("link")):
        rel = " ".join(tag.get("rel", [])).lower()
        if "icon" in rel:
            tag.decompose()

    photos = iter(config["images"] * 1000)
    for image in soup.find_all("img"):
        raw = str(image.get("src", ""))
        marker = (raw + " " + str(image.get("alt", "")) + " " + " ".join(image.get("class", []))).lower()
        if any(word in marker for word in ("logo", "badge", "award", "favicon", "icon", "spinner", "pixel")):
            image["src"] = "brandmark.svg"
            image["alt"] = config["brand"]
            image["width"] = "520"
            image["height"] = "160"
        else:
            replacement = next(photos)
            image["src"] = replacement
            image["alt"] = f"Representative {config.get('trade', 'property service').lower()} imagery" if config.get("representative_media") else f"{config['brand']} project"
            width, height = image_dimensions(target_root, replacement)
            image["width"] = str(width)
            image["height"] = str(height)
        image.attrs.pop("srcset", None)
        image.attrs.pop("sizes", None)
        image["loading"] = image.get("loading", "lazy")
        image["decoding"] = "async"

    # A few Webflow exports draw the operator logo as inline vector paths instead
    # of an <img>. Keep the adopted logo container and sizing, but swap only the
    # vector artwork for the target's local placeholder wordmark.
    for container in soup.find_all(class_=lambda value: value and "logo" in " ".join(value if isinstance(value, list) else [value]).lower()):
        for source_logo in list(container.find_all("svg")):
            wordmark = soup.new_tag("img", src="brandmark.svg", alt=config["brand"])
            wordmark["width"] = "520"
            wordmark["height"] = "160"
            wordmark["loading"] = "eager"
            wordmark["decoding"] = "async"
            source_logo.replace_with(wordmark)

    photo_index = 0
    for tag in soup.find_all(style=True):
        style = str(tag["style"])
        if "url(" in style and IMAGE_RE.search(style.split("url(", 1)[1].split(")", 1)[0].strip(" '\"")):
            replacement = config["images"][photo_index % len(config["images"])]
            photo_index += 1
            style = re.sub(r"url\((['\"]?)[^)]*?\.(?:avif|gif|jpe?g|png|webp)(?:[?#][^)]*)?\1\)", f'url("{replacement}")', style, flags=re.I)
            tag["style"] = style
    for tag in soup.find_all("style"):
        if tag.string:
            tag.string.replace_with(
                re.sub(r"content\s*:\s*(['\"])\\(?:2190|2192|260e)\s*;?\1", r"content:\1\1", tag.string.replace("✓", "").replace("→", "").replace("←", ""), flags=re.I)
            )

    # Contact routes and local navigation are changed without replacing the clone's elements or class system.
    nav_index = 0
    subnav_index = 0
    for anchor in soup.find_all("a"):
        href = str(anchor.get("href", ""))
        if href.startswith("tel:"):
            anchor["href"] = f"tel:{config['tel']}" if config.get("tel") else f"mailto:{config['email']}"
        elif href.startswith("mailto:"):
            anchor["href"] = f"mailto:{config['email']}"
        elif href.startswith(("http://", "https://")):
            anchor["href"] = "#contact"
            anchor.attrs.pop("target", None)
        elif href and not href.startswith("#") and not href.startswith("javascript:"):
            anchor["href"] = "#contact"
        if anchor.find_parent(["nav", "header"]) and anchor.get_text(" ", strip=True):
            # Image-only brand anchors retain their image. Text navigation gets target labels in the same slots.
            if not anchor.find("img") and len(anchor.get_text(" ", strip=True)) < 60:
                classes = " ".join(anchor.get("class", []))
                parent_classes = " ".join(
                    value for parent in anchor.parents if getattr(parent, "attrs", None)
                    for value in parent.get("class", [])
                )
                if "sub-item" in classes or "sub-menu" in parent_classes:
                    anchor.string = config["h3"][subnav_index % len(config["h3"])]
                    subnav_index += 1
                else:
                    anchor.string = config["nav"][nav_index % len(config["nav"])]
                    nav_index += 1

    for form_index, form in enumerate(soup.find_all("form")):
        form["action"] = f"mailto:{config['email']}"
        form["method"] = "post"
        form["enctype"] = "text/plain"
        form["data-staging-form"] = "true"
        form.attrs.pop("data-wf-page-id", None)
        form.attrs.pop("data-wf-element-id", None)
        if not form.get("id"):
            form["id"] = "contact" if form_index == 0 else f"contact-{form_index + 1}"
        form["aria-describedby"] = f"{form['id']}-staging-note"
        note = soup.new_tag("p")
        note["class"] = "clone-staging-notice"
        note["id"] = f"{form['id']}-staging-note"
        note.string = "Submit the project details below and the team will follow up using the contact information provided."
        form.insert(0, note)
    for control in list(soup.select('input[type="hidden"]')):
        control.decompose()
    for control in soup.find_all(["input", "select", "textarea"]):
        control.attrs.pop("value", None) if control.name != "input" or control.get("type") not in ("hidden", "submit") else None
        label = control.get("aria-label") or control.get("placeholder") or control.get("name") or "Project information"
        control["aria-label"] = replace_terms(str(label).replace("_", " ").title(), config)
        existing_label = soup.find("label", attrs={"for": control.get("id")}) if control.get("id") else None
        if control.get("type") not in ("hidden", "submit", "button", "checkbox", "radio") and not control.find_parent("label") and not existing_label:
            visible = soup.new_tag("span")
            visible["class"] = "clone-field-label"
            visible.string = control["aria-label"]
            control.insert_before(visible)

    headings = {tag: iter(config.get(tag, config["h3"]) * 100) for tag in ("h1", "h2", "h3", "h4", "h5", "h6")}
    for tag_name, values in headings.items():
        for tag in soup.find_all(tag_name):
            tag.clear()
            tag.string = next(values)

    review_index = 0
    paragraph_index = 0
    for tag in soup.find_all(["blockquote", "p"]):
        original = " ".join(tag.get_text(" ", strip=True).split())
        if len(original) < 42:
            continue
        if tag.name == "blockquote" or any(term in " ".join(tag.get("class", [])).lower() for term in ("review", "testimonial")):
            value = config.get("reviews", config["paragraphs"])[review_index % len(config.get("reviews", config["paragraphs"]))]
            review_index += 1
        else:
            value = config["paragraphs"][paragraph_index % len(config["paragraphs"])]
            paragraph_index += 1
        tag.clear()
        tag.string = value

    for node in list(soup.find_all(string=True)):
        if not isinstance(node, NavigableString) or isinstance(node, Comment) or node.parent.name in ("script", "style"):
            continue
        original = str(node)
        replaced = replace_terms(original, config)
        if "@" in replaced and node.parent.name not in ("script", "style"):
            replaced = config["email"]
        if len(" ".join(replaced.split())) > 110 and node.parent.name not in ("script", "style", "h1", "h2", "h3"):
            replaced = config["paragraphs"][paragraph_index % len(config["paragraphs"])]
            paragraph_index += 1
        if replaced != str(node):
            node.replace_with(replaced)

    if config.get("source_id") == "nextgen-windows":
        timer_copy = {
            "cd-days": ("--", "Details"),
            "cd-hours": ("--", "Project"),
            "cd-minutes": ("--", "Until"),
            "cd-seconds": ("--", "Launch"),
        }
        for timer_id, (value, label) in timer_copy.items():
            counter = soup.find(id=timer_id)
            if not counter:
                continue
            counter.string = value
            timer_label = counter.find_next_sibling(class_="timer-label")
            if timer_label:
                timer_label.string = label

    if config.get("staging_manifest"):
        street_re = re.compile(r"\b\d{1,6}\s+[A-Z0-9][A-Z0-9 .'-]{1,50}\s(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way)(?:\s*,?\s*(?:suite|ste|unit)\s*#?[A-Z0-9-]+)?(?:\s*,?\s*[A-Z .'-]+,?\s*[A-Z]{2}\s*\d{5})?", re.I)
        postal_re = re.compile(r"\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b")
        for address in soup.find_all("address"):
            address.clear()
            address.string = service_area_label(config)
        for node in list(soup.find_all(string=True)):
            if not isinstance(node, NavigableString) or isinstance(node, Comment) or node.parent.name in ("script", "style"):
                continue
            value = str(node)
            ancestor = node.parent
            marker = ""
            while ancestor and ancestor.name not in ("body", "html"):
                marker += " " + " ".join(ancestor.get("class", [])) + " " + str(ancestor.get("id", ""))
                ancestor = ancestor.parent
            if re.search(r"review|testimonial|rating", marker, re.I) and value.strip() and node.parent.name not in ("h1", "h2", "h3", "h4", "h5", "h6"):
                node.replace_with(config["reviews"][review_index % len(config["reviews"])])
                review_index += 1
                continue
            cleaned = street_re.sub(service_area_label(config), value)
            cleaned = re.sub(r"\b(?:4\.[0-9]|5\.0)\s*(?:/\s*5|stars?)\b", "Customer reviews", cleaned, flags=re.I)
            cleaned = re.sub(r"\b(?:hundreds|thousands|\d+[+]?)\s+of\s+(?:happy\s+)?customers\b", "local customers", cleaned, flags=re.I)
            if cleaned != value:
                node.replace_with(cleaned)
        for tag in list(soup.find_all(["address", "p", "span", "a", "li"])):
            if tag.attrs is None:
                continue
            value = tag.get_text(" ", strip=True)
            if not postal_re.search(value):
                continue
            if tag.find(True):
                continue
            tag.clear()
            tag.string = service_area_label(config)

    icon_paths = {
        "menu": "M4 6h16M4 12h16M4 18h16",
        "arrow": "M5 12h14M13 6l6 6-6 6",
    }
    for control in soup.find_all(["button", "a"]):
        label = control.get_text(" ", strip=True)
        icon_kind = "menu" if "☰" in label else "arrow" if "»" in label else None
        if not icon_kind:
            continue
        for node in list(control.find_all(string=True)):
            node.replace_with(str(node).replace("☰", "").replace("»", ""))
        svg = soup.new_tag("svg", viewBox="0 0 24 24")
        svg["aria-hidden"] = "true"
        svg["width"] = "24"
        svg["height"] = "24"
        svg["fill"] = "none"
        svg["stroke"] = "currentColor"
        svg["stroke-width"] = "2"
        path = soup.new_tag("path", d=icon_paths[icon_kind])
        svg.append(path)
        control.append(svg)
    for tag in soup.find_all(True):
        for attr in ("alt", "title", "aria-label", "placeholder"):
            if tag.has_attr(attr):
                tag[attr] = replace_terms(str(tag[attr]), config)

    cleanup_target_content(soup, config)
    append_review_section(soup, config)

    main = soup.find("main") or soup.body
    if not main.get("id"):
        main["id"] = "main-content"
    skip = soup.new_tag("a", href=f"#{main['id']}")
    skip["class"] = "clone-skip"
    skip.string = "Skip to content"
    soup.body.insert(0, skip)

    # Some optimized WordPress exports expose essential stylesheet links through malformed
    # loader markup. Re-append the source stylesheet list in its original order so browser
    # parsing cannot drop Elementor/Astra geometry.
    existing_styles = {str(tag.get("href")) for tag in soup.select('link[rel="stylesheet"]')}
    for raw_href in stylesheet_hrefs:
        if not local_source_path(source_root, raw_href):
            continue
        href = rewrite_asset_url(source_root, raw_href)
        if href in existing_styles:
            continue
        source_link = soup.new_tag("link", rel="stylesheet", href=href)
        soup.head.append(source_link)
        existing_styles.add(href)

    favicon = soup.new_tag("link", rel="icon", href="favicon.png" if (target_root / "favicon.png").is_file() else "brandmark.svg", type="image/png" if (target_root / "favicon.png").is_file() else "image/svg+xml")
    soup.head.append(favicon)
    override = soup.new_tag("link", rel="stylesheet", href="clone-override.css")
    soup.head.append(override)
    behavior = soup.new_tag("script", src="clone-behavior.js")
    behavior["defer"] = ""
    soup.body.append(behavior)

    (target_root / "clone-override.css").write_text(make_override_css(config), encoding="utf-8")
    (target_root / "clone-behavior.js").write_text(
        """document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('[aria-expanded]').forEach(c=>{c.addEventListener('click',()=>{const open=c.getAttribute('aria-expanded')!=='true';c.setAttribute('aria-expanded',String(open));});});document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',()=>{const menu=a.closest('details');if(menu)menu.open=false;}));});\n""",
        encoding="utf-8",
    )
    (target_root / "index.html").write_text("<!doctype html>\n" + str(soup), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Adopt supplied clone homepages for LLG staging sites.")
    parser.add_argument("--remaining", action="store_true", help="Generate the 24 JSON-driven remaining-wave sites only.")
    parser.add_argument("--all", action="store_true", help="Generate the preserved first wave and the remaining wave.")
    parser.add_argument("--site", help="Generate one target slug from the selected wave.")
    args = parser.parse_args()
    selected = CONFIGS
    if args.remaining:
        selected = load_remaining_configs()
    elif args.all:
        selected = [*CONFIGS, *load_remaining_configs()]
    if args.site:
        selected = [item for item in selected if item["target"].lower() == args.site.lower()]
        if not selected:
            parser.error(f"unknown target slug: {args.site}")
    for item in selected:
        site_record = SITE_RECORDS.get(item["target"].lower())
        if site_record:
            item["accent"] = site_record["brandSystem"]["colors"]["accent"]
            item["font"] = site_record["brandSystem"]["typography"]["body"]["fallback"]
            item.setdefault("trade", site_record["trade"])
            item.setdefault("location", f"{site_record['city']}, {site_record['state']}")
            phone_ready = site_record["contact"].get("phoneStatus") in {"callrail-active", "callrail-shared"}
            if not phone_ready:
                item["phone"] = "Request service online"
                item["tel"] = None
        adapt(item)
        print(f"adapted {item['target']} from {item['source'] / 'index.html'}")
