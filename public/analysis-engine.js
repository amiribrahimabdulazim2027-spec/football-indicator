/* ═══════════════════════════════════════════════════════
   🎯 Double Chance Analysis Engine
   Statistical algorithm implementing the prompt logic
   ═══════════════════════════════════════════════════════ */

class DoubleChanceEngine {
    constructor() {
        // Weights — MUST sum to 1.00 for mathematical correctness
        // Rebalanced: form+homeAway dominate, then standings, then secondary factors
        this.weights = {
            overallStandings: 0.18,  // 18% — league position & points
            homeAway: 0.25,          // 25% — home/away performance
            form: 0.25,              // 25% — recent form & momentum
            h2h: 0.10,               // 10% — head-to-head history
            motivation: 0.10,        // 10% — table position motivation
            odds: 0.07,              // 7%  — bookmaker implied probability
            trapPenalty: 0.05        // 5%  — penalty per trap detected
        };
        // Total = 0.18 + 0.25 + 0.25 + 0.10 + 0.10 + 0.07 + 0.05 = 1.00 ✅
    }

    /**
     * Main analysis function
     * @param {Object} data - Extracted match data
     * @returns {Object} - Complete analysis result
     */
    analyze(data) {
        const { matchInfo, standings, lastMatches, h2h, odds } = data;
        
        // Find the two teams in standings
        const homeTeam = matchInfo.homeTeam;
        const awayTeam = matchInfo.awayTeam;

        // Step 1: Power Balance
        const powerBalance = this.analyzePowerBalance(homeTeam, awayTeam, standings.overall);

        // Step 2: Home/Away Factor
        const homeAwayFactor = this.analyzeHomeAway(homeTeam, awayTeam, standings.home, standings.away);

        // Step 3: Form & Momentum
        const formAnalysis = this.analyzeForm(homeTeam, awayTeam, lastMatches, standings.overall);

        // Step 4: H2H
        const h2hAnalysis = this.analyzeH2H(homeTeam, awayTeam, h2h);

        // Step 5: Motivation
        const motivationAnalysis = this.analyzeMotivation(homeTeam, awayTeam, standings.overall);

        // Step 6: Odds Analysis
        const oddsAnalysis = this.analyzeOdds(odds);

        // Step 7: Detect Traps
        const traps = this.detectTraps(homeTeam, awayTeam, standings, lastMatches, odds, formAnalysis, powerBalance);

        // Step 8: Calculate confidence for each Double Chance option
        const scores = this.calculateScores(powerBalance, homeAwayFactor, formAnalysis, h2hAnalysis, motivationAnalysis, oddsAnalysis, traps);

        // Step 9: Over 1.5 Goals Analysis
        const goalsAnalysis = this.analyzeGoals(homeTeam, awayTeam, standings, lastMatches, h2h);

        // Step 10: Final Decision (includes Over 1.5)
        const decision = this.makeDecision(scores, traps, goalsAnalysis);

        return {
            matchInfo,
            powerBalance,
            homeAwayFactor,
            formAnalysis,
            h2hAnalysis,
            motivationAnalysis,
            oddsAnalysis,
            traps,
            scores,
            goalsAnalysis,
            decision
        };
    }

