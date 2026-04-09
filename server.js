const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════
//  FlashScore Data Extraction Engine v2
//  Strategy: Intercept XHR responses + Smart DOM parsing
// ═══════════════════════════════════════════════════

async function extractMatchData(matchUrl) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--lang=en-US'
            ],
            defaultViewport: { width: 1920, height: 1080 }
        });

        const page = await browser.newPage();

        // Set language to English for consistent selectors
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

        // Collect network responses for internal API data
        const apiResponses = {};
        page.on('response', async (response) => {
            const url = response.url();
            try {
                if (url.includes('/api/') || url.includes('feed') || url.includes('d.flashscore') || url.includes('local-global')) {
                    const text = await response.text().catch(() => '');
                    if (text) {
                        apiResponses[url] = text;
                    }
                }
            } catch (e) {}
        });

        console.log('[EXTRACT] Navigating to match page...');
        await page.goto(matchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(4000);

        // Close cookie popup
        try {
            await page.evaluate(() => {
                const btns = document.querySelectorAll('button');
                btns.forEach(btn => {
                    if (btn.textContent.includes('Accept') || btn.textContent.includes('agree') || btn.id === 'onetrust-accept-btn-handler') {
                        btn.click();
                    }
                });
            });
            await sleep(1000);
        } catch (e) {}

        // ─── Step 1: Extract Match Info ───
        console.log('[EXTRACT] Extracting match info...');
        const matchInfo = await page.evaluate(() => {
            const r = {};
            
            // Get all text content and find teams
            // Home team - typically on the left
            const homeEls = document.querySelectorAll('[class*="duelParticipant"] [class*="home"] [class*="participantName"] a, [class*="duelParticipant"] [class*="home"] [class*="Name"]');
            const awayEls = document.querySelectorAll('[class*="duelParticipant"] [class*="away"] [class*="participantName"] a, [class*="duelParticipant"] [class*="away"] [class*="Name"]');
            
            // Fallback: try broader selectors
            if (homeEls.length === 0) {
                const allParticipants = document.querySelectorAll('[class*="participant"]');
                allParticipants.forEach(el => {
                    const text = el.textContent.trim();
                    if (text.length > 1 && text.length < 40) {
                        const parent = el.closest('[class*="home"]');
                        const parentAway = el.closest('[class*="away"]');
                        if (parent && !r.homeTeam) r.homeTeam = text;
                        else if (parentAway && !r.awayTeam) r.awayTeam = text;
                    }
                });
            } else {
                r.homeTeam = homeEls[0]?.textContent.trim() || '';
                r.awayTeam = awayEls[0]?.textContent.trim() || '';
            }

            // If still no teams, try getting from title
            if (!r.homeTeam || !r.awayTeam) {
                const title = document.title;
                const titleMatch = title.match(/(.+?)\s*[-–vs.]+\s*(.+?)[\s|]/);
                if (titleMatch) {
                    r.homeTeam = r.homeTeam || titleMatch[1].trim();
                    r.awayTeam = r.awayTeam || titleMatch[2].trim();
                }
            }

            // Date/Time
            const startTimeEl = document.querySelector('[class*="startTime"], [class*="dateTime"]');
            r.dateTime = startTimeEl ? startTimeEl.textContent.trim() : '';

            // Tournament 
            const breadcrumbs = document.querySelectorAll('[class*="tournamentHeader"] a, [class*="breadcrumb"] a');
            const crumbs = [];
            breadcrumbs.forEach(a => crumbs.push(a.textContent.trim()));
            r.league = crumbs.join(' > ') || '';
            r.round = crumbs[crumbs.length - 1] || '';

            return r;
        });

        console.log(`[EXTRACT] Found: ${matchInfo.homeTeam} vs ${matchInfo.awayTeam}`);

        // ─── Step 2: Navigate to Standings tab and extract ───
        console.log('[EXTRACT] Clicking Standings tab...');
        const standings = { overall: [], home: [], away: [] };

        // Click STANDINGS tab
        await page.evaluate(() => {
            const allLinks = document.querySelectorAll('a, button, [role="tab"]');
            for (const el of allLinks) {
                const text = el.textContent.trim().toUpperCase();
                if (text === 'STANDINGS' || text === 'TABLE') {
                    el.click();
                    return true;
                }
            }
            // Try by href
            const standingsLink = document.querySelector('a[href*="standings"], a[href*="#/standings"]');
            if (standingsLink) { standingsLink.click(); return true; }
            return false;
        });
        await sleep(3000);

        // Extract OVERALL standings
        console.log('[EXTRACT] Extracting Overall standings...');
        standings.overall = await extractStandingsFromDOM(page);
        console.log(`[EXTRACT] Got ${standings.overall.length} teams in Overall`);

        // Click HOME sub-tab
        await page.evaluate(() => {
            const allEls = document.querySelectorAll('a, button, [role="tab"], div[class*="tab"], div[class*="filter"]');
            for (const el of allEls) {
                const text = el.textContent.trim().toUpperCase();
                if (text === 'HOME') {
                    el.click();
                    return true;
                }
            }
            return false;
        });
        await sleep(2000);

        standings.home = await extractStandingsFromDOM(page);
        console.log(`[EXTRACT] Got ${standings.home.length} teams in Home`);

        // Click AWAY sub-tab
        await page.evaluate(() => {
            const allEls = document.querySelectorAll('a, button, [role="tab"], div[class*="tab"], div[class*="filter"]');
            for (const el of allEls) {
                const text = el.textContent.trim().toUpperCase();
                if (text === 'AWAY') {
                    el.click();
                    return true;
                }
            }
            return false;
        });
        await sleep(2000);

        standings.away = await extractStandingsFromDOM(page);
        console.log(`[EXTRACT] Got ${standings.away.length} teams in Away`);

        // ─── Step 3: Click back to overall, then navigate to H2H ───
        console.log('[EXTRACT] Clicking H2H tab...');
        await page.evaluate(() => {
            const allLinks = document.querySelectorAll('a, button, [role="tab"]');
            for (const el of allLinks) {
                const text = el.textContent.trim().toUpperCase();
                if (text === 'H2H') {
                    el.click();
                    return true;
                }
            }
            return false;
        });
        await sleep(3000);

        const h2h = await extractH2HFromDOM(page);
        console.log(`[EXTRACT] Got ${h2h.length} H2H matches`);

        // ─── Step 4: Extract Last Matches (from H2H page or Summary) ───
        console.log('[EXTRACT] Extracting last matches...');
        const lastMatches = await extractLastMatchesFromDOM(page, matchInfo.homeTeam, matchInfo.awayTeam);

        // ─── Step 5: Navigate to ODDS ───
        console.log('[EXTRACT] Clicking ODDS tab...');
        await page.evaluate(() => {
            const allLinks = document.querySelectorAll('a, button, [role="tab"]');
            for (const el of allLinks) {
                const text = el.textContent.trim().toUpperCase();
                if (text === 'ODDS') {
                    el.click();
                    return true;
                }
            }
            return false;
        });
        await sleep(3000);

        const odds = await extractOddsFromDOM(page);
        console.log(`[EXTRACT] Odds: ${JSON.stringify(odds)}`);

        // ─── Step 6: Also try to get odds from SUMMARY page (often visible there) ───
        if (!odds.home) {
            await page.evaluate(() => {
                const allLinks = document.querySelectorAll('a, button, [role="tab"]');
                for (const el of allLinks) {
                    const text = el.textContent.trim().toUpperCase();
                    if (text === 'SUMMARY') {
                        el.click();
                        return true;
                    }
                }
                return false;
            });
            await sleep(2000);
            
            const summaryOdds = await extractOddsFromDOM(page);
            if (summaryOdds.home) {
                odds.home = summaryOdds.home;
                odds.draw = summaryOdds.draw;
                odds.away = summaryOdds.away;
            }
        }

        await browser.close();

        return {
            success: true,
            data: {
                matchInfo,
                standings,
                lastMatches,
                h2h,
                odds
            }
        };

    } catch (error) {
        console.error('[EXTRACT ERROR]', error.message);
        if (browser) await browser.close();
        return { success: false, error: error.message };
    }
}

