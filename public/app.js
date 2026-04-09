/* ═══════════════════════════════════════════════════════
   🎯 Double Chance Analyst Pro — Main Application
   v2: Integrated Matches Browser
   ═══════════════════════════════════════════════════════ */

// ─── Global State ───
let extractedData = null;
let engine = null;
let courtroom = null;
let allMatchesData = []; // All fetched matches (flat)
let selectedMatchUrl = null;

// ─── Initialize ───
document.addEventListener('DOMContentLoaded', () => {
    engine = new DoubleChanceEngine();
    courtroom = new CourtroomSystem();
    createParticles();
    
    // Enable Enter key on URL input
    const urlInput = document.getElementById('match-url');
    if (urlInput) {
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleExtractFromUrl();
        });
    }

    // Enable Enter key on search
    const searchInput = document.getElementById('matches-search');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                filterMatches();
            }
        });
    }
});

// ─── Particles Effect ───
function createParticles() {
    const container = document.getElementById('particles-bg');
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 3 + 1}px;
            height: ${Math.random() * 3 + 1}px;
            background: rgba(240, 185, 11, ${Math.random() * 0.15 + 0.05});
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: floatParticle ${Math.random() * 20 + 15}s linear infinite;
            animation-delay: ${Math.random() * 10}s;
        `;
        container.appendChild(particle);
    }

    // Add particle animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes floatParticle {
            0% { transform: translate(0, 0) scale(1); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translate(${Math.random() > 0.5 ? '' : '-'}${Math.random() * 200}px, -${Math.random() * 500 + 200}px) scale(0); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════
//  Toggle URL Input
// ═══════════════════════════════════════════════════

function toggleUrlInput() {
    const section = document.getElementById('manual-url-section');
    section.classList.toggle('hidden');
}

// ═══════════════════════════════════════════════════
//  Fetch All Matches from FlashScore
// ═══════════════════════════════════════════════════

async function fetchAllMatches() {
    const btn = document.getElementById('btn-fetch-matches');
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'جاري الجلب...';
    btn.classList.add('extracting');

    // Hide empty state
    const emptyState = document.getElementById('matches-empty-state');
    if (emptyState) emptyState.style.display = 'none';

    showStatus('📡 جاري الاتصال بـ FlashScore وجلب جميع المباريات... (قد يستغرق 30-60 ثانية)', 'loading');

    try {
        // Use AbortController with 3 minute timeout (scraping takes time)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

        const response = await fetch('/api/matches', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const result = await response.json();

        if (result.success) {
            // Flatten all matches for search
            allMatchesData = [];
            result.leagues.forEach(league => {
                league.matches.forEach(m => {
                    allMatchesData.push(m);
                });
            });

            renderMatchesList(result.leagues);
            
            // Show filter + count badge
            document.getElementById('matches-filter-section').classList.remove('hidden');
            const badge = document.getElementById('matches-count-badge');
            badge.textContent = result.total;
            badge.classList.remove('hidden');

            showStatus(`✅ تم جلب ${result.total} مباراة من ${result.leagues.length} بطولة بنجاح!`, 'success');
        } else {
            showStatus(`❌ خطأ في جلب المباريات: ${result.error}`, 'error');
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            showStatus('❌ انتهت المهلة — السيرفر لم يستجب. تأكد أن السيرفر يعمل وأعد المحاولة.', 'error');
        } else {
            showStatus(`❌ خطأ في الاتصال بالسيرفر: ${error.message}. تأكد أن السيرفر يعمل على localhost:3000`, 'error');
        }
    }

    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'جلب المباريات';
    btn.classList.remove('extracting');
}

// ═══════════════════════════════════════════════════
//  Render Matches List (grouped by league)
// ═══════════════════════════════════════════════════

function renderMatchesList(leagues) {
    const container = document.getElementById('matches-list-container');
    container.innerHTML = '';

    if (!leagues || leagues.length === 0) {
        container.innerHTML = `
            <div class="matches-empty-state">
                <div class="empty-icon">😕</div>
                <p>لم يتم العثور على مباريات</p>
            </div>`;
        return;
    }

    leagues.forEach(league => {
        const group = document.createElement('div');
        group.className = 'league-group';
        group.setAttribute('data-league', `${league.country} ${league.league}`.toLowerCase());

        // Country flag emoji (try mapping common ones)
        const flagEmoji = getCountryFlag(league.country);

        // League header
        const header = document.createElement('div');
        header.className = 'league-header';
        header.innerHTML = `
            <span class="league-flag">${flagEmoji}</span>
            <span class="league-country">${league.country || ''}</span>
            <span class="league-name">${league.league || ''}</span>
            <span class="league-count">${league.matches.length}</span>
            <span class="league-chevron">▼</span>
        `;
        header.onclick = () => {
            group.classList.toggle('collapsed');
        };
        group.appendChild(header);

        // Matches
        const matchesDiv = document.createElement('div');
        matchesDiv.className = 'league-matches';

        league.matches.forEach(match => {
            const item = createMatchItem(match);
            matchesDiv.appendChild(item);
        });

        group.appendChild(matchesDiv);
        container.appendChild(group);
    });
}

function createMatchItem(match) {
    const item = document.createElement('div');
    item.className = 'match-item';
    item.setAttribute('data-match-url', match.url || '');
    item.setAttribute('data-teams', `${match.homeTeam} ${match.awayTeam}`.toLowerCase());
    item.setAttribute('data-id', match.id || '');

    const statusClass = match.status || 'scheduled';
    const timeClass = statusClass === 'live' ? 'live' : statusClass === 'finished' ? 'finished' : '';

    // Score display
    let homeScore = '', awayScore = '';
    if (match.score) {
        const parts = match.score.split('-').map(s => s.trim());
        if (parts.length === 2) {
            homeScore = parts[0];
            awayScore = parts[1];
        }
    }

    item.innerHTML = `
        <div class="match-time-col">
            <div class="match-time-value ${timeClass}">${match.time || '—'}</div>
            <div class="match-status-dot ${statusClass}"></div>
        </div>
        <div class="match-teams-col">
            <div class="match-team-row">
                <span class="match-team-name">${match.homeTeam || '—'}</span>
            </div>
            <div class="match-team-row">
                <span class="match-team-name away">${match.awayTeam || '—'}</span>
            </div>
        </div>
        <div class="match-score-col">
            <div class="match-score-value ${statusClass === 'live' ? 'live' : ''}">${homeScore || ''}</div>
            <div class="match-score-value ${statusClass === 'live' ? 'live' : ''}">${awayScore || ''}</div>
        </div>
        <div class="match-actions-col">
            <button class="btn-match-extract" onclick="event.stopPropagation(); handleExtractMatch('${match.url}', this)" ${!match.url ? 'disabled' : ''}>
                📡 استخراج
            </button>
        </div>
    `;

    // Click on match row to select it
    item.onclick = () => {
        // Remove selection from all
        document.querySelectorAll('.match-item.selected').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        selectedMatchUrl = match.url;
    };

    return item;
}

// ═══════════════════════════════════════════════════
//  Filter Matches
// ═══════════════════════════════════════════════════

function filterMatches() {
    const query = document.getElementById('matches-search').value.toLowerCase().trim();
    const container = document.getElementById('matches-list-container');
    const groups = container.querySelectorAll('.league-group');
    let visibleMatches = 0;
    let visibleLeagues = 0;

    groups.forEach(group => {
        const leagueText = group.getAttribute('data-league') || '';
        const items = group.querySelectorAll('.match-item');
        let groupVisible = false;

        if (!query) {
            // Show all
            group.style.display = '';
            items.forEach(item => {
                item.style.display = '';
                visibleMatches++;
            });
            visibleLeagues++;
            return;
        }

        // Check if league name matches
        const leagueMatch = leagueText.includes(query);

        items.forEach(item => {
            const teamText = item.getAttribute('data-teams') || '';
            if (leagueMatch || teamText.includes(query)) {
                item.style.display = '';
                groupVisible = true;
                visibleMatches++;
            } else {
                item.style.display = 'none';
            }
        });

        if (groupVisible) {
            group.style.display = '';
            visibleLeagues++;
        } else {
            group.style.display = 'none';
        }
    });

    // Update filter status
    const statusEl = document.getElementById('filter-status-text');
    if (query) {
        statusEl.textContent = `${visibleMatches} match${visibleMatches !== 1 ? 'es' : ''} in ${visibleLeagues} league${visibleLeagues !== 1 ? 's' : ''}`;
    } else {
        statusEl.textContent = '';
    }
}

// ═══════════════════════════════════════════════════
//  Extract Match Data (from matches list)
// ═══════════════════════════════════════════════════

async function handleExtractMatch(matchUrl, btnElement) {
    if (!matchUrl) {
        showStatus('⚠️ رابط المباراة غير متاح', 'error');
        return;
    }

    // Select the match visually
    const matchItem = btnElement.closest('.match-item');
    document.querySelectorAll('.match-item.selected').forEach(el => el.classList.remove('selected'));
    matchItem.classList.add('selected');
    matchItem.classList.add('extracting');
    selectedMatchUrl = matchUrl;

    // Disable button and show loading
    btnElement.disabled = true;
    btnElement.classList.add('extracting-btn');
    const origText = btnElement.textContent;
    btnElement.textContent = '⏳ جاري...';

    showStatus(`📡 جاري استخراج بيانات المباراة... (قد يستغرق 30-60 ثانية)`, 'loading');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

        const response = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: matchUrl }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const result = await response.json();

        if (result.success) {
            extractedData = result.data;
            displayExtractedData(result.data);
            showStatus('✅ تم استخراج البيانات بنجاح! اضغط "تحليل المباراة" للمتابعة', 'success');
            document.getElementById('btn-analyze').disabled = false;

            // Add analyze button to this match item
            const actionsCol = matchItem.querySelector('.match-actions-col');
            // Remove any existing analyze button
            const existingAnalyze = actionsCol.querySelector('.btn-match-analyze');
            if (existingAnalyze) existingAnalyze.remove();
            
            const analyzeBtn = document.createElement('button');
            analyzeBtn.className = 'btn-match-analyze';
            analyzeBtn.innerHTML = '⚖️ تحليل';
            analyzeBtn.onclick = (e) => {
                e.stopPropagation();
                handleAnalyze();
            };
            actionsCol.appendChild(analyzeBtn);

            // Scroll data panel into view
            document.getElementById('data-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            showStatus(`❌ خطأ في الاستخراج: ${result.error}`, 'error');
        }

    } catch (error) {
        showStatus(`❌ خطأ في الاتصال بالسيرفر: ${error.message}`, 'error');
    }

    btnElement.disabled = false;
    btnElement.classList.remove('extracting-btn');
    btnElement.textContent = origText;
    matchItem.classList.remove('extracting');
}

// ═══════════════════════════════════════════════════
//  Extract from Manual URL
// ═══════════════════════════════════════════════════

async function handleExtractFromUrl() {
    const urlInput = document.getElementById('match-url');
    const url = urlInput.value.trim();

    if (!url) {
        showStatus('⚠️ الرجاء إدخال رابط المباراة من FlashScore', 'error');
        return;
    }

    if (!url.includes('flashscore')) {
        showStatus('⚠️ الرابط يجب أن يكون من flashscore.com', 'error');
        return;
    }

    const btnExtract = document.getElementById('btn-extract-url');
    btnExtract.disabled = true;
    btnExtract.classList.add('extracting');
    btnExtract.querySelector('.btn-text').textContent = 'جاري...';

    showStatus('📡 جاري الاتصال بـ FlashScore واستخراج البيانات...', 'loading');

    try {
        const response = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const result = await response.json();

        if (result.success) {
            extractedData = result.data;
            displayExtractedData(result.data);
            showStatus('✅ تم استخراج البيانات بنجاح! اضغط "تحليل المباراة" للمتابعة', 'success');
            document.getElementById('btn-analyze').disabled = false;
        } else {
            showStatus(`❌ خطأ في الاستخراج: ${result.error}`, 'error');
        }

    } catch (error) {
        showStatus(`❌ خطأ في الاتصال بالسيرفر: ${error.message}`, 'error');
    }

    btnExtract.disabled = false;
    btnExtract.classList.remove('extracting');
    btnExtract.querySelector('.btn-text').textContent = 'استخراج';
}

// ═══════════════════════════════════════════════════
//  Button 2: Analyze Match
// ═══════════════════════════════════════════════════

async function handleAnalyze() {
    if (!extractedData) {
        showStatus('⚠️ استخرج البيانات أولاً!', 'error');
        return;
    }

    const btnAnalyze = document.getElementById('btn-analyze');
    btnAnalyze.disabled = true;
    btnAnalyze.querySelector('.btn-text').textContent = 'جاري التحليل...';

    showStatus('⚖️ جاري تشغيل المحكمة وتحليل البيانات...', 'loading');

    // Clear courtroom
    const arena = document.getElementById('courtroom-arena');
    arena.innerHTML = '';
    document.getElementById('court-empty')?.remove();

    // Update court status
    const courtStatus = document.getElementById('court-status');
    courtStatus.classList.add('active');
    courtStatus.querySelector('span:last-child').textContent = 'الجلسة جارية...';

    // Run Analysis Engine
    const analysisResult = engine.analyze(extractedData);

    // Run Courtroom Session
    const courtroomResult = await courtroom.runSession(analysisResult, async (opinion) => {
        renderCharacterCard(opinion, arena);
        arena.scrollTop = arena.scrollHeight;
    });

    // Show Final Verdict
    showVerdict(courtroomResult, analysisResult);

    // Update status
    courtStatus.querySelector('span:last-child').textContent = 'انتهت الجلسة';
    showStatus('✅ اكتمل التحليل — راجع القرار النهائي', 'success');
    
    btnAnalyze.disabled = false;
    btnAnalyze.querySelector('.btn-text').textContent = 'تحليل المباراة';
}

// ═══════════════════════════════════════════════════
//  Display Extracted Data
// ═══════════════════════════════════════════════════

function displayExtractedData(data) {
    // Match Info
    if (data.matchInfo) {
        document.getElementById('match-info-card').classList.remove('hidden');
        document.getElementById('home-team-name').textContent = data.matchInfo.homeTeam || '—';
        document.getElementById('away-team-name').textContent = data.matchInfo.awayTeam || '—';
        document.getElementById('match-datetime').textContent = data.matchInfo.dateTime || '—';
        document.getElementById('match-league').textContent = data.matchInfo.league || '—';
        document.getElementById('match-round').textContent = data.matchInfo.round || '—';
    }

    // Standings
    if (data.standings) {
        document.getElementById('standings-section').classList.remove('hidden');
        
        if (data.standings.overall && data.standings.overall.length > 0) {
            renderStandingsTable('table-overall', data.standings.overall, data.matchInfo, true);
        }
        if (data.standings.home && data.standings.home.length > 0) {
            renderStandingsTable('table-home', data.standings.home, data.matchInfo, false);
        }
        if (data.standings.away && data.standings.away.length > 0) {
            renderStandingsTable('table-away', data.standings.away, data.matchInfo, false);
        }
    }

    // Last Matches
    if (data.lastMatches) {
        document.getElementById('last-matches-section').classList.remove('hidden');
        renderLastMatches('last-matches-home', data.lastMatches.home, data.matchInfo?.homeTeam);
        renderLastMatches('last-matches-away', data.lastMatches.away, data.matchInfo?.awayTeam);
    }

    // H2H
    if (data.h2h && data.h2h.length > 0) {
        document.getElementById('h2h-section').classList.remove('hidden');
        renderH2H('h2h-list', data.h2h);
    }

    // Odds
    if (data.odds) {
        document.getElementById('odds-section').classList.remove('hidden');
        document.getElementById('odd-home').textContent = data.odds.home || '—';
        document.getElementById('odd-draw').textContent = data.odds.draw || '—';
        document.getElementById('odd-away').textContent = data.odds.away || '—';
    }
}

// ─── Render Standings Table ───
function renderStandingsTable(tableId, teams, matchInfo, showForm) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    const homeTeam = matchInfo?.homeTeam?.toLowerCase() || '';
    const awayTeam = matchInfo?.awayTeam?.toLowerCase() || '';

    teams.forEach((team, index) => {
        const tr = document.createElement('tr');
        const teamName = (team.name || '').toLowerCase();
        
        if (teamName && (homeTeam.includes(teamName.substring(0, 5)) || teamName.includes(homeTeam.substring(0, 5)))) {
            tr.classList.add('highlight-home');
        } else if (teamName && (awayTeam.includes(teamName.substring(0, 5)) || teamName.includes(awayTeam.substring(0, 5)))) {
            tr.classList.add('highlight-away');
        }

        let formHTML = '';
        if (showForm && team.form && team.form.length > 0) {
            formHTML = team.form.map(f => `<span class="form-badge form-${f}">${f}</span>`).join('');
        }

        tr.innerHTML = `
            <td>${team.rank || index + 1}</td>
            <td>${team.name || '—'}</td>
            <td>${team.mp || '—'}</td>
            <td>${team.w || '—'}</td>
            <td>${team.d || '—'}</td>
            <td>${team.l || '—'}</td>
            <td>${team.goals || '—'}</td>
            <td>${team.gd || '—'}</td>
            <td><strong>${team.pts || '—'}</strong></td>
            ${showForm ? `<td>${formHTML || '—'}</td>` : ''}
        `;

        tbody.appendChild(tr);
    });
}

// ─── Render Last Matches ───
function renderLastMatches(containerId, matches, teamName) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (!matches || matches.length === 0) {
        container.innerHTML = '<div class="match-row"><span style="color: var(--text-muted)">لا توجد بيانات</span></div>';
        return;
    }

    matches.forEach(match => {
        const row = document.createElement('div');
        row.className = 'match-row';
        
        // Determine result
        let result = '—';
        if (match.score) {
            const parts = match.score.split('-').map(s => parseInt(s.trim()));
            if (parts.length === 2) {
                if (match.homeTeam && match.homeTeam.includes(teamName?.substring(0, 4))) {
                    result = parts[0] > parts[1] ? 'W' : parts[0] < parts[1] ? 'L' : 'D';
                } else {
                    result = parts[1] > parts[0] ? 'W' : parts[1] < parts[0] ? 'L' : 'D';
                }
            }
        }

        row.innerHTML = `
            <div class="match-result ${result}">${result}</div>
            <span class="match-opponent">${match.homeTeam || ''} vs ${match.awayTeam || ''}</span>
            <span class="match-score">${match.score || '—'}</span>
            <span class="match-date">${match.date || ''}</span>
        `;
        container.appendChild(row);
    });
}

// ─── Render H2H ───
function renderH2H(containerId, matches) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    matches.forEach(match => {
        const row = document.createElement('div');
        row.className = 'match-row';
        row.innerHTML = `
            <span class="match-date">${match.date || ''}</span>
            <span class="match-opponent">${match.home || ''}</span>
            <span class="match-score" style="color: var(--gold-primary)">${match.score || '—'}</span>
            <span class="match-opponent">${match.away || ''}</span>
        `;
        container.appendChild(row);
    });
}

// ═══════════════════════════════════════════════════
//  Render Courtroom Character Card
// ═══════════════════════════════════════════════════

function renderCharacterCard(opinion, container) {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.style.animationDelay = '0.1s';
    card.style.borderColor = opinion.character.color + '33';

    const voteClass = opinion.vote === 'for' ? 'for' : opinion.vote === 'against' ? 'against' : 'neutral';

    let pointsHTML = '';
    if (opinion.points && opinion.points.length > 0) {
        pointsHTML = '<ul class="char-points">' + 
            opinion.points.map(p => `<li>${p}</li>`).join('') + 
            '</ul>';
    }

    card.innerHTML = `
        <div class="character-header" style="border-bottom-color: ${opinion.character.color}22">
            <div class="char-avatar" style="border-color: ${opinion.character.color}55; background: ${opinion.character.color}11">
                ${opinion.character.emoji}
            </div>
            <div class="char-info">
                <div class="char-name" style="color: ${opinion.character.color}">${opinion.character.name}</div>
                <div class="char-role">${opinion.character.role}</div>
            </div>
            <span class="char-verdict-badge ${voteClass}">${opinion.voteLabel}</span>
        </div>
        <div class="character-body">
            <div class="char-analysis">${opinion.analysis}</div>
            ${pointsHTML}
        </div>
    `;

    container.appendChild(card);
}

// ═══════════════════════════════════════════════════
//  Show Final Verdict
// ═══════════════════════════════════════════════════

function showVerdict(courtroomResult, analysisResult) {
    const section = document.getElementById('verdict-section');
    const content = document.getElementById('verdict-content');
    section.classList.remove('hidden');

    const { bestOption, bestScore, accepted, votesFor, votesAgainst, votesNeutral } = courtroomResult;
    const { traps, scores } = analysisResult;

    // Get all scores
    let scoresHTML = '';
    Object.entries(scores).forEach(([opt, data]) => {
        const isHighest = opt === bestOption;
        scoresHTML += `<div class="verdict-stat">
            <span class="verdict-stat-label">${opt} — ${data.label}</span>
            <span class="verdict-stat-value ${isHighest ? (accepted ? 'green' : 'red') : 'gold'}">${data.score.toFixed(1)}%</span>
        </div>`;
    });

    // Reasons
    let prosHTML = '';
    let consHTML = '';
    let trapsHTML = '';

    // Generate reasons from analysis
    analysisResult.powerBalance.details.forEach(d => {
        if (d.includes('⭐') || d.includes('أعلى') || d.includes('أفضل') || d.includes('متقدم')) {
            prosHTML += `<div class="reason-item pro">✅ ${d}</div>`;
        }
    });
    analysisResult.homeAwayFactor.details.forEach(d => {
        if (d.includes('⭐') || d.includes('حصن')) {
            prosHTML += `<div class="reason-item pro">✅ ${d}</div>`;
        } else if (d.includes('⚠️')) {
            consHTML += `<div class="reason-item con">⚠️ ${d}</div>`;
        }
    });
    analysisResult.formAnalysis.details.forEach(d => {
        if (d.includes('⭐')) {
            prosHTML += `<div class="reason-item pro">✅ ${d}</div>`;
        } else if (d.includes('⚠️')) {
            consHTML += `<div class="reason-item con">⚠️ ${d}</div>`;
        }
    });

    traps.forEach(t => {
        const icon = t.severity === 'high' ? '🔴' : t.severity === 'medium' ? '🟡' : '🟢';
        trapsHTML += `<div class="reason-item trap">${icon} ${t.type}: ${t.description}</div>`;
    });

    content.innerHTML = `
        <div class="verdict-result">
            <div class="verdict-decision ${accepted ? 'attack' : 'skip'}">
                ${accepted ? '✅ هجوم — الفرصة مؤهلة' : '❌ تجاوز — لا توجد فرصة بثقة ≥ 90%'}
            </div>
            ${accepted ? `<div class="verdict-choice">${bestOption}</div>` : ''}
        </div>

        <div class="voting-summary">
            <div class="vote-group vote-for">
                <span>مع التوقع:</span>
                <span class="vote-count">${votesFor}</span>
            </div>
            <div class="vote-group vote-against">
                <span>ضد التوقع:</span>
                <span class="vote-count">${votesAgainst}</span>
            </div>
            <div class="vote-group" style="color: var(--orange)">
                <span>محايد:</span>
                <span class="vote-count" style="color: var(--orange)">${votesNeutral}</span>
            </div>
        </div>

        <div class="verdict-stats">
            ${scoresHTML}
        </div>

        ${prosHTML ? `<div class="verdict-reasons"><h4>✅ أسباب مؤيدة:</h4>${prosHTML}</div>` : ''}
        ${consHTML ? `<div class="verdict-reasons"><h4>⚠️ نقاط حذر:</h4>${consHTML}</div>` : ''}
        ${trapsHTML ? `<div class="verdict-reasons"><h4>🚨 الفخاخ المكتشفة:</h4>${trapsHTML}</div>` : ''}
    `;

    // Scroll to verdict
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═══════════════════════════════════════════════════
//  Manual Data Entry
// ═══════════════════════════════════════════════════

function toggleManualEntry() {
    const entry = document.getElementById('manual-entry');
    const arrow = document.getElementById('manual-toggle-arrow');
    
    entry.classList.toggle('hidden');
    arrow.classList.toggle('open');
}

function parseManualData() {
    const text = document.getElementById('manual-data').value.trim();
    if (!text) {
        showStatus('⚠️ الرجاء إدخال البيانات!', 'error');
        return;
    }

    try {
        // Parse manual data into structured format
        const data = parseTextToData(text);
        extractedData = data;
        displayExtractedData(data);
        showStatus('✅ تم تطبيق البيانات المدخلة يدوياً. اضغط "تحليل المباراة"', 'success');
        document.getElementById('btn-analyze').disabled = false;
    } catch (e) {
        showStatus(`❌ خطأ في تحليل البيانات: ${e.message}`, 'error');
    }
}

function parseTextToData(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    const data = {
        matchInfo: { homeTeam: '', awayTeam: '', league: '', round: '', dateTime: '' },
        standings: { overall: [], home: [], away: [] },
        lastMatches: { home: [], away: [] },
        h2h: [],
        odds: { home: null, draw: null, away: null }
    };

    let currentSection = '';

    lines.forEach(line => {
        const lowerLine = line.toLowerCase();

        // Detect sections
        if (lowerLine.includes('ترتيب العام') || lowerLine.includes('overall')) {
            currentSection = 'overall';
            return;
        }
        if (lowerLine.includes('ترتيب الديار') || lowerLine.includes('home standing')) {
            currentSection = 'home';
            return;
        }
        if (lowerLine.includes('ترتيب الخارج') || lowerLine.includes('away standing')) {
            currentSection = 'away';
            return;
        }
        if (lowerLine.includes('مواجهات') || lowerLine.includes('h2h')) {
            currentSection = 'h2h';
            return;
        }
        if (lowerLine.includes('odds') || lowerLine.includes('احتمالات')) {
            currentSection = 'odds';
            return;
        }

        // Parse match info
        if (line.includes('الدوري:') || line.includes('League:')) {
            data.matchInfo.league = line.split(':').slice(1).join(':').trim();
        }
        if (line.includes('المضيف:') || line.includes('Home:')) {
            data.matchInfo.homeTeam = line.split(':').slice(1).join(':').trim();
        }
        if (line.includes('الضيف:') || line.includes('Away:')) {
            data.matchInfo.awayTeam = line.split(':').slice(1).join(':').trim();
        }
        if (line.includes('التاريخ:') || line.includes('Date:')) {
            data.matchInfo.dateTime = line.split(':').slice(1).join(':').trim();
        }
        if (line.includes('الجولة:') || line.includes('Round:')) {
            data.matchInfo.round = line.split(':').slice(1).join(':').trim();
        }

        // Parse table rows (pipe-separated)
        if (line.includes('|') && !line.includes('---')) {
            const cells = line.split('|').map(c => c.trim()).filter(c => c);
            
            if (cells.length >= 7 && !isNaN(parseInt(cells[0])) && (currentSection === 'overall' || currentSection === 'home' || currentSection === 'away')) {
                const team = {
                    rank: parseInt(cells[0]),
                    name: cells[1].replace(/[⭐*]/g, '').trim(),
                    mp: cells[2],
                    w: cells[3],
                    d: cells[4],
                    l: cells[5],
                    goals: cells[6],
                    gd: cells.length > 7 ? cells[7] : '0',
                    pts: cells.length > 8 ? cells[8] : '0',
                    form: []
                };

                // Parse form from last column
                if (cells.length > 9) {
                    const formStr = cells[9];
                    team.form = formStr.split(/\s+/).filter(f => ['W', 'D', 'L'].includes(f));
                }

                if (currentSection === 'overall') data.standings.overall.push(team);
                else if (currentSection === 'home') data.standings.home.push(team);
                else if (currentSection === 'away') data.standings.away.push(team);
            }

            // Parse odds table
            if (currentSection === 'odds' && cells.length >= 3) {
                const vals = cells.map(c => parseFloat(c)).filter(v => !isNaN(v) && v > 1);
                if (vals.length >= 3) {
                    data.odds.home = vals[0];
                    data.odds.draw = vals[1];
                    data.odds.away = vals[2];
                }
            }
        }
    });

    return data;
}

// ═══════════════════════════════════════════════════
//  Utility Functions
// ═══════════════════════════════════════════════════

function showStatus(message, type = 'loading') {
    const bar = document.getElementById('status-bar');
    const text = document.getElementById('status-text');
    
    bar.classList.remove('hidden', 'error', 'success');
    
    if (type === 'error') bar.classList.add('error');
    else if (type === 'success') bar.classList.add('success');

    const spinner = bar.querySelector('.status-spinner');
    spinner.style.display = type === 'loading' ? 'block' : 'none';

    text.textContent = message;
}

// Country flag mapping
function getCountryFlag(country) {
    if (!country) return '🏴';
    const c = country.toUpperCase().trim();
    const flags = {
        'ENGLAND': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        'SPAIN': '🇪🇸',
        'GERMANY': '🇩🇪',
        'ITALY': '🇮🇹',
        'FRANCE': '🇫🇷',
        'PORTUGAL': '🇵🇹',
        'NETHERLANDS': '🇳🇱',
        'BELGIUM': '🇧🇪',
        'TURKEY': '🇹🇷',
        'GREECE': '🇬🇷',
        'SCOTLAND': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
        'BRAZIL': '🇧🇷',
        'ARGENTINA': '🇦🇷',
        'USA': '🇺🇸',
        'MEXICO': '🇲🇽',
        'JAPAN': '🇯🇵',
        'SOUTH KOREA': '🇰🇷',
        'AUSTRALIA': '🇦🇺',
        'ALGERIA': '🇩🇿',
        'EGYPT': '🇪🇬',
        'MOROCCO': '🇲🇦',
        'TUNISIA': '🇹🇳',
        'SAUDI ARABIA': '🇸🇦',
        'UAE': '🇦🇪',
        'QATAR': '🇶🇦',
        'RUSSIA': '🇷🇺',
        'UKRAINE': '🇺🇦',
        'POLAND': '🇵🇱',
        'CZECH REPUBLIC': '🇨🇿',
        'CZECHIA': '🇨🇿',
        'AUSTRIA': '🇦🇹',
        'SWITZERLAND': '🇨🇭',
        'CROATIA': '🇭🇷',
        'SERBIA': '🇷🇸',
        'ROMANIA': '🇷🇴',
        'DENMARK': '🇩🇰',
        'SWEDEN': '🇸🇪',
        'NORWAY': '🇳🇴',
        'FINLAND': '🇫🇮',
        'IRELAND': '🇮🇪',
        'WALES': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
        'CHINA': '🇨🇳',
        'INDIA': '🇮🇳',
        'COLOMBIA': '🇨🇴',
        'CHILE': '🇨🇱',
        'PERU': '🇵🇪',
        'PARAGUAY': '🇵🇾',
        'URUGUAY': '🇺🇾',
        'ECUADOR': '🇪🇨',
        'NIGERIA': '🇳🇬',
        'SOUTH AFRICA': '🇿🇦',
        'GHANA': '🇬🇭',
        'CAMEROON': '🇨🇲',
        'SENEGAL': '🇸🇳',
        'IVORY COAST': '🇨🇮',
        'WORLD': '🌍',
        'EUROPE': '🇪🇺',
        'AFRICA': '🌍',
        'ASIA': '🌏',
        'NORTH & CENTRAL AMERICA': '🌎',
        'SOUTH AMERICA': '🌎',
        'HUNGARY': '🇭🇺',
        'BULGARIA': '🇧🇬',
        'SLOVAKIA': '🇸🇰',
        'SLOVENIA': '🇸🇮',
        'BOSNIA AND HERZEGOVINA': '🇧🇦',
        'NORTH MACEDONIA': '🇲🇰',
        'ALBANIA': '🇦🇱',
        'MONTENEGRO': '🇲🇪',
        'KOSOVO': '🇽🇰',
        'ICELAND': '🇮🇸',
        'CYPRUS': '🇨🇾',
        'MALTA': '🇲🇹',
        'LUXEMBOURG': '🇱🇺',
        'ESTONIA': '🇪🇪',
        'LATVIA': '🇱🇻',
        'LITHUANIA': '🇱🇹',
        'GEORGIA': '🇬🇪',
        'ARMENIA': '🇦🇲',
        'AZERBAIJAN': '🇦🇿',
        'KAZAKHSTAN': '🇰🇿',
        'UZBEKISTAN': '🇺🇿',
        'IRAN': '🇮🇷',
        'IRAQ': '🇮🇶',
        'JORDAN': '🇯🇴',
        'KUWAIT': '🇰🇼',
        'BAHRAIN': '🇧🇭',
        'OMAN': '🇴🇲',
        'YEMEN': '🇾🇪',
        'LIBYA': '🇱🇾',
        'SUDAN': '🇸🇩',
        'ETHIOPIA': '🇪🇹',
        'KENYA': '🇰🇪',
        'TANZANIA': '🇹🇿',
        'UGANDA': '🇺🇬',
        'CONGO DR': '🇨🇩',
        'CONGO': '🇨🇬',
        'MALI': '🇲🇱',
        'GUINEA': '🇬🇳',
        'ZAMBIA': '🇿🇲',
        'ZIMBABWE': '🇿🇼',
        'MOZAMBIQUE': '🇲🇿',
        'ANGOLA': '🇦🇴',
        'COSTA RICA': '🇨🇷',
        'HONDURAS': '🇭🇳',
        'PANAMA': '🇵🇦',
        'GUATEMALA': '🇬🇹',
        'EL SALVADOR': '🇸🇻',
        'JAMAICA': '🇯🇲',
        'TRINIDAD AND TOBAGO': '🇹🇹',
        'CANADA': '🇨🇦',
        'THAILAND': '🇹🇭',
        'VIETNAM': '🇻🇳',
        'MALAYSIA': '🇲🇾',
        'INDONESIA': '🇮🇩',
        'SINGAPORE': '🇸🇬',
        'PHILIPPINES': '🇵🇭',
        'PALESTINE': '🇵🇸',
        'LEBANON': '🇱🇧',
        'SYRIA': '🇸🇾',
        'ISRAEL': '🇮🇱',
        'BOLIVIA': '🇧🇴',
        'VENEZUELA': '🇻🇪',
        'DOMINICAN REPUBLIC': '🇩🇴',
        'CUBA': '🇨🇺',
        'NEW ZEALAND': '🇳🇿',
    };
    return flags[c] || '🏴';
}

// ═══════════════════════════════════════════════════
//  🚀 AUTO-PILOT SYSTEM
//  Fully autonomous: Fetch → Extract → Analyze → Recommend
// ═══════════════════════════════════════════════════

// ─── League Filter: Only 1st & 2nd Division ───
function isAllowedLeague(leagueName) {
    const name = leagueName.toLowerCase();
    
    // ❌ EXCLUDE: Cups, knockouts, friendlies, youth, 3rd division+
    const excluded = [
        'cup', 'copa', 'coupe', 'pokal', 'trophy', 'shield',
        'كأس', 'كاس',
        'friendly', 'club friendly',
        'youth', 'u19', 'u20', 'u21', 'u23', 'reserve', 'women',
        'amateur', 'regional',
        'league 3', 'ligue 3', 'liga 3', 'serie c', 'serie d',
        'division 3', 'division 4', 'division 5',
        '3. liga', '3rd division', 'tercera', 'terza',
        'national league', 'conference league',
        'play offs', 'play-offs', 'playoff',
        'qualification', 'qualifying',
        'super cup', 'supercup', 'community shield',
    ];
    
    for (const ex of excluded) {
        if (name.includes(ex)) return false;
    }
    
    // ✅ ALLOW: 1st & 2nd division leagues
    const allowed = [
        // 1st Division keywords
        'premier league', 'la liga', 'laliga', 'bundesliga',
        'serie a', 'ligue 1', 'eredivisie', 'primeira liga',
        'super league', 'superliga', 'ekstraklasa',
        'premiership', 'pro league', 'super lig',
        'first division', '1. division', 'division 1',
        'league 1', 'liga 1', 'liga i',
        'ligue 1', 'serie a', 'a league',
        '1st league', 'first league', 'top league',
        'allsvenskan', 'eliteserien', 'veikkausliiga',
        'mls', 'j1 league', 'k league',
        'liga mx', 'brasileirao', 'serie a',
        'championship', 'jupiler', 'ligat',
        'saudi pro', 'stars league', 'indian super',
        'roshn', 'botola', 'ligue professionnelle',
        
        // 2nd Division keywords  
        '2. bundesliga', 'segunda', 'championship',
        'serie b', 'ligue 2', 'league 2',
        'segunda division', 'division 2', '2nd division',
        'liga 2', 'liga ii', '2. division',
        'eerste divisie', 'second league',
        '2nd league', 'serie b',
        
        // Direct league level markers
        'round', 'matchday', 'speeldag', 'spieltag', 'giornata', 'jornada',
    ];
    
    for (const al of allowed) {
        if (name.includes(al)) return true;
    }
    
    // If no keyword matched, still allow if it looks like a regular league
    // (has "league", "liga", "ligue", "serie", "division" without excluded terms)
    const leagueTerms = ['league', 'liga', 'ligue', 'serie', 'division', 'premiership'];
    for (const term of leagueTerms) {
        if (name.includes(term)) return true;
    }
    
    // Allow matches with "Round" in name (standard league matches)
    if (name.includes('round')) return true;
    
    // Default: skip unknown
    return false;
}

let autoPilotRunning = false;
let autoPilotStopped = false;
let acceptedMatches = [];

async function startAutoPilot() {
    if (autoPilotRunning) return;
    autoPilotRunning = true;
    autoPilotStopped = false;
    acceptedMatches = [];

    // UI: Show/hide buttons
    document.getElementById('btn-auto-pilot').classList.add('hidden');
    document.getElementById('btn-stop-pilot').classList.remove('hidden');
    document.getElementById('btn-fetch-matches').disabled = true;

    // Show progress section
    const progressEl = document.getElementById('autopilot-progress');
    progressEl.classList.remove('hidden');
    updateAutoPilotUI(0, 0, 0, 0, 0, 'جاري جلب المباريات...');

    // Show recommendations section
    const recSection = document.getElementById('recommendations-section');
    recSection.classList.remove('hidden');
    document.getElementById('recommendations-list').innerHTML = '';
    document.getElementById('rec-count-badge').textContent = '0';

    // Clear courtroom
    const arena = document.getElementById('courtroom-arena');
    arena.innerHTML = '<div class="autopilot-feed-header" style="text-align:center;padding:12px;color:var(--gold-primary);font-weight:700;">🚀 التشغيل التلقائي — سجل التحليل المباشر</div>';
    document.getElementById('court-empty')?.remove();

    // Update court status
    const courtStatus = document.getElementById('court-status');
    courtStatus.classList.add('active');
    courtStatus.querySelector('span:last-child').textContent = 'التشغيل التلقائي...';

    showStatus('🚀 بدء التشغيل التلقائي — جاري جلب المباريات...', 'loading');

    // ─── Step 1: Fetch all matches ───
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);
        const response = await fetch('/api/matches', { signal: controller.signal });
        clearTimeout(timeoutId);
        const result = await response.json();

        if (!result.success) {
            showStatus(`❌ فشل جلب المباريات: ${result.error}`, 'error');
            resetAutoPilotUI();
            return;
        }

        // Flatten matches
        allMatchesData = [];
        const allMatches = [];
        result.leagues.forEach(league => {
            league.matches.forEach(m => {
                allMatchesData.push(m);
                const leagueName = (m.league || league.league || '').toLowerCase();
                // Only include scheduled matches with URLs + filter leagues
                if (m.url && m.status === 'scheduled' && isAllowedLeague(leagueName)) {
                    allMatches.push({
                        ...m,
                        leagueName: m.league || league.league,
                        countryName: m.country || league.country
                    });
                }
            });
        });

        renderMatchesList(result.leagues);
        document.getElementById('matches-filter-section').classList.remove('hidden');
        document.getElementById('matches-count-badge').textContent = result.total;

        showStatus(`✅ تم جلب ${result.total} مباراة — بدء التحليل التلقائي (${allMatches.length} مباراة)...`, 'success');

        // ─── Step 2: Process each match ───
        const total = allMatches.length;
        let analyzed = 0;
        let accepted = 0;
        let rejected = 0;
        let errors = 0;

        for (let i = 0; i < total; i++) {
            if (autoPilotStopped) break;

            const match = allMatches[i];
            const matchName = `${match.homeTeam || 'Unknown'} vs ${match.awayTeam || 'Unknown'}`;
            const matchLeague = match.leagueName || match.league || '';
            const matchCountry = match.countryName || match.country || '';
            const remaining = total - i - 1;

            // Update progress
            updateAutoPilotUI(i + 1, total, accepted, rejected, remaining, matchName);
            document.getElementById('current-match-name').textContent = matchName;
            showStatus(`🔄 [${i + 1}/${total}] جاري تحليل: ${matchName}`, 'loading');

            // Add processing indicator to courtroom feed
            const feedProcessing = document.createElement('div');
            feedProcessing.className = 'autopilot-feed-item';
            feedProcessing.innerHTML = `<div class="feed-match-name">⏳ ${matchName}</div><div class="feed-result" style="color:var(--gold-primary)">جاري الاستخراج والتحليل...</div>`;
            arena.appendChild(feedProcessing);
            arena.scrollTop = arena.scrollHeight;

            try {
                // Extract data
                const extractCtrl = new AbortController();
                const extractTimeout = setTimeout(() => extractCtrl.abort(), 300000);
                
                const extractResponse = await fetch('/api/extract', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: match.url }),
                    signal: extractCtrl.signal
                });
                clearTimeout(extractTimeout);

                const extractResult = await extractResponse.json();

                if (!extractResult.success || !extractResult.data) {
                    // Failed extraction — skip
                    feedProcessing.className = 'autopilot-feed-item rejected';
                    feedProcessing.innerHTML = `<div class="feed-match-name">⚠️ ${matchName}</div><div class="feed-result rejected">فشل الاستخراج — تم التخطي</div>`;
                    errors++;
                    analyzed++;
                    continue;
                }

                // Display extracted data in the data panel (live view)
                extractedData = extractResult.data;
                displayExtractedData(extractResult.data);

                // Run Analysis Engine
                const analysisResult = engine.analyze(extractResult.data);
                const decision = analysisResult.decision;

                analyzed++;

                if (decision.accepted) {
                    // ✅ ACCEPTED
                    accepted++;
                    
                    // Update feed
                    feedProcessing.className = 'autopilot-feed-item accepted';
                    
                    // Build feed text showing which recommendations accepted
                    let feedParts = [];
                    if (decision.dcAccepted) feedParts.push(`${decision.bestOption} (${decision.confidence.toFixed(1)}%)`);
                    if (decision.goalsAccepted) feedParts.push(`Over 1.5 (${decision.goalsScore.toFixed(1)}%)`);
                    
                    feedProcessing.innerHTML = `
                        <div class="feed-match-name">✅ ${matchName}</div>
                        <div class="feed-result accepted">
                            ${feedParts.join(' | ')}
                        </div>
                    `;

                    // Add to accepted list — create separate items for DC and Goals
                    if (decision.dcAccepted) {
                        const dcItem = {
                            matchName,
                            league: matchLeague || extractResult.data.matchInfo?.league || '',
                            country: matchCountry || '',
                            time: match.time || extractResult.data.matchInfo?.dateTime || '',
                            recommendation: decision.bestOption,
                            type: 'فرصة مزدوجة',
                            confidence: decision.confidence,
                            verdict: decision.verdict,
                            action: `✅ ${decision.bestOption} (${decision.allScores[decision.bestOption].label})`,
                            url: match.url
                        };
                        acceptedMatches.push(dcItem);
                        renderRecommendation(dcItem);
                    }
                    
                    if (decision.goalsAccepted) {
                        const goalsItem = {
                            matchName,
                            league: matchLeague || extractResult.data.matchInfo?.league || '',
                            country: matchCountry || '',
                            time: match.time || extractResult.data.matchInfo?.dateTime || '',
                            recommendation: 'Over 1.5',
                            type: 'أكتر من 1.5 هدف',
                            confidence: decision.goalsScore,
                            verdict: `⚽ Over 1.5 — ثقة ${decision.goalsScore.toFixed(1)}%`,
                            action: '✅ أكتر من 1.5 هدف في المباراة',
                            url: match.url
                        };
                        acceptedMatches.push(goalsItem);
                        renderRecommendation(goalsItem);
                    }
                    
                    document.getElementById('rec-count-badge').textContent = acceptedMatches.length;

                } else {
                    // ❌ REJECTED
                    rejected++;
                    feedProcessing.className = 'autopilot-feed-item rejected';
                    feedProcessing.innerHTML = `
                        <div class="feed-match-name">❌ ${matchName}</div>
                        <div class="feed-result rejected">
                            ${decision.verdict} — ${decision.recommendation || 'تجاوز'} — ${decision.confidence ? decision.confidence.toFixed(1) + '%' : ''}
                        </div>
                    `;
                }

            } catch (err) {
                errors++;
                analyzed++;
                feedProcessing.className = 'autopilot-feed-item rejected';
                feedProcessing.innerHTML = `<div class="feed-match-name">⚠️ ${matchName}</div><div class="feed-result rejected">خطأ: ${err.message}</div>`;
            }

            arena.scrollTop = arena.scrollHeight;
            updateAutoPilotUI(i + 1, total, accepted, rejected, total - i - 1, '');
        }

        // ─── Step 3: Final Summary ───
        const statusText = autoPilotStopped ? 'تم الإيقاف' : 'اكتمل التحليل';
        document.getElementById('autopilot-status').textContent = statusText;
        document.getElementById('autopilot-status').style.animation = 'none';
        document.getElementById('current-match-name').textContent = statusText;
        
        courtStatus.querySelector('span:last-child').textContent = 'انتهت الجلسة';

        // Add summary to feed
        const summaryEl = document.createElement('div');
        summaryEl.className = 'autopilot-feed-item';
        summaryEl.style.borderRightColor = 'var(--gold-primary)';
        summaryEl.style.background = 'rgba(240, 185, 11, 0.08)';
        summaryEl.innerHTML = `
            <div class="feed-match-name" style="color:var(--gold-primary);font-size:1rem">🏆 ملخص التشغيل التلقائي</div>
            <div class="feed-result" style="color:var(--text-secondary)">
                تحليل: ${analyzed} مباراة | مقبولة: <span style="color:var(--green)">${accepted}</span> | مرفوضة: <span style="color:var(--red)">${rejected}</span> | أخطاء: ${errors}
            </div>
        `;
        arena.appendChild(summaryEl);
        arena.scrollTop = arena.scrollHeight;

        showStatus(`🏆 ${statusText}: ${accepted} مباراة مقبولة من ${analyzed} مباراة محللة`, 'success');

    } catch (error) {
        showStatus(`❌ خطأ في التشغيل التلقائي: ${error.message}`, 'error');
    }

    resetAutoPilotUI();
}

function stopAutoPilot() {
    autoPilotStopped = true;
    showStatus('⏹️ جاري إيقاف التشغيل التلقائي...', 'loading');
}

function resetAutoPilotUI() {
    autoPilotRunning = false;
    document.getElementById('btn-auto-pilot').classList.remove('hidden');
    document.getElementById('btn-stop-pilot').classList.add('hidden');
    document.getElementById('btn-fetch-matches').disabled = false;
}

function updateAutoPilotUI(current, total, accepted, rejected, remaining, matchName) {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    document.getElementById('autopilot-bar').style.width = percent + '%';
    document.getElementById('autopilot-percent').textContent = percent + '%';
    document.getElementById('stat-analyzed').textContent = current;
    document.getElementById('stat-accepted').textContent = accepted;
    document.getElementById('stat-rejected').textContent = rejected;
    document.getElementById('stat-remaining').textContent = remaining;
    if (matchName) {
        document.getElementById('current-match-name').textContent = matchName;
    }
}

function renderRecommendation(rec) {
    const list = document.getElementById('recommendations-list');
    const el = document.createElement('div');
    el.className = 'rec-item';
    
    const confidenceIcon = rec.confidence >= 75 ? '🟢' : '🟡';
    
    el.innerHTML = `
        <div class="rec-verdict">${confidenceIcon}</div>
        <div class="rec-info">
            <div class="rec-match-name">${rec.matchName}</div>
            <div class="rec-league">${rec.country ? rec.country + ' — ' : ''}${rec.league} ${rec.time ? '| ' + rec.time : ''}</div>
        </div>
        <div class="rec-details">
            <div class="rec-option">${rec.recommendation}</div>
            <div class="rec-confidence">ثقة ${rec.confidence.toFixed(1)}%</div>
            <div class="rec-action-text">${rec.action || ''}</div>
        </div>
    `;
    list.appendChild(el);
    
    // Scroll recommendations into view
    document.getElementById('recommendations-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── Auto-start on page load ───
document.addEventListener('DOMContentLoaded', () => {
    // Auto-start the pilot after a short delay
    setTimeout(() => {
        startAutoPilot();
    }, 2000);
});