    // ─── Step 1: Power Balance Analysis ───
    analyzePowerBalance(homeTeam, awayTeam, overall) {
        const homeData = this.findTeam(homeTeam, overall);
        const awayData = this.findTeam(awayTeam, overall);

        if (!homeData || !awayData) {
            return { homeScore: 50, awayScore: 50, advantage: 'none', details: [] };
        }

        const details = [];
        let homeScore = 50;
        let awayScore = 50;

        // Rank comparison
        const rankDiff = awayData.rank - homeData.rank;
        if (rankDiff > 0) {
            const bonus = Math.min(rankDiff * 2, 20);
            homeScore += bonus;
            awayScore -= bonus;
            details.push(`المضيف أعلى ترتيباً بـ ${rankDiff} مراكز (+${bonus})`);
        } else if (rankDiff < 0) {
            const bonus = Math.min(Math.abs(rankDiff) * 2, 20);
            awayScore += bonus;
            homeScore -= bonus;
            details.push(`الضيف أعلى ترتيباً بـ ${Math.abs(rankDiff)} مراكز (+${bonus})`);
        }

        // Points comparison
        const homePts = parseInt(homeData.pts) || 0;
        const awayPts = parseInt(awayData.pts) || 0;
        const ptsDiff = homePts - awayPts;
        if (Math.abs(ptsDiff) > 3) {
            const bonus = Math.min(Math.abs(ptsDiff), 15);
            if (ptsDiff > 0) {
                homeScore += bonus;
                details.push(`المضيف متقدم بـ ${ptsDiff} نقاط`);
            } else {
                awayScore += bonus;
                details.push(`الضيف متقدم بـ ${Math.abs(ptsDiff)} نقاط`);
            }
        }

        // Goal difference
        const homeGD = parseInt(homeData.gd) || 0;
        const awayGD = parseInt(awayData.gd) || 0;
        if (homeGD > awayGD + 3) {
            homeScore += 5;
            details.push(`فارق أهداف المضيف أفضل (${homeGD > 0 ? '+' : ''}${homeGD} مقابل ${awayGD > 0 ? '+' : ''}${awayGD})`);
        } else if (awayGD > homeGD + 3) {
            awayScore += 5;
            details.push(`فارق أهداف الضيف أفضل (${awayGD > 0 ? '+' : ''}${awayGD} مقابل ${homeGD > 0 ? '+' : ''}${homeGD})`);
        }

        // Goal scoring rate
        const homeGoals = homeData.goals ? homeData.goals.split(':') : ['0', '0'];
        const awayGoals = awayData.goals ? awayData.goals.split(':') : ['0', '0'];
        const homeMp = parseInt(homeData.mp) || 1;
        const awayMp = parseInt(awayData.mp) || 1;

        const homeGpg = parseInt(homeGoals[0]) / homeMp;
        const awayGpg = parseInt(awayGoals[0]) / awayMp;
        const homeGcpg = parseInt(homeGoals[1]) / homeMp;
        const awayGcpg = parseInt(awayGoals[1]) / awayMp;

        details.push(`معدل تهديف المضيف: ${homeGpg.toFixed(2)} هدف/مباراة | استقبال: ${homeGcpg.toFixed(2)}`);
        details.push(`معدل تهديف الضيف: ${awayGpg.toFixed(2)} هدف/مباراة | استقبال: ${awayGcpg.toFixed(2)}`);

        return {
            homeScore: Math.min(homeScore, 100),
            awayScore: Math.min(awayScore, 100),
            advantage: homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'none',
            details,
            homeData,
            awayData
        };
    }

    // ─── Step 2: Home/Away Factor ───
    analyzeHomeAway(homeTeam, awayTeam, homeStandings, awayStandings) {
        const homeAtHome = this.findTeam(homeTeam, homeStandings);
        const awayAtAway = this.findTeam(awayTeam, awayStandings);

        const details = [];
        let homeStrength = 50;
        let awayStrength = 50;

        if (homeAtHome) {
            const mp = parseInt(homeAtHome.mp) || 1;
            const w = parseInt(homeAtHome.w) || 0;
            const d = parseInt(homeAtHome.d) || 0;
            const l = parseInt(homeAtHome.l) || 0;
            
            const winRate = (w / mp) * 100;
            const unbeatenRate = ((w + d) / mp) * 100;
            const hdi = ((w * 3 + d) / (mp * 3)) * 100;

            homeStrength = hdi;
            details.push(`مؤشر قوة المضيف في الديار (HDI): ${hdi.toFixed(1)}%`);
            details.push(`نسبة فوز المضيف في الديار: ${winRate.toFixed(1)}% (${w} من ${mp})`);
            details.push(`نسبة عدم خسارة المضيف في الديار: ${unbeatenRate.toFixed(1)}%`);
            
            if (l <= 1 && mp >= 8) {
                homeStrength += 10;
                details.push(`⭐ المضيف حصن في الديار — خسارة ${l} فقط`);
            }
        }

        if (awayAtAway) {
            const mp = parseInt(awayAtAway.mp) || 1;
            const w = parseInt(awayAtAway.w) || 0;
            const d = parseInt(awayAtAway.d) || 0;
            const l = parseInt(awayAtAway.l) || 0;

            const lossRate = (l / mp) * 100;
            const awi = lossRate;

            awayStrength = 100 - awi;
            details.push(`مؤشر ضعف الضيف في الخارج (AWI): ${awi.toFixed(1)}%`);
            details.push(`نسبة خسارة الضيف في الخارج: ${lossRate.toFixed(1)}% (${l} من ${mp})`);

            if (l >= mp * 0.6) {
                awayStrength -= 15;
                details.push(`⚠️ الضيف يخسر أكثر من 60% من مبارياته خارج أرضه!`);
            }
        }

        return {
            homeStrength: Math.max(0, Math.min(100, homeStrength)),
            awayStrength: Math.max(0, Math.min(100, awayStrength)),
            details,
            homeAtHome,
            awayAtAway
        };
    }