// ─── Smart Standings Table Extractor ───
async function extractStandingsFromDOM(page) {
    return await page.evaluate(() => {
        const teams = [];

        // FlashScore DOM (verified): div.ui-table__row contains:
        // - div.table__cell--rank > div.tableCellRank
        // - div.table__cell--participant > tableCellParticipant > a.tableCellParticipant__name
        // - span.table__cell--value (×7: MP, W, D, L, Goals, GD, PTS)
        // - div.table__cell--form (form badges W/D/L)

        const allRows = document.querySelectorAll('.ui-table__row');
        
        allRows.forEach((row, idx) => {
            try {
                const team = { rank: idx + 1, name: '', mp: '', w: '', d: '', l: '', goals: '', gd: '', pts: '', form: [] };

                // Team name
                const nameEl = row.querySelector('.tableCellParticipant__name, [class*="tableCellParticipant__name"]');
                if (nameEl) {
                    team.name = nameEl.textContent.trim();
                }
                if (!team.name) {
                    const links = row.querySelectorAll('a');
                    for (const link of links) {
                        if ((link.getAttribute('href') || '').includes('/team/')) {
                            team.name = link.textContent.trim() || link.getAttribute('title') || '';
                            if (team.name) break;
                        }
                    }
                }
                if (!team.name) return;

                // Rank
                const rankEl = row.querySelector('.tableCellRank, [class*="tableCellRank"]');
                if (rankEl) {
                    team.rank = parseInt(rankEl.textContent.trim().replace('.', '')) || idx + 1;
                }

                // Stats from span.table__cell--value
                const valueCells = row.querySelectorAll('span[class*="table__cell--value"]');
                const vals = [];
                valueCells.forEach(cell => vals.push(cell.textContent.trim()));

                if (vals.length >= 7) {
                    team.mp = vals[0]; team.w = vals[1]; team.d = vals[2]; team.l = vals[3];
                    team.goals = vals[4]; team.gd = vals[5]; team.pts = vals[6];
                } else if (vals.length >= 5) {
                    team.mp = vals[0]; team.w = vals[1]; team.d = vals[2]; team.l = vals[3];
                    team.pts = vals[vals.length - 1];
                }

                // Form badges
                const formCell = row.querySelector('[class*="table__cell--form"]');
                if (formCell) {
                    const formText = formCell.textContent.trim().replace(/[^WDLwdl?]/g, '');
                    for (const ch of formText) {
                        if (ch === 'W' || ch === 'w') team.form.push('W');
                        else if (ch === 'D' || ch === 'd') team.form.push('D');
                        else if (ch === 'L' || ch === 'l') team.form.push('L');
                    }
                }

                teams.push(team);
            } catch (e) {}
        });

        return teams;
    });
}

