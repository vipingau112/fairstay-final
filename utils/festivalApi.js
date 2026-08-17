/**
 * Fetches India's public holiday calendar live from Google's public ICS feed.
 * No API key required, and it auto-updates every year — nobody has to
 * hand-maintain festival dates in code.
 *
 * Feed: Google Calendar's "Holidays in India" public calendar.
 * Docs: https://support.google.com/calendar/answer/37648
 */

const FEED_URL =
    "https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // refresh once a day
let cache = { data: null, fetchedAt: 0 };

function parseIcsDate(raw) {
    // Handles the all-day date form: YYYYMMDD
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    return new Date(`${y}-${m}-${d}T00:00:00`);
}

function parseIcs(icsText) {
    const events = [];
    const veventBlocks = icsText.split("BEGIN:VEVENT").slice(1);

    for (const block of veventBlocks) {
        const summaryMatch = block.match(/SUMMARY:(.+)/);
        const dateMatch = block.match(/DTSTART[^:]*:(\d{8})/);
        if (summaryMatch && dateMatch) {
            events.push({
                name: summaryMatch[1].trim(),
                date: parseIcsDate(dateMatch[1]),
            });
        }
    }
    return events;
}

/**
 * Returns the list of Indian public holidays/festivals for the current
 * and surrounding period, fetched live and cached for 24h.
 * Returns [] (never throws) if the feed is unreachable, so callers can
 * safely fall back to other logic.
 */
async function getLiveFestivals() {
    const now = Date.now();
    if (cache.data && now - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.data;
    }

    try {
        const res = await fetch(FEED_URL, { headers: { "User-Agent": "Wanderlust-App" } });
        if (!res.ok) throw new Error(`Feed responded with ${res.status}`);
        const text = await res.text();
        const events = parseIcs(text);
        cache = { data: events, fetchedAt: now };
        return events;
    } catch (err) {
        console.error("Festival API fetch failed, falling back:", err.message);
        // Serve stale cache if we have any, rather than nothing
        return cache.data || [];
    }
}

module.exports = { getLiveFestivals };