    // ─── Step 3: Form & Momentum ───
    analyzeForm(homeTeam, awayTeam, lastMatches, overall) {
        const details = [];
        
        // Get form from standings
        const homeData = this.findTeam(homeTeam, overall);
        const awayData = this.findTeam(awayTeam, overall);

        let homeForm = { w: 0, d: 0, l: 0, total: 0, streak: '', points: 0 };
        let awayForm = { w: 0, d: 0, l: 0, total: 0, streak: '', points: 0 };

        // Analyze home team form from standings
        if (homeData && homeData.form && homeData.form.length > 0) {
            homeData.form.forEach(r => {
                if (r === 'W') { homeForm.w++; homeForm.points += 3; }
                else if (r === 'D') { homeForm.d++; homeForm.points += 1; }
                else if (r === 'L') { homeForm.l++; }
                homeForm.total++;
            });
            homeForm.streak = homeData.form.join(' ');
        }

        // Analyze away team form
        if (awayData && awayData.form && awayData.form.length > 0) {
            awayData.form.forEach(r => {
                if (r === 'W') { awayForm.w++; awayForm.points += 3; }
                else if (r === 'D') { awayForm.d++; awayForm.points += 1; }
                else if (r === 'L') { awayForm.l++; }
                awayForm.total++;
            });
            awayForm.streak = awayData.form.join(' ');
        }

        // Also analyze from last matches if available
        if (lastMatches && lastMatches.home && lastMatches.home.length > 0) {
            details.push(`آخر ${lastMatches.home.length} مباريات للمضيف متاحة`);
        }
        if (lastMatches && lastMatches.away && lastMatches.away.length > 0) {
            details.push(`آخر ${lastMatches.away.length} مباريات للضيف متاحة`);
        }

        const homeFormScore = homeForm.total > 0 ? (homeForm.points / (homeForm.total * 3)) * 100 : 50;
        const awayFormScore = awayForm.total > 0 ? (awayForm.points / (awayForm.total * 3)) * 100 : 50;

        details.push(`فورم المضيف: ${homeForm.streak || 'غير متاح'} — ${homeFormScore.toFixed(1)}%`);
        details.push(`فورم الضيف: ${awayForm.streak || 'غير متاح'} — ${awayFormScore.toFixed(1)}%`);

        // Check for unbeaten streaks
        if (homeForm.l === 0 && homeForm.total >= 4) {
            details.push(`⭐ المضيف بدون خسارة في آخر ${homeForm.total} مباريات!`);
        }
        if (awayForm.l >= 3) {
            details.push(`⚠️ الضيف خسر ${awayForm.l} من آخر ${awayForm.total} مباريات!`);
        }

        // Volatility check
        const homeVolatile = this.checkVolatility(homeData?.form || []);
        const awayVolatile = this.checkVolatility(awayData?.form || []);

        if (homeVolatile) details.push(`⚠️ نتائج المضيف متذبذبة (WLWL pattern)`);
        if (awayVolatile) details.push(`⚠️ نتائج الضيف متذبذبة (WLWL pattern)`);

        return {
            homeFormScore,
            awayFormScore,
            homeForm,
            awayForm,
            homeVolatile,
            awayVolatile,
            details
        };
    }

    checkVolatility(form) {
        if (form.length < 4) return false;
        let changes = 0;
        for (let i = 1; i < form.length; i++) {
            if (form[i] !== form[i-1]) changes++;
        }
        return changes >= form.length - 1;
    }

    // ─── Step 4: H2H Analysis ───
    analyzeH2H(homeTeam, awayTeam, h2hData) {
        const details = [];
        let homeWins = 0, awayWins = 0, draws = 0;

        if (!h2hData || h2hData.length === 0) {
            details.push('لا توجد بيانات مواجهات مباشرة متاحة');
            return { homeWins, awayWins, draws, total: 0, details, dominance: 'none' };
        }

        h2hData.forEach(match => {
            if (match.score) {
                const parts = match.score.split('-').map(s => parseInt(s.trim()));
                if (parts.length === 2) {
                    if (parts[0] > parts[1]) {
                        // Home in this h2h match won
                        if (match.home && match.home.includes(homeTeam.substring(0, 5))) homeWins++;
                        else awayWins++;
                    } else if (parts[0] < parts[1]) {
                        if (match.home && match.home.includes(homeTeam.substring(0, 5))) awayWins++;
                        else homeWins++;
                    } else {
                        draws++;
                    }
                }
            }
        });

        const total = homeWins + awayWins + draws;
        if (total > 0) {
            details.push(`المواجهات: ${total} مباريات — المضيف ${homeWins} فوز | تعادل ${draws} | الضيف ${awayWins} فوز`);
        }

        let dominance = 'none';
        if (homeWins > awayWins + draws) dominance = 'home';
        else if (awayWins > homeWins + draws) dominance = 'away';

        return { homeWins, awayWins, draws, total, details, dominance };
    }