// ─── H2H Extractor ───
async function extractH2HFromDOM(page) {
    return await page.evaluate(() => {
        const matches = [];
        
        // FlashScore H2H DOM (verified):
        // div.h2h__row contains:
        //   span.h2h__date → "03.04.26"
        //   span.h2h__homeParticipant > span.h2h__participantInner → "Constantine"
        //   span.h2h__awayParticipant > span.h2h__participantInner → "Oran"
        //   span.h2h__result > span + span → "0" + "1"

        // Find only the "Head-to-head matches" section
        const sections = document.querySelectorAll('.h2h__section, [class*="h2h__section"]');
        let h2hSection = null;
        
        sections.forEach(section => {
            const title = section.querySelector('[class*="section__title"], [class*="title"]');
            if (title && title.textContent.trim().toLowerCase().includes('head-to-head')) {
                h2hSection = section;
            }
        });

        // If no specific section, try the last section (H2H is usually third)
        if (!h2hSection && sections.length >= 3) {
            h2hSection = sections[2]; // 0: home last, 1: away last, 2: h2h
        }

        const rowContainer = h2hSection || document;
        const rows = rowContainer.querySelectorAll('.h2h__row, [class*="h2h__row"]');
        
        // Only take rows from h2h section if found, otherwise limit
        const targetRows = h2hSection ? rows : [];
        
        for (const row of targetRows) {
            try {
                const match = { date: '', home: '', away: '', score: '' };
                
                // Date
                const dateEl = row.querySelector('.h2h__date, [class*="h2h__date"]');
                match.date = dateEl ? dateEl.textContent.trim() : '';

                // Home team
                const homeEl = row.querySelector('.h2h__homeParticipant .h2h__participantInner, [class*="h2h__homeParticipant"] [class*="h2h__participantInner"]');
                match.home = homeEl ? homeEl.textContent.trim() : '';

                // Away team
                const awayEl = row.querySelector('.h2h__awayParticipant .h2h__participantInner, [class*="h2h__awayParticipant"] [class*="h2h__participantInner"]');
                match.away = awayEl ? awayEl.textContent.trim() : '';

                // Score — h2h__result contains two child spans
                const resultEl = row.querySelector('.h2h__result, [class*="h2h__result"]');
                if (resultEl) {
                    const scoreSpans = resultEl.querySelectorAll('span');
                    if (scoreSpans.length >= 2) {
                        match.score = scoreSpans[0].textContent.trim() + ' - ' + scoreSpans[1].textContent.trim();
                    } else {
                        match.score = resultEl.textContent.trim().replace(/(\d)(\d)/, '$1 - $2');
                    }
                }

                if ((match.home || match.away) && match.score) {
                    matches.push(match);
                }
            } catch (e) {}
        }

        return matches;
    });
}

