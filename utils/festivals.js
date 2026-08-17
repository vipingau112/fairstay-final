const { getLiveFestivals } = require("./festivalApi");

/**
 * Keyword -> demand multiplier for festivals coming from the live public
 * holiday feed. This only needs updating if you want to tune *how much*
 * a festival affects price — never for dates, since those come from the API.
 */
const MULTIPLIER_RULES = [
    { keywords: ["diwali", "deepavali"], multiplier: 1.5 },
    { keywords: ["holi"], multiplier: 1.3 },
    { keywords: ["durga puja", "dussehra", "vijayadashami", "navratri"], multiplier: 1.25 },
    { keywords: ["eid"], multiplier: 1.3 },
    { keywords: ["christmas", "new year"], multiplier: 1.25 },
    { keywords: ["raksha bandhan", "janmashtami", "ganesh chaturthi", "onam", "pongal", "makar sankranti", "baisakhi", "gudi padwa"], multiplier: 1.2 },
];
const DEFAULT_HOLIDAY_MULTIPLIER = 1.1; // any other public holiday: mild bump

function multiplierForName(name) {
    const lower = name.toLowerCase();
    for (const rule of MULTIPLIER_RULES) {
        if (rule.keywords.some((kw) => lower.includes(kw))) return rule.multiplier;
    }
    return DEFAULT_HOLIDAY_MULTIPLIER;
}

/**
 * A handful of major pilgrimage/travel-surge events that are NOT standard
 * public holidays, so they don't appear in any holiday API. These genuinely
 * need occasional manual updates (pilgrimage events don't follow a fixed
 * yearly pattern), but they're rare (multi-year gaps) so the upkeep is light.
 * Verified as of Aug 2026 — update if these dates change.
 */
const SPECIAL_EVENTS = [
    {
        // Prayagraj's own annual pilgrimage bathing festival at the Sangam —
        // this app is scoped to Prayagraj, so this is the primary "peak
        // seasonal demand" driver. Local multiplier targets the requested
        // 80–90% price hike during the mela itself.
        name: "Magh Mela (Prayagraj Sangam)",
        startDate: new Date("2027-01-08"),
        endDate: new Date("2027-02-20"),
        multiplier: 1.15,
        localMultiplier: 1.85,
        locationKeywords: ["prayagraj", "allahabad", "sangam", "triveni"],
    },
    {
        name: "Kumbh Mela (Haridwar - Ardh Kumbh)",
        startDate: new Date("2027-01-14"),
        endDate: new Date("2027-04-20"),
        multiplier: 1.4,
        localMultiplier: 2.8,
        locationKeywords: ["haridwar", "rishikesh", "uttarakhand", "dehradun"],
    },
    {
        name: "Kumbh Mela (Nashik - Simhastha)",
        startDate: new Date("2026-10-31"),
        endDate: new Date("2027-08-31"),
        multiplier: 1.2,
        localMultiplier: 2.5,
        locationKeywords: ["nashik", "trimbakeshwar", "maharashtra"],
    },
    {
        name: "Char Dham Yatra Season",
        startDate: new Date("2026-05-01"),
        endDate: new Date("2026-11-15"),
        multiplier: 1.05,
        localMultiplier: 1.6,
        locationKeywords: ["uttarakhand", "badrinath", "kedarnath", "gangotri", "yamunotri", "rishikesh", "haridwar"],
    },
];

function daysBetween(a, b) {
    return Math.abs((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return aStart <= bEnd && aEnd >= bStart;
}

/**
 * Finds the most relevant festival/event for a listing, either:
 *  - within `windowDays` of today (used for the host-side price suggestion tool), or
 *  - overlapping an explicit [rangeStart, rangeEnd] stay (used at checkout)
 *
 * Returns null if nothing relevant is found.
 */
async function getSeasonalInfo(location = "", country = "", options = {}) {
    const { windowDays = 45, rangeStart = null, rangeEnd = null } = options;
    const haystack = `${location} ${country}`.toLowerCase();
    const now = new Date();
    const isIndia = !country || haystack.includes("india");

    const candidates = [];

    // 1. Live public holidays/festivals (auto-updating, no manual dates)
    if (isIndia) {
        const liveFestivals = await getLiveFestivals();
        for (const fest of liveFestivals) {
            const festStart = fest.date;
            const festEnd = fest.date; // single-day events

            const overlapsRange = rangeStart && rangeEnd
                ? rangesOverlap(festStart, festEnd, rangeStart, rangeEnd)
                : null;
            const distanceToNow = daysBetween(now, festStart);

            const relevant = rangeStart && rangeEnd ? overlapsRange : distanceToNow <= windowDays;
            if (!relevant) continue;

            candidates.push({
                name: fest.name,
                startDate: festStart,
                endDate: festEnd,
                multiplier: multiplierForName(fest.name),
                isLocal: false,
                isActive: now >= festStart && now <= festEnd,
                distance: rangeStart ? 0 : distanceToNow,
                source: "api",
            });
        }
    }

    // 2. Special pilgrimage/travel-surge events (manually tracked, rare updates)
    for (const fest of SPECIAL_EVENTS) {
        const overlapsRange = rangeStart && rangeEnd
            ? rangesOverlap(fest.startDate, fest.endDate, rangeStart, rangeEnd)
            : null;
        const isActive = now >= fest.startDate && now <= fest.endDate;
        const distanceToStart = daysBetween(now, fest.startDate);
        const distanceToEnd = daysBetween(now, fest.endDate);
        const nearest = isActive ? 0 : Math.min(distanceToStart, distanceToEnd);

        const relevant = rangeStart && rangeEnd ? overlapsRange : (isActive || nearest <= windowDays);
        if (!relevant) continue;

        const isLocal = fest.locationKeywords.some((kw) => haystack.includes(kw));

        candidates.push({
            name: fest.name,
            startDate: fest.startDate,
            endDate: fest.endDate,
            multiplier: isLocal ? fest.localMultiplier : fest.multiplier,
            isLocal,
            isActive,
            distance: rangeStart ? 0 : nearest,
            source: "special",
        });
    }

    if (candidates.length === 0) return null;

    // Prefer: local match > higher multiplier > closer in time
    candidates.sort((a, b) => {
        if (a.isLocal !== b.isLocal) return a.isLocal ? -1 : 1;
        if (a.multiplier !== b.multiplier) return b.multiplier - a.multiplier;
        return a.distance - b.distance;
    });

    return candidates[0];
}

/**
 * Computes a fair seasonal price for a listing, given a base nightly price.
 * If rangeStart/rangeEnd (an actual stay) is passed, checks against those
 * exact dates; otherwise checks near "today" (for the host-side suggestion tool).
 */
async function computeSeasonalPrice(basePrice, location, country, options = {}) {
    const fest = await getSeasonalInfo(location, country, options);

    if (!fest) {
        return {
            suggestedPrice: basePrice,
            multiplier: 1,
            festival: null,
            reasoning:
                "No major Indian festival or pilgrimage season overlaps this period, so the base price applies.",
        };
    }

    const suggestedPrice = Math.round(basePrice * fest.multiplier);
    const reasoning = `${fest.isLocal ? "This location is close to" : "This period overlaps with"} ${fest.name}. Demand ${fest.isActive ? "is currently elevated" : "is expected to rise"}, so a fair ${Math.round((fest.multiplier - 1) * 100)}% seasonal price applies.`;

    return {
        suggestedPrice,
        multiplier: fest.multiplier,
        festival: fest.name,
        reasoning,
    };
}

module.exports = { getSeasonalInfo, computeSeasonalPrice };