    // ─── Step 5: Motivation Analysis ───
    analyzeMotivation(homeTeam, awayTeam, overall) {
        const details = [];
        const homeData = this.findTeam(homeTeam, overall);
        const awayData = this.findTeam(awayTeam, overall);
        
        let homeMotivation = 50;
        let awayMotivation = 50;
        const totalTeams = overall.length || 16;

        if (homeData) {
            const rank = homeData.rank;
            if (rank <= 3) {
                homeMotivation = 85;
                details.push(`⭐ المضيف في مراكز البطولة (المركز ${rank}) — دافع عالي`);
            } else if (rank <= 6) {
                homeMotivation = 70;
                details.push(`المضيف يطمح للمراكز المتقدمة (المركز ${rank})`);
            } else if (rank >= totalTeams - 2) {
                homeMotivation = 80;
                details.push(`⚠️ المضيف مهدد بالهبوط (المركز ${rank}) — قتال!`);
            } else if (rank >= totalTeams - 5) {
                homeMotivation = 65;
                details.push(`المضيف في منطقة الخطر (المركز ${rank})`);
            } else {
                homeMotivation = 50;
                details.push(`المضيف في منطقة الوسط (المركز ${rank}) — دافع متوسط`);
            }
        }

        if (awayData) {
            const rank = awayData.rank;
            if (rank <= 3) {
                awayMotivation = 85;
                details.push(`⭐ الضيف في مراكز البطولة (المركز ${rank}) — دافع عالي`);
            } else if (rank <= 6) {
                awayMotivation = 70;
                details.push(`الضيف يطمح للمراكز المتقدمة (المركز ${rank})`);
            } else if (rank >= totalTeams - 2) {
                awayMotivation = 80;
                details.push(`⚠️ الضيف مهدد بالهبوط (المركز ${rank}) — قتال!`);
            } else if (rank >= totalTeams - 5) {
                awayMotivation = 65;
                details.push(`الضيف في منطقة الخطر (المركز ${rank})`);
            } else {
                awayMotivation = 50;
                details.push(`الضيف في منطقة الوسط (المركز ${rank}) — دافع متوسط`);
            }
        }

        return { homeMotivation, awayMotivation, details };
    }

    // ─── Step 6: Odds Analysis ───
    analyzeOdds(odds) {
        const details = [];
        
        if (!odds || !odds.home) {
            details.push('لا توجد بيانات أودز متاحة');
            return { impliedHome: 33, impliedDraw: 33, impliedAway: 33, details };
        }

        const homeOdds = parseFloat(odds.home) || 2;
        const drawOdds = parseFloat(odds.draw) || 3;
        const awayOdds = parseFloat(odds.away) || 3;

        // Convert odds to implied probability (removing overround)
        const totalProb = (1/homeOdds + 1/drawOdds + 1/awayOdds);
        const impliedHome = ((1/homeOdds) / totalProb) * 100;
        const impliedDraw = ((1/drawOdds) / totalProb) * 100;
        const impliedAway = ((1/awayOdds) / totalProb) * 100;

        details.push(`الاحتمال الضمني — المضيف: ${impliedHome.toFixed(1)}% | تعادل: ${impliedDraw.toFixed(1)}% | الضيف: ${impliedAway.toFixed(1)}%`);
        
        // Double Chance implied
        const dc1x = impliedHome + impliedDraw;
        const dcx2 = impliedDraw + impliedAway;
        const dc12 = impliedHome + impliedAway;

        details.push(`فرصة مزدوجة ضمنية — 1X: ${dc1x.toFixed(1)}% | X2: ${dcx2.toFixed(1)}% | 12: ${dc12.toFixed(1)}%`);

        return { impliedHome, impliedDraw, impliedAway, dc1x, dcx2, dc12, details };
    }