// ─── Last Matches Extractor ───
async function extractLastMatchesFromDOM(page, homeTeamName, awayTeamName) {
    return await page.evaluate((home, away) => {
        const result = { home: [], away: [] };
        
        // FlashScore H2H page has sections:
        // "Last matches: Oran" (home team last matches)
        // "Last matches: Rouisset" (away team last matches)
        // "Head-to-head matches"
        
        const sections = document.querySelectorAll('.h2h__section, [class*="h2h__section"]');
        
        let homeSection = null;
        let awaySection = null;
        
        sections.forEach(section => {
            const title = section.querySelector('[class*="section__title"], [class*="title"]');
            if (title) {
                const text = title.textContent.trim();
                if (home && text.toLowerCase().includes(home.toLowerCase().substring(0, 4))) {
                    homeSection = section;
                } else if (away && text.toLowerCase().includes(away.toLowerCase().substring(0, 4))) {
                    awaySection = section;
                }
            }
        });

        // If not found by name, use first two sections
        if (!homeSection && sections.length >= 1) homeSection = sections[0];
        if (!awaySection && sections.length >= 2) awaySection = sections[1];

        function extractMatchRows(section) {
            const matches = [];
            if (!section) return matches;
            
            const rows = section.querySelectorAll('.h2h__row, [class*="h2h__row"]');
            for (const row of rows) {
                try {
                    const m = { date: '', homeTeam: '', awayTeam: '', score: '' };
                    
                    const dateEl = row.querySelector('.h2h__date, [class*="h2h__date"]');
                    m.date = dateEl ? dateEl.textContent.trim() : '';

                    const homeEl = row.querySelector('.h2h__homeParticipant .h2h__participantInner, [class*="h2h__homeParticipant"] [class*="h2h__participantInner"]');
                    m.homeTeam = homeEl ? homeEl.textContent.trim() : '';

                    const awayEl = row.querySelector('.h2h__awayParticipant .h2h__participantInner, [class*="h2h__awayParticipant"] [class*="h2h__participantInner"]');
                    m.awayTeam = awayEl ? awayEl.textContent.trim() : '';

                    const resultEl = row.querySelector('.h2h__result, [class*="h2h__result"]');
                    if (resultEl) {
                        const scoreSpans = resultEl.querySelectorAll('span');
                        if (scoreSpans.length >= 2) {
                            m.score = scoreSpans[0].textContent.trim() + ' - ' + scoreSpans[1].textContent.trim();
                        } else {
                            m.score = resultEl.textContent.trim().replace(/(\d)(\d)/, '$1 - $2');
                        }
                    }

                    if (m.homeTeam && m.awayTeam) matches.push(m);
                } catch (e) {}
            }
            return matches;
        }

        result.home = extractMatchRows(homeSection);
        result.away = extractMatchRows(awaySection);

        return result;
    }, homeTeamName, awayTeamName);
}




// ─── Odds Extractor ───
async function extractOddsFromDOM(page) {
    return await page.evaluate(() => {
        const odds = { home: null, draw: null, away: null };
        
        // Strategy 1: Look for odds cells/values
        const oddEls = document.querySelectorAll('[class*="odd"]:not([class*="header"]) [class*="value"], [class*="odds"] span, [class*="oddsCell"] span');
        const values = [];
        
        oddEls.forEach(el => {
            const val = parseFloat(el.textContent.trim());
            if (!isNaN(val) && val >= 1.01 && val <= 200) {
                values.push(val);
            }
        });

        // Strategy 2: Look for any 3 consecutive floating-point numbers
        if (values.length < 3) {
            const allSpans = document.querySelectorAll('span, div');
            allSpans.forEach(el => {
                if (values.length >= 3) return;
                const text = el.textContent.trim();
                const val = parseFloat(text);
                if (text === String(val) && val >= 1.01 && val <= 200 && el.children.length === 0) {
                    values.push(val);
                }
            });
        }

        // Strategy 3: Look specifically for bet365 or other bookmaker odds
        if (values.length < 3) {
            const bookmakerRows = document.querySelectorAll('[class*="bookmaker"], [class*="provider"]');
            bookmakerRows.forEach(row => {
                const cells = row.querySelectorAll('[class*="cell"], span');
                cells.forEach(cell => {
                    const val = parseFloat(cell.textContent.trim());
                    if (!isNaN(val) && val >= 1.01 && val <= 200) {
                        values.push(val);
                    }
                });
            });
        }

        if (values.length >= 3) {
            odds.home = values[0];
            odds.draw = values[1];
            odds.away = values[2];
        }

        return odds;
    });
}

// ═══════════════════════════════════════════════════
//  DEBUG: HTML Dump Endpoint
// ═══════════════════════════════════════════════════

app.post('/api/debug', async (req, res) => {
    const { url } = req.body;
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 1920, height: 1080 }
        });

        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(4000);

        // Accept cookies
        await page.evaluate(() => {
            document.querySelectorAll('button').forEach(btn => {
                if (btn.textContent.includes('Accept') || btn.id === 'onetrust-accept-btn-handler') btn.click();
            });
        });
        await sleep(1000);

        // Get page title
        const title = await page.title();

        // Click standings tab
        await page.evaluate(() => {
            document.querySelectorAll('a, button, [role="tab"]').forEach(el => {
                if (el.textContent.trim().toUpperCase() === 'STANDINGS') el.click();
            });
        });
        await sleep(3000);

        // Dump standings structure
        const debugInfo = await page.evaluate(() => {
            const info = {};

            // Get all elements with "table" in their class
            const tableEls = document.querySelectorAll('[class*="table"]');
            info.tableElementsCount = tableEls.length;
            info.tableClassNames = [];
            tableEls.forEach(el => {
                if (el.className && !info.tableClassNames.includes(el.className.toString().substring(0, 80))) {
                    info.tableClassNames.push(el.className.toString().substring(0, 80));
                }
            });

            // Specifically look at rows
            const row1 = document.querySelector('[class*="table__row"]:not([class*="head"])');
            if (row1) {
                info.firstRow = {
                    className: row1.className.toString().substring(0, 100),
                    innerHTML: row1.innerHTML.substring(0, 2000),
                    childCount: row1.children.length,
                    childClasses: Array.from(row1.children).map(c => c.className.toString().substring(0, 60))
                };
            }

            // Get header row
            const headerRow = document.querySelector('[class*="table__headerCell"], [class*="table__head"]');
            if (headerRow) {
                info.headerRow = headerRow.parentElement?.innerHTML?.substring(0, 1000) || 'N/A';
            }

            // Check for participant elements
            const participants = document.querySelectorAll('[class*="participant"]');
            info.participantCount = participants.length;
            if (participants.length > 0) {
                info.firstParticipant = {
                    className: participants[0].className.toString().substring(0, 100),
                    innerHTML: participants[0].innerHTML.substring(0, 500),
                    text: participants[0].textContent.trim()
                };
            }

            // Get broad overview of page structure
            info.h2Elements = Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim());
            info.h3Elements = Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim());

            return info;
        });

        // Take a screenshot
        const screenshotPath = path.join(__dirname, 'debug_screenshot.png');
        await page.screenshot({ path: screenshotPath, fullPage: false });

        await browser.close();

        res.json({ 
            success: true, 
            title,
            debug: debugInfo,
            screenshotSaved: screenshotPath
        });

    } catch (e) {
        if (browser) await browser.close();
        res.json({ success: false, error: e.message });
    }
});

// ═══════════════════════════════════════════════════
//  FlashScore All Matches Fetcher
// ═══════════════════════════════════════════════════