    // ─── Step 7: Detect Traps ───
    detectTraps(homeTeam, awayTeam, standings, lastMatches, odds, formAnalysis, powerBalance) {
        const traps = [];

        // Trap 1: Fake form — good form but against weak teams only
        if (formAnalysis.homeFormScore > 70 && powerBalance.homeData) {
            const homeRank = powerBalance.homeData.rank;
            if (homeRank > 6) {
                traps.push({
                    type: 'فخ الفورم المزيف',
                    severity: 'medium',
                    description: `المضيف فورمه جيد (${formAnalysis.homeFormScore.toFixed(0)}%) لكن مركزه ${homeRank} — قد يكون الفورم ضد فرق ضعيفة`,
                    impact: -5
                });
            }
        }

        // Trap 2: Misleading ranking
        if (powerBalance.homeData && powerBalance.awayData) {
            const homeOverallRank = powerBalance.homeData.rank;
            const homeAtHome = this.findTeam(homeTeam, standings.home);
            if (homeAtHome && Math.abs(homeAtHome.rank - homeOverallRank) > 4) {
                traps.push({
                    type: 'فخ الترتيب المضلل',
                    severity: 'high',
                    description: `المضيف مركزه العام ${homeOverallRank} لكن في الديار ${homeAtHome.rank} — فارق كبير!`,
                    impact: -8
                });
            }

            const awayOverallRank = powerBalance.awayData.rank;
            const awayAtAway = this.findTeam(awayTeam, standings.away);
            if (awayAtAway && awayAtAway.rank < awayOverallRank - 4) {
                traps.push({
                    type: 'فخ الترتيب المضلل',
                    severity: 'medium',
                    description: `الضيف مركزه العام ${awayOverallRank} لكن في الخارج ${awayAtAway.rank} — أفضل من المتوقع!`,
                    impact: -5
                });
            }
        }

        // Trap 3: Too low odds
        if (odds && odds.home) {
            const homeOdds = parseFloat(odds.home);
            if (homeOdds < 1.25) {
                traps.push({
                    type: 'فخ الأودز المنخفضة',
                    severity: 'medium',
                    description: `أودز المضيف منخفضة جداً (${homeOdds}) — قد لا تعكس واقع المباراة`,
                    impact: -5
                });
            }
        }

        // Trap 4: Motivation trap
        if (powerBalance.homeData && powerBalance.homeData.rank) {
            const totalTeams = standings.overall.length || 16;
            const homeRank = powerBalance.homeData.rank;
            const midTable = Math.floor(totalTeams / 2);
            if (homeRank > 5 && homeRank < totalTeams - 3) {
                // Mid-table team with nothing to play for
                traps.push({
                    type: 'فخ الدافعية',
                    severity: 'low',
                    description: `المضيف في وسط الجدول (المركز ${homeRank}) — قد يلعب بدون ضغط`,
                    impact: -3
                });
            }
        }

        // Trap 5: Volatile results
        if (formAnalysis.homeVolatile) {
            traps.push({
                type: 'فخ النتائج المتذبذبة',
                severity: 'high',
                description: 'نتائج المضيف غير مستقرة (WLWL) — خطر عدم استقرار',
                impact: -8
            });
        }
        if (formAnalysis.awayVolatile) {
            traps.push({
                type: 'فخ النتائج المتذبذبة',
                severity: 'medium',
                description: 'نتائج الضيف غير مستقرة (WLWL) — صعوبة التنبؤ',
                impact: -5
            });
        }

        // Trap 6: Negative goal difference with good points
        if (powerBalance.homeData) {
            const gd = parseInt(powerBalance.homeData.gd) || 0;
            const pts = parseInt(powerBalance.homeData.pts) || 0;
            if (gd < 0 && pts > 25) {
                traps.push({
                    type: 'فخ فارق الأهداف السلبي',
                    severity: 'medium',
                    description: `المضيف لديه ${pts} نقطة لكن فارق أهدافه سلبي (${gd}) — انتصارات هشة`,
                    impact: -5
                });
            }
        }

        // Trap 7: Games in hand
        if (powerBalance.homeData && powerBalance.awayData) {
            const homeMp = parseInt(powerBalance.homeData.mp) || 0;
            const awayMp = parseInt(powerBalance.awayData.mp) || 0;
            if (Math.abs(homeMp - awayMp) >= 3) {
                traps.push({
                    type: 'فخ المباريات القليلة',
                    severity: 'low',
                    description: `فارق مباريات ملعوبة: المضيف ${homeMp} | الضيف ${awayMp} — الترتيب قد لا يعكس الوضع الحقيقي`,
                    impact: -3
                });
            }
        }

        return traps;
    }

    // ─── Step 8: Calculate Scores ───
    calculateScores(power, homeAway, form, h2h, motivation, odds, traps) {
        // Calculate base scores for each Double Chance option

        // ─── 1X (Home win or Draw) ───
        let score1X = 50;
        
        // Power balance contribution
        score1X += (power.homeScore - 50) * this.weights.overallStandings;
        
        // Home/Away factor — strong home = good for 1X
        if (homeAway.homeStrength > 55) {
            score1X += (homeAway.homeStrength - 50) * this.weights.homeAway;
        }
        if (homeAway.awayStrength < 45) {
            score1X += (50 - homeAway.awayStrength) * this.weights.homeAway * 0.6;
        }

        // Form (25%)
        score1X += (form.homeFormScore - 50) * this.weights.form * 0.6;
        score1X += (50 - form.awayFormScore) * this.weights.form * 0.4;

        // H2H (10%)
        if (h2h.total > 0) {
            const h2hHome = (h2h.homeWins + h2h.draws * 0.5) / h2h.total;
            score1X += (h2hHome * 100 - 50) * this.weights.h2h;
        }

        // Motivation (10%)
        score1X += (motivation.homeMotivation - 50) * this.weights.motivation * 0.5;

        // Odds (5%)
        if (odds.dc1x) {
            score1X += (odds.dc1x - 50) * this.weights.odds * 0.5;
        }

        // ─── X2 (Draw or Away win) ───
        let scoreX2 = 50;
        
        scoreX2 += (power.awayScore - 50) * this.weights.overallStandings;
        
        if (homeAway.awayStrength > 50) {
            scoreX2 += (homeAway.awayStrength - 50) * this.weights.homeAway;
        }
        if (homeAway.homeStrength < 60) {
            scoreX2 += (60 - homeAway.homeStrength) * this.weights.homeAway * 0.3;
        }

        scoreX2 += (form.awayFormScore - 50) * this.weights.form * 0.6;
        scoreX2 += (50 - form.homeFormScore) * this.weights.form * 0.4;

        if (h2h.total > 0) {
            const h2hAway = (h2h.awayWins + h2h.draws * 0.5) / h2h.total;
            scoreX2 += (h2hAway * 100 - 50) * this.weights.h2h;
        }

        scoreX2 += (motivation.awayMotivation - 50) * this.weights.motivation * 0.5;

        if (odds.dcx2) {
            scoreX2 += (odds.dcx2 - 50) * this.weights.odds * 0.5;
        }

        // ─── 12 (Home or Away win — no draw) ───
        let score12 = 50;
        
        // Both teams strong => higher chance of decisive result
        const strongerPower = Math.max(power.homeScore, power.awayScore);
        score12 += (strongerPower - 50) * this.weights.overallStandings;

        // If one team dominates home AND the other is bad away, 12 is likely
        if (homeAway.homeStrength > 65 && homeAway.awayStrength < 40) {
            score12 += 10;
        }

        // Form — if neither team draws much
        const homeDraw = form.homeForm.d / Math.max(form.homeForm.total, 1);
        const awayDraw = form.awayForm.d / Math.max(form.awayForm.total, 1);
        if (homeDraw < 0.2 && awayDraw < 0.2) {
            score12 += 8;
        }

        if (odds.dc12) {
            score12 += (odds.dc12 - 50) * this.weights.odds * 0.5;
        }

        // ─── Apply trap penalties ───
        let totalTrapPenalty = 0;
        traps.forEach(trap => {
            totalTrapPenalty += Math.abs(trap.impact);
        });

        // Apply penalty proportionally (reduced — traps already penalize in decision)
        score1X -= totalTrapPenalty * 0.3;
        scoreX2 -= totalTrapPenalty * 0.3;
        score12 -= totalTrapPenalty * 0.4;

        // Normalize to realistic range (don't inflate)
        score1X = this.normalizeScore(score1X);
        scoreX2 = this.normalizeScore(scoreX2);
        score12 = this.normalizeScore(score12);

        return {
            '1X': { score: score1X, label: 'فوز مضيف أو تعادل' },
            'X2': { score: scoreX2, label: 'تعادل أو فوز ضيف' },
            '12': { score: score12, label: 'فوز مضيف أو فوز ضيف' }
        };
    }

    // ─── Over 1.5 Goals Analysis ───
    analyzeGoals(homeTeam, awayTeam, standings, lastMatches, h2h) {
        let score = 50; // Start neutral
        const details = [];

        // Helper: parse "30:11" → { for: 30, against: 11 }
        function parseGoals(goalsStr) {
            if (!goalsStr) return { f: 0, a: 0 };
            const parts = goalsStr.split(':');
            return { f: parseInt(parts[0]) || 0, a: parseInt(parts[1]) || 0 };
        }

        // Helper: parse "0 - 1" → [0, 1]
        function parseScore(scoreStr) {
            if (!scoreStr) return [0, 0];
            const parts = scoreStr.split('-').map(s => parseInt(s.trim()) || 0);
            return [parts[0] || 0, parts[1] || 0];
        }

        // 1. Average goals from overall standings
        const homeOverall = this.findTeam(homeTeam, standings.overall);
        const awayOverall = this.findTeam(awayTeam, standings.overall);

        if (homeOverall && awayOverall) {
            const hGoals = parseGoals(homeOverall.goals);
            const aGoals = parseGoals(awayOverall.goals);
            const hMp = parseInt(homeOverall.mp) || 1;
            const aMp = parseInt(awayOverall.mp) || 1;

            const homeGoalsPerMatch = hGoals.f / hMp;
            const awayGoalsPerMatch = aGoals.f / aMp;
            const homeConcededPerMatch = hGoals.a / hMp;
            const awayConcededPerMatch = aGoals.a / aMp;

            const expectedGoals = (homeGoalsPerMatch + awayGoalsPerMatch + homeConcededPerMatch + awayConcededPerMatch) / 2;
            
            if (expectedGoals >= 3.0) {
                score += 20;
                details.push(`⚽ معدل أهداف عالي جداً: ${expectedGoals.toFixed(1)} هدف/مباراة`);
            } else if (expectedGoals >= 2.5) {
                score += 15;
                details.push(`⚽ معدل أهداف جيد: ${expectedGoals.toFixed(1)} هدف/مباراة`);
            } else if (expectedGoals >= 2.0) {
                score += 8;
                details.push(`⚽ معدل أهداف متوسط: ${expectedGoals.toFixed(1)} هدف/مباراة`);
            } else {
                score -= 10;
                details.push(`⚽ معدل أهداف منخفض: ${expectedGoals.toFixed(1)} هدف/مباراة`);
            }
        }

        // 2. Home team scoring at home
        const homeHome = this.findTeam(homeTeam, standings.home);
        if (homeHome) {
            const hg = parseGoals(homeHome.goals);
            const mp = parseInt(homeHome.mp) || 1;
            const homeHomeScoringRate = hg.f / mp;
            if (homeHomeScoringRate >= 2.0) {
                score += 12;
                details.push(`🏠 المضيف يسجل ${homeHomeScoringRate.toFixed(1)} هدف/مباراة في الديار`);
            } else if (homeHomeScoringRate >= 1.5) {
                score += 8;
                details.push(`🏠 المضيف يسجل ${homeHomeScoringRate.toFixed(1)} هدف/مباراة في الديار`);
            }
        }

        // 3. Away team conceding away
        const awayAway = this.findTeam(awayTeam, standings.away);
        if (awayAway) {
            const ag = parseGoals(awayAway.goals);
            const mp = parseInt(awayAway.mp) || 1;
            const awayConcedingRate = ag.a / mp;
            if (awayConcedingRate >= 2.0) {
                score += 12;
                details.push(`✈️ الضيف يستقبل ${awayConcedingRate.toFixed(1)} هدف/مباراة خارج أرضه`);
            } else if (awayConcedingRate >= 1.5) {
                score += 8;
                details.push(`✈️ الضيف يستقبل ${awayConcedingRate.toFixed(1)} هدف/مباراة خارج أرضه`);
            }
        }

        // 4. Recent form goals (last 5 matches)
        let recentGoals = 0;
        let recentMatchCount = 0;

        if (lastMatches?.home && lastMatches.home.length > 0) {
            lastMatches.home.forEach(m => {
                const [s1, s2] = parseScore(m.score);
                recentGoals += s1 + s2;
                recentMatchCount++;
            });
        }
        if (lastMatches?.away && lastMatches.away.length > 0) {
            lastMatches.away.forEach(m => {
                const [s1, s2] = parseScore(m.score);
                recentGoals += s1 + s2;
                recentMatchCount++;
            });
        }

        if (recentMatchCount > 0) {
            const avgRecentGoals = recentGoals / recentMatchCount;
            if (avgRecentGoals >= 3.0) {
                score += 10;
                details.push(`📊 آخر المباريات: ${avgRecentGoals.toFixed(1)} هدف/مباراة — مرتفع`);
            } else if (avgRecentGoals >= 2.0) {
                score += 5;
                details.push(`📊 آخر المباريات: ${avgRecentGoals.toFixed(1)} هدف/مباراة`);
            } else {
                score -= 5;
                details.push(`📊 آخر المباريات: ${avgRecentGoals.toFixed(1)} هدف/مباراة — منخفض`);
            }
        }

        // 5. H2H goals
        if (h2h && h2h.length > 0) {
            let h2hGoals = 0;
            h2h.forEach(m => {
                const [s1, s2] = parseScore(m.score);
                h2hGoals += s1 + s2;
            });
            const avgH2H = h2hGoals / h2h.length;
            if (avgH2H >= 2.5) {
                score += 8;
                details.push(`🤝 المواجهات المباشرة: ${avgH2H.toFixed(1)} هدف/مباراة`);
            }
        }

        // Cap score
        score = Math.max(10, Math.min(98, score));

        const accepted = score >= 75;
        const verdict = accepted ? '⚽ أكتر من 1.5 — ادخل ✅' : (score >= 60 ? '⚽ أكتر من 1.5 — محتمل ⚠️' : '⚽ أقل من 1.5 — تجنب ❌');

        return {
            score,
            accepted,
            verdict,
            details,
            label: 'Over 1.5 Goals'
        };
    }