async function fetchAllMatches() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--lang=en-US'
            ],
            defaultViewport: { width: 1920, height: 1080 }
        });

        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

        console.log('[MATCHES] Navigating to FlashScore...');
        await page.goto('https://www.flashscore.com/', { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(4000);

        // Close cookie popup
        try {
            await page.evaluate(() => {
                const btns = document.querySelectorAll('button');
                btns.forEach(btn => {
                    if (btn.textContent.includes('Accept') || btn.textContent.includes('agree') || btn.id === 'onetrust-accept-btn-handler') {
                        btn.click();
                    }
                });
            });
            await sleep(1500);
        } catch (e) {}

        // Scroll down to load more matches
        for (let i = 0; i < 15; i++) {
            await page.evaluate(() => window.scrollBy(0, 1500));
            await sleep(600);
        }

        // Try clicking "Show more matches" buttons
        try {
            await page.evaluate(() => {
                const showMoreBtns = document.querySelectorAll('[class*="event__more"], [class*="showMore"], a[class*="more"]');
                showMoreBtns.forEach(btn => {
                    try { btn.click(); } catch(e) {}
                });
            });
            await sleep(2000);
            
            // Scroll more after expanding
            for (let i = 0; i < 5; i++) {
                await page.evaluate(() => window.scrollBy(0, 1500));
                await sleep(500);
            }
        } catch(e) {}

        // Scroll back to top
        await page.evaluate(() => window.scrollTo(0, 0));
        await sleep(500);

        console.log('[MATCHES] Extracting matches from DOM...');




        const matches = await page.evaluate(() => {
            const results = [];
            let currentLeague = '';
            let currentCountry = '';

            // FlashScore DOM structure (verified via debug):
            // Container: div.sportName.soccer
            //   ├── div.headerLeague__wrapper  (league header - contains links with league name)
            //   ├── div.event__match           (match row)
            //   ├── div.event__match           (match row)
            //   ├── div.headerLeague__wrapper  (next league header)
            //   ├── div.event__match           (match row)
            //   └── ...

            const container = document.querySelector('.sportName.soccer') || document.querySelector('[class*="sportName"]');
            if (!container) {
                // Fallback: get all matches without league info
                const allMatches = document.querySelectorAll('[class*="event__match"]');
                allMatches.forEach(el => {
                    try {
                        const match = { id: '', url: '', homeTeam: '', awayTeam: '', time: '', score: '', status: 'scheduled', league: '', country: '' };
                        const elId = el.getAttribute('id') || '';
                        if (elId) { const p = elId.split('_'); match.id = p.length >= 3 ? p.slice(2).join('_') : elId; }
                        if (match.id) match.url = `https://www.flashscore.com/match/${match.id}/`;
                        const h = el.querySelector('[class*="event__participant--home"], [class*="homeParticipant"]');
                        const a = el.querySelector('[class*="event__participant--away"], [class*="awayParticipant"]');
                        if (h) match.homeTeam = h.textContent.trim();
                        if (a) match.awayTeam = a.textContent.trim();
                        if (match.homeTeam && match.awayTeam) results.push(match);
                    } catch(e) {}
                });
                return results;
            }

            // Get ALL children from ALL sportName containers
            const containers = document.querySelectorAll('.sportName.soccer, [class*="sportName"]');
            const allChildren = [];
            const seenIds = new Set();
            containers.forEach(c => {
                for (let j = 0; j < c.children.length; j++) {
                    const child = c.children[j];
                    const cid = child.getAttribute('id') || (child.className + '_' + j);
                    if (!seenIds.has(cid)) {
                        seenIds.add(cid);
                        allChildren.push(child);
                    }
                }
            });
            
            for (let i = 0; i < allChildren.length; i++) {
                const el = allChildren[i];
                const cls = el.className || '';

                // League Header (wrapper)
                if (cls.includes('headerLeague__wrapper') || (cls.includes('headerLeague') && !cls.includes('event__match'))) {
                    // Extract league info from links inside
                    const links = el.querySelectorAll('a');
                    const linkTexts = [];
                    links.forEach(a => {
                        const text = a.textContent.trim();
                        const href = a.getAttribute('href') || '';
                        // Skip utility links like "Draw", "Standings", "Pin"
                        if (text.length > 1 && text.length < 80 && href.includes('/football/')) {
                            linkTexts.push(text);
                        }
                    });

                    if (linkTexts.length >= 1) {
                        currentLeague = linkTexts[0]; // e.g. "Europa League - Play Offs"
                    }

                    // Extract country from text content that appears after league name
                    // Pattern: "Europa League - Play OffsEUROPE: Draw"
                    const fullText = el.textContent.trim();
                    // Look for country patterns
                    const countryPatterns = ['EUROPE', 'ENGLAND', 'SPAIN', 'GERMANY', 'ITALY', 'FRANCE', 
                        'PORTUGAL', 'NETHERLANDS', 'BELGIUM', 'TURKEY', 'GREECE', 'SCOTLAND', 'BRAZIL',
                        'ARGENTINA', 'USA', 'MEXICO', 'JAPAN', 'SOUTH KOREA', 'AUSTRALIA', 'ALGERIA',
                        'EGYPT', 'MOROCCO', 'TUNISIA', 'SAUDI ARABIA', 'UAE', 'QATAR', 'RUSSIA',
                        'UKRAINE', 'POLAND', 'CZECH REPUBLIC', 'CZECHIA', 'AUSTRIA', 'SWITZERLAND',
                        'CROATIA', 'SERBIA', 'ROMANIA', 'DENMARK', 'SWEDEN', 'NORWAY', 'FINLAND',
                        'IRELAND', 'WALES', 'CHINA', 'INDIA', 'COLOMBIA', 'CHILE', 'PERU', 'PARAGUAY',
                        'URUGUAY', 'ECUADOR', 'NIGERIA', 'SOUTH AFRICA', 'WORLD', 'AFRICA', 'ASIA',
                        'NORTH & CENTRAL AMERICA', 'SOUTH AMERICA', 'HUNGARY', 'BULGARIA', 'SLOVAKIA',
                        'SLOVENIA', 'BOSNIA AND HERZEGOVINA', 'NORTH MACEDONIA', 'ALBANIA', 'MONTENEGRO',
                        'KOSOVO', 'ICELAND', 'CYPRUS', 'MALTA', 'LUXEMBOURG', 'ESTONIA', 'LATVIA',
                        'LITHUANIA', 'GEORGIA', 'ARMENIA', 'AZERBAIJAN', 'KAZAKHSTAN', 'UZBEKISTAN',
                        'IRAN', 'IRAQ', 'JORDAN', 'KUWAIT', 'BAHRAIN', 'OMAN', 'YEMEN', 'LIBYA',
                        'SUDAN', 'ETHIOPIA', 'KENYA', 'TANZANIA', 'NIGERIA', 'GHANA', 'CAMEROON',
                        'SENEGAL', 'IVORY COAST', 'COSTA RICA', 'HONDURAS', 'PANAMA', 'GUATEMALA',
                        'EL SALVADOR', 'JAMAICA', 'CANADA', 'THAILAND', 'VIETNAM', 'MALAYSIA',
                        'INDONESIA', 'SINGAPORE', 'PHILIPPINES', 'PALESTINE', 'LEBANON', 'SYRIA',
                        'ISRAEL', 'BOLIVIA', 'VENEZUELA', 'NEW ZEALAND', 'CONGO DR', 'CONGO',
                        'MALI', 'GUINEA', 'ZAMBIA', 'ZIMBABWE', 'MOZAMBIQUE', 'ANGOLA'];
                    
                    const upperText = fullText.toUpperCase();
                    for (const cp of countryPatterns) {
                        if (upperText.includes(cp)) {
                            currentCountry = cp.charAt(0) + cp.slice(1).toLowerCase();
                            break;
                        }
                    }

                    // If no country found, try to extract from the text after league name
                    if (!currentCountry && currentLeague) {
                        const afterLeague = fullText.substring(fullText.indexOf(currentLeague) + currentLeague.length).trim();
                        if (afterLeague) {
                            // Take first word that looks like a country
                            const firstWord = afterLeague.split(/[:.\n]/)[0].trim();
                            if (firstWord.length > 2 && firstWord.length < 30) {
                                currentCountry = firstWord;
                            }
                        }
                    }

                    continue;
                }

                // Match Row
                if (cls.includes('event__match')) {
                    try {
                        const match = {
                            id: '',
                            url: '',
                            homeTeam: '',
                            awayTeam: '',
                            time: '',
                            score: '',
                            status: 'scheduled',
                            league: currentLeague,
                            country: currentCountry
                        };

                        // Get match ID from element id (format: g_1_MATCHID)
                        const elId = el.getAttribute('id') || '';
                        if (elId) {
                            const idParts = elId.split('_');
                            match.id = idParts.length >= 3 ? idParts.slice(2).join('_') : elId;
                        }

                        if (match.id) {
                            match.url = `https://www.flashscore.com/match/${match.id}/`;
                        }

                        // Home team
                        const homeEl = el.querySelector('[class*="event__participant--home"], [class*="homeParticipant"]');
                        if (homeEl) match.homeTeam = homeEl.textContent.trim();

                        // Away team
                        const awayEl = el.querySelector('[class*="event__participant--away"], [class*="awayParticipant"]');
                        if (awayEl) match.awayTeam = awayEl.textContent.trim();

                        // Time / Status
                        const timeEl = el.querySelector('[class*="event__time"]');
                        if (timeEl) {
                            const innerDiv = timeEl.querySelector('div') || timeEl;
                            const timeText = innerDiv.textContent.trim();

                            if (timeText.includes(':') && timeText.length <= 5) {
                                match.time = timeText;
                                match.status = 'scheduled';
                            } else if (timeText.includes("'") || timeText.match(/^\d+$/)) {
                                match.time = timeText;
                                match.status = 'live';
                            } else if (timeText.includes('Fin') || timeText.includes('AET') || timeText.includes('FT')) {
                                match.time = timeText;
                                match.status = 'finished';
                            } else if (timeText.includes('Post') || timeText.includes('Canc') || timeText.includes('Abn')) {
                                match.time = timeText;
                                match.status = 'postponed';
                            } else if (timeText.includes('Half')) {
                                match.time = 'HT';
                                match.status = 'live';
                            } else {
                                match.time = timeText;
                            }
                        }

                        // Stage indicator for live matches
                        const stageEl = el.querySelector('[class*="event__stage"]');
                        if (stageEl) {
                            const stageText = stageEl.textContent.trim();
                            if (stageText) {
                                match.status = 'live';
                                if (stageText.includes("'")) match.time = stageText;
                            }
                        }

                        // Score
                        const homeScoreEl = el.querySelector('[class*="event__score--home"]');
                        const awayScoreEl = el.querySelector('[class*="event__score--away"]');
                        if (homeScoreEl && awayScoreEl) {
                            const hs = homeScoreEl.textContent.trim();
                            const as = awayScoreEl.textContent.trim();
                            if (hs && as) {
                                match.score = `${hs} - ${as}`;
                                if (match.status === 'scheduled') {
                                    match.status = (hs === '-' || hs === '') ? 'scheduled' : 'finished';
                                }
                            }
                        }

                        // Only add if we have team names
                        if (match.homeTeam && match.awayTeam) {
                            results.push(match);
                        }
                    } catch (e) {}
                }
            }

            return results;
        });


        console.log(`[MATCHES] Found ${matches.length} matches`);

        await browser.close();

        // Group matches by league
        const grouped = {};
        matches.forEach(match => {
            const key = `${match.country}: ${match.league}`;
            if (!grouped[key]) {
                grouped[key] = {
                    country: match.country,
                    league: match.league,
                    matches: []
                };
            }
            grouped[key].matches.push(match);
        });

        return {
            success: true,
            total: matches.length,
            leagues: Object.values(grouped),
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[MATCHES ERROR]', error.message);
        if (browser) await browser.close();
        return { success: false, error: error.message };
    }
}

// ═══════════════════════════════════════════════════
//  API Routes
// ═══════════════════════════════════════════════════

app.get('/api/matches', async (req, res) => {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`[SERVER] Fetching all matches from FlashScore...`);
    console.log(`${'═'.repeat(50)}\n`);

    const result = await fetchAllMatches();
    res.json(result);
});

app.post('/api/extract', async (req, res) => {
    const { url } = req.body;

    if (!url || !url.includes('flashscore')) {
        return res.status(400).json({ success: false, error: 'رابط FlashScore غير صالح' });
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`[SERVER] Extracting data from: ${url}`);
    console.log(`${'═'.repeat(50)}\n`);

    const result = await extractMatchData(url);
    res.json(result);
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════
//  Start Server
// ═══════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  🎯 Double Chance Analyst Pro v2`);
    console.log(`  🌐 Server running: http://localhost:${PORT}`);
    console.log(`${'═'.repeat(50)}\n`);
});