    normalizeScore(score) {
        // Keep scores realistic — cap at 95% and floor at 20%
        // Well-calibrated matches should fall between 45-85%
        // Only truly dominant matchups should exceed 85%
        score = Math.max(20, Math.min(95, score));
        return Math.round(score * 10) / 10;
    }

    // ─── Step 9: Make Decision (TWO independent recommendations) ───
    makeDecision(scores, traps, goalsAnalysis) {
        // Find the best DC option
        let bestOption = null;
        let bestScore = 0;

        Object.entries(scores).forEach(([option, data]) => {
            if (data.score > bestScore) {
                bestScore = data.score;
                bestOption = option;
            }
        });

        const confidence = Math.min(99, bestScore);
        
        // Trap severity impact
        let trapSeverity = 0;
        traps.forEach(t => {
            if (t.severity === 'high') trapSeverity += 15;
            else if (t.severity === 'medium') trapSeverity += 8;
            else trapSeverity += 3;
        });

        const adjustedConfidence = Math.max(10, confidence - trapSeverity * 0.3);
        const highTraps = traps.filter(t => t.severity === 'high').length;

        // ═══════════════════════════════════════
        // توصية 1: فرصة مزدوجة (DC) — مستقلة
        // ═══════════════════════════════════════
        let dcAccepted = false;
        let dcVerdict, dcAction;
        
        if (adjustedConfidence >= 72 && highTraps === 0) {
            dcAccepted = true;
            dcVerdict = `🟢 ${bestOption} (${scores[bestOption].label}) — ثقة ${adjustedConfidence.toFixed(1)}%`;
            dcAction = `✅ ادخل بـ ${bestOption} (${scores[bestOption].label})`;
        } else if (adjustedConfidence >= 65 && highTraps === 0) {
            // Cautious accept — signal but warn
            dcAccepted = true;
            dcVerdict = `🟡 ${bestOption} (${scores[bestOption].label}) — ثقة ${adjustedConfidence.toFixed(1)}% — بحذر`;
            dcAction = `⚠️ ادخل بحذر بـ ${bestOption} (${scores[bestOption].label})`;
        } else {
            dcVerdict = `🔴 فرصة مزدوجة — ثقة ${adjustedConfidence.toFixed(1)}% — غير كافية`;
            dcAction = 'لا تدخل';
        }

        // ═══════════════════════════════════════
        // توصية 2: أكتر من 1.5 — مستقلة
        // ═══════════════════════════════════════
        let goalsAccepted = false;
        let goalsVerdict, goalsAction;
        const goalsScore = goalsAnalysis ? goalsAnalysis.score : 0;

        if (goalsScore >= 72 && highTraps === 0) {
            goalsAccepted = true;
            goalsVerdict = `⚽ Over 1.5 — ثقة ${goalsScore.toFixed(1)}%`;
            goalsAction = '✅ ادخل Over 1.5 Goals';
        } else if (goalsScore >= 65 && highTraps === 0) {
            goalsAccepted = true;
            goalsVerdict = `⚽ Over 1.5 — ثقة ${goalsScore.toFixed(1)}% — بحذر`;
            goalsAction = '⚠️ ادخل Over 1.5 بحذر';
        } else {
            goalsVerdict = `🔴 Over 1.5 — ثقة ${goalsScore.toFixed(1)}% — غير كافية`;
            goalsAction = 'لا تدخل';
        }

        // ═══════════════════════════════════════
        // القرار النهائي: مقبول لو واحدة على الأقل اتقبلت
        // ═══════════════════════════════════════
        const accepted = dcAccepted || goalsAccepted;
        
        let verdict, verdictClass, action, recommendation;
        if (dcAccepted && goalsAccepted) {
            verdict = '🟢 مباراة مضمونة — فرصتين ✅';
            verdictClass = 'attack';
            action = dcAction + ' + ' + goalsAction;
            recommendation = bestOption + ' + Over 1.5';
        } else if (dcAccepted) {
            verdict = dcVerdict;
            verdictClass = 'attack';
            action = dcAction;
            recommendation = bestOption;
        } else if (goalsAccepted) {
            verdict = goalsVerdict;
            verdictClass = 'attack';
            action = goalsAction;
            recommendation = 'Over 1.5';
        } else {
            verdict = adjustedConfidence >= 65 ? '🟡 غير مضمونة ⚠️' : '🔴 تجاوز ❌';
            verdictClass = adjustedConfidence >= 65 ? 'caution' : 'skip';
            action = 'لا تدخل — المباراة مش مضمونة';
            recommendation = 'تجاوز';
        }

        // Build reasoning
        const pros = [];
        const cons = [];

        Object.entries(scores).forEach(([option, data]) => {
            if (data.score >= 70) {
                pros.push(`${option} (${data.label}): ${data.score.toFixed(1)}% — مؤشر قوي`);
            } else if (data.score >= 60) {
                pros.push(`${option} (${data.label}): ${data.score.toFixed(1)}% — مؤشر جيد`);
            } else if (data.score < 40) {
                cons.push(`${option} (${data.label}): ${data.score.toFixed(1)}% — مؤشر ضعيف`);
            }
        });

        if (goalsAnalysis) {
            if (goalsAccepted) {
                pros.push(`⚽ Over 1.5: ${goalsScore.toFixed(1)}% — أهداف متوقعة`);
            }
            goalsAnalysis.details.forEach(d => pros.push(d));
        }

        if (traps.length === 0) {
            pros.push('لا توجد فخاخ مكتشفة — وضع آمن');
        }

        traps.forEach(t => {
            cons.push(`${t.type}: ${t.description}`);
        });

        return {
            bestOption,
            bestScore,
            confidence: adjustedConfidence,
            accepted,
            dcAccepted,
            goalsAccepted,
            goalsScore,
            verdict,
            verdictClass,
            action,
            recommendation,
            reasons: {
                pros,
                cons,
                traps: traps.map(t => `${t.type}: ${t.description}`)
            },
            allScores: scores
        };
    }

    // ─── Utility: Find team in standings ───
    findTeam(teamName, standings) {
        if (!standings || !Array.isArray(standings) || !teamName) return null;
        
        const normalized = teamName.toLowerCase().trim();
        
        return standings.find(team => {
            if (!team.name) return false;
            const tn = team.name.toLowerCase().trim();
            return tn.includes(normalized) || 
                   normalized.includes(tn) ||
                   tn.includes(normalized.substring(0, 5)) ||
                   normalized.includes(tn.substring(0, 5));
        });
    }
}

// Export
window.DoubleChanceEngine = DoubleChanceEngine;
