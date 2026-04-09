/* ═══════════════════════════════════════════════════════
   ⚖️ Courtroom System — 10 AI Characters
   Each character analyzes from their unique perspective
   ═══════════════════════════════════════════════════════ */

class CourtroomSystem {
    constructor() {
        this.characters = [
            {
                id: 'judge',
                name: 'رئيس المحكمة: أمير',
                emoji: '👨‍⚖️',
                role: 'يدير الجلسة ويصدر الحكم النهائي',
                color: '#f0b90b',
                order: 10 // Last to speak
            },
            {
                id: 'skeptic',
                name: 'المتشكك',
                emoji: '🤨',
                role: 'يشكك في كل شيء — يبحث عن الثغرات',
                color: '#ff9100',
                order: 1
            },
            {
                id: 'calculator',
                name: 'الحسابي',
                emoji: '🧮',
                role: 'تحليل رقمي بحت — الأرقام فقط',
                color: '#448aff',
                order: 2
            },
            {
                id: 'prosecutor',
                name: 'وكيل النيابة',
                emoji: '⚔️',
                role: 'يهاجم التوقع — يبحث عن أسباب الفشل',
                color: '#ff4757',
                order: 3
            },
            {
                id: 'expert',
                name: 'المشاهد الخبير',
                emoji: '🔬',
                role: 'خبرة ميدانية — تحليل السياق',
                color: '#18ffff',
                order: 4
            },
            {
                id: 'defense',
                name: 'محامي الدفاع',
                emoji: '🛡️',
                role: 'يدافع عن التوقع — يقدم الأدلة المؤيدة',
                color: '#00e676',
                order: 5
            },
            {
                id: 'opponent',
                name: 'محامي الخصم',
                emoji: '⚡',
                role: 'يعارض التوقع — يقدم السيناريو المعاكس',
                color: '#ff6b81',
                order: 6
            },
            {
                id: 'intelligence',
                name: 'نبض الذكاء',
                emoji: '🧠',
                role: 'كشف الأنماط المخفية في البيانات',
                color: '#b388ff',
                order: 7
            },
            {
                id: 'deep',
                name: 'التفكير العميق',
                emoji: '🌊',
                role: 'تحليل استراتيجي — يربط كل العوامل',
                color: '#64b5f6',
                order: 8
            },
            {
                id: 'detective',
                name: 'رئيس المباحث',
                emoji: '🕵️',
                role: 'كشف الفخاخ الإحصائية',
                color: '#ffd740',
                order: 9
            }
        ];
    }

    /**
     * Run the courtroom analysis
     * @param {Object} analysisResult - Result from DoubleChanceEngine
     * @param {Function} onCharacterSpeak - Callback when a character speaks
     * @returns {Object} - Final courtroom verdict
     */
    async runSession(analysisResult, onCharacterSpeak) {
        const { scores, traps, powerBalance, homeAwayFactor, formAnalysis, h2hAnalysis, motivationAnalysis, oddsAnalysis, matchInfo, decision } = analysisResult;

        const bestOption = decision.bestOption;
        const bestScore = decision.bestScore;

        // Sort characters by order
        const orderedChars = [...this.characters].sort((a, b) => a.order - b.order);

        const opinions = [];

        for (const char of orderedChars) {
            const opinion = this.generateOpinion(char, analysisResult);
            opinions.push(opinion);
            
            if (onCharacterSpeak) {
                await onCharacterSpeak(opinion);
                await this.delay(800);
            }
        }

        // Count votes
        const votesFor = opinions.filter(o => o.vote === 'for').length;
        const votesAgainst = opinions.filter(o => o.vote === 'against').length;
        const votesNeutral = opinions.filter(o => o.vote === 'neutral').length;

        // Final verdict — aligned with engine thresholds (72% strong, 65% cautious)
        const highTraps = (analysisResult.traps || []).filter(t => t.severity === 'high').length;
        const dcAccepted = analysisResult.decision?.dcAccepted || false;
        const goalsAccepted = analysisResult.decision?.goalsAccepted || false;
        const anyAccepted = dcAccepted || goalsAccepted;
        
        // Judge approves if engine approved AND votes aren't overwhelmingly against
        const judgeApproves = anyAccepted && (votesAgainst <= votesFor + votesNeutral);
        const cautious = anyAccepted && !judgeApproves;

        return {
            opinions,
            votesFor,
            votesAgainst,
            votesNeutral,
            finalVerdict: judgeApproves ? 'هجوم' : cautious ? 'بحذر' : 'تجاوز',
            finalVerdictClass: judgeApproves ? 'attack' : cautious ? 'caution' : 'skip',
            bestOption,
            bestScore,
            accepted: judgeApproves || cautious
        };
    }

    /**
     * Generate opinion for a specific character
     */
    generateOpinion(character, analysis) {
        const { scores, traps, powerBalance, homeAwayFactor, formAnalysis, h2hAnalysis, motivationAnalysis, oddsAnalysis, decision } = analysis;
        
        const bestOption = decision.bestOption;
        const bestScore = decision.bestScore;

        let opinion = {};

        switch (character.id) {
            case 'skeptic':
                opinion = this.skepticAnalysis(analysis);
                break;
            case 'calculator':
                opinion = this.calculatorAnalysis(analysis);
                break;
            case 'prosecutor':
                opinion = this.prosecutorAnalysis(analysis);
                break;
            case 'expert':
                opinion = this.expertAnalysis(analysis);
                break;
            case 'defense':
                opinion = this.defenseAnalysis(analysis);
                break;
            case 'opponent':
                opinion = this.opponentAnalysis(analysis);
                break;
            case 'intelligence':
                opinion = this.intelligenceAnalysis(analysis);
                break;
            case 'deep':
                opinion = this.deepAnalysis(analysis);
                break;
            case 'detective':
                opinion = this.detectiveAnalysis(analysis);
                break;
            case 'judge':
                opinion = this.judgeAnalysis(analysis);
                break;
        }

        return {
            character,
            ...opinion
        };
    }

    // ─── المتشكك — The Skeptic ───
    skepticAnalysis(analysis) {
        const { scores, traps, formAnalysis, decision } = analysis;
        const bestScore = decision.bestScore;
        const confidence = decision.confidence;
        const points = [];
        let vote = 'against';

        if (confidence < 60) {
            points.push(`الثقة ${confidence.toFixed(1)}% فقط — لا أثق في هذا التوقع`);
            vote = 'against';
        } else if (confidence >= 72) {
            points.push(`الثقة ${confidence.toFixed(1)}% — مقبولة لكن يجب التأكد`);
            vote = 'neutral';
        } else {
            points.push(`الثقة ${confidence.toFixed(1)}% — في المنطقة الرمادية`);
            vote = 'against';
        }

        if (traps.length > 0) {
            points.push(`هناك ${traps.length} فخ إحصائي — لا يمكن تجاهلهم`);
            if (traps.some(t => t.severity === 'high')) vote = 'against';
        }

        if (formAnalysis.homeVolatile || formAnalysis.awayVolatile) {
            points.push('نتائج متذبذبة = خطر حقيقي. لماذا نثق في استمرار النمط؟');
        }

        if (confidence >= 78 && traps.length === 0) {
            points.push('حسناً... البيانات قوية ولا أجد ثغرات — لكن الحذر واجب');
            vote = 'for';
        }

        return {
            analysis: 'أنا أشكك في كل شيء. دعوني أبحث عن الثغرات...',
            points,
            vote,
            voteLabel: vote === 'for' ? 'موافق بحذر' : vote === 'against' ? 'معارض' : 'محايد'
        };
    }

    // ─── الحسابي — The Calculator ───
    calculatorAnalysis(analysis) {
        const { scores, homeAwayFactor, formAnalysis, powerBalance, decision } = analysis;
        const points = [];
        const bestOption = decision.bestOption;
        const bestScore = decision.bestScore;

        // Pure numbers
        points.push(`نسبة ${bestOption}: <span class="highlight-gold">${bestScore.toFixed(1)}%</span>`);
        
        Object.entries(scores).forEach(([opt, data]) => {
            if (opt !== bestOption) {
                points.push(`نسبة ${opt}: ${data.score.toFixed(1)}%`);
            }
        });

        if (homeAwayFactor.homeStrength > 70) {
            points.push(`مؤشر قوة الديار: <span class="highlight-green">${homeAwayFactor.homeStrength.toFixed(1)}%</span> — قوي`);
        }

        if (formAnalysis.homeFormScore > 70) {
            points.push(`فورم المضيف: <span class="highlight-green">${formAnalysis.homeFormScore.toFixed(1)}%</span>`);
        }

        const vote = decision.confidence >= 72 ? 'for' : decision.confidence >= 65 ? 'neutral' : 'against';

        return {
            analysis: 'الأرقام لا تكذب. إليكم الحسابات:',
            points,
            vote,
            voteLabel: vote === 'for' ? 'الأرقام تؤيد' : vote === 'against' ? 'الأرقام ترفض' : 'الأرقام غير حاسمة'
        };
    }

    // ─── وكيل النيابة — The Prosecutor ───
    prosecutorAnalysis(analysis) {
        const { scores, traps, formAnalysis, homeAwayFactor, decision } = analysis;
        const points = [];

        // Always attacks
        if (formAnalysis.awayFormScore > 40) {
            points.push(`الضيف ليس ضعيفاً كفاية — فورمه ${formAnalysis.awayFormScore.toFixed(1)}%`);
        }

        if (homeAwayFactor.homeStrength < 75) {
            points.push(`المضيف ليس "حصناً" في أرضه — ${homeAwayFactor.homeStrength.toFixed(1)}% فقط`);
        }

        traps.forEach(trap => {
            points.push(`🚨 ${trap.type}: ${trap.description}`);
        });

        if (decision.bestScore < 90) {
            points.push(`النسبة ${decision.bestScore.toFixed(1)}% لا تستوفي الحد الأدنى 90%!`);
        }

        const vote = traps.length >= 2 || decision.confidence < 65 ? 'against' : 'neutral';

        return {
            analysis: 'كوكيل نيابة، مهمتي إثبات أن هذا التوقع خطير:',
            points,
            vote,
            voteLabel: vote === 'against' ? 'أعارض بشدة' : 'لا أعترض'
        };
    }

    // ─── المشاهد الخبير — Expert Witness ───
    expertAnalysis(analysis) {
        const { motivationAnalysis, powerBalance, homeAwayFactor, decision } = analysis;
        const points = [];

        motivationAnalysis.details.forEach(d => points.push(d));
        
        if (homeAwayFactor.homeAtHome) {
            const l = parseInt(homeAwayFactor.homeAtHome.l) || 0;
            const mp = parseInt(homeAwayFactor.homeAtHome.mp) || 1;
            if (l <= 2) {
                points.push(`المضيف خسر ${l} مباريات فقط في أرضه من ${mp} — عامل أرض قوي`);
            }
        }

        if (homeAwayFactor.awayAtAway) {
            const l = parseInt(homeAwayFactor.awayAtAway.l) || 0;
            const mp = parseInt(homeAwayFactor.awayAtAway.mp) || 1;
            if (l >= mp * 0.5) {
                points.push(`الضيف يخسر ${l} من ${mp} مباريات في الخارج — ضعف واضح`);
            }
        }

        const vote = decision.confidence >= 72 ? 'for' : 'neutral';

        return {
            analysis: 'بناءً على خبرتي في تحليل المباريات:',
            points,
            vote,
            voteLabel: vote === 'for' ? 'أؤيد التوقع' : 'محايد'
        };
    }

    // ─── محامي الدفاع — Defense Lawyer ───
    defenseAnalysis(analysis) {
        const { powerBalance, homeAwayFactor, formAnalysis, oddsAnalysis, decision } = analysis;
        const points = [];

        // Always defends the prediction
        if (powerBalance.advantage === 'home' && decision.bestOption.includes('1')) {
            points.push(`المضيف أقوى إحصائياً — الأرقام في صالحنا`);
        }

        if (homeAwayFactor.homeStrength > 65) {
            points.push(`قوة الديار <span class="highlight-green">${homeAwayFactor.homeStrength.toFixed(1)}%</span> — ميزة واضحة`);
        }

        if (homeAwayFactor.awayStrength < 40) {
            points.push(`الضيف ضعيف في الخارج (${homeAwayFactor.awayStrength.toFixed(1)}%) — يدعم توقعنا`);
        }

        if (formAnalysis.homeFormScore > 60) {
            points.push(`فورم المضيف ممتاز (${formAnalysis.homeFormScore.toFixed(1)}%) — في زخم إيجابي`);
        }

        if (oddsAnalysis.dc1x && oddsAnalysis.dc1x > 70) {
            points.push(`الأودز الضمنية تؤكد 1X بنسبة ${oddsAnalysis.dc1x.toFixed(1)}%`);
        }

        const vote = decision.confidence >= 65 ? 'for' : 'neutral';

        return {
            analysis: 'سيدي القاضي، الأدلة واضحة لصالح التوقع:',
            points,
            vote,
            voteLabel: 'أؤيد بقوة'
        };
    }

    // ─── محامي الخصم — Opposition Lawyer ───
    opponentAnalysis(analysis) {
        const { traps, formAnalysis, homeAwayFactor, h2hAnalysis, decision } = analysis;
        const points = [];

        // Always opposes
        if (formAnalysis.awayFormScore > 50) {
            points.push(`الضيف ليس ضعيفاً — فورمه ${formAnalysis.awayFormScore.toFixed(1)}%`);
        }

        if (h2hAnalysis.awayWins > 0) {
            points.push(`الضيف سبق وفاز في المواجهات المباشرة (${h2hAnalysis.awayWins} انتصار)`);
        }

        if (homeAwayFactor.homeStrength < 80) {
            points.push(`المضيف ليس مسيطراً بالكامل في أرضه`);
        }

        points.push(`كرة القدم لعبة مفاجآت — لا شيء مضمون 100%`);

        const vote = decision.confidence < 78 ? 'against' : 'neutral';

        return {
            analysis: 'أعترض على هذا التوقع. إليكم الأسباب:',
            points,
            vote,
            voteLabel: vote === 'against' ? 'أعارض' : 'لا أعترض'
        };
    }

    // ─── نبض الذكاء — Intelligence Pulse ───
    intelligenceAnalysis(analysis) {
        const { formAnalysis, powerBalance, homeAwayFactor, decision } = analysis;
        const points = [];

        // Pattern detection
        const homeForm = formAnalysis.homeForm;
        const awayForm = formAnalysis.awayForm;

        if (homeForm.w >= 3 && homeForm.total >= 4) {
            points.push(`🔍 نمط: المضيف في سلسلة قوية (${homeForm.w} انتصارات من ${homeForm.total})`);
        }

        if (awayForm.l >= 3 && awayForm.total >= 4) {
            points.push(`🔍 نمط: الضيف في سلسلة سلبية (${awayForm.l} خسائر من ${awayForm.total})`);
        }

        // Cross-referencing patterns
        if (homeAwayFactor.homeStrength > 70 && homeAwayFactor.awayStrength < 35) {
            points.push(`🔍 نمط مركّب: مضيف قوي + ضيف ضعيف في الخارج = إشارة قوية`);
        }

        if (powerBalance.homeScore > 65 && formAnalysis.homeFormScore > 65) {
            points.push(`🔍 تطابق: القوة العامة + الفورم يتحركان في نفس الاتجاه`);
        } else if (powerBalance.homeScore > 60 && formAnalysis.homeFormScore < 45) {
            points.push(`⚠️ تناقض: القوة العامة جيدة لكن الفورم ضعيف — تحذير!`);
        }

        const vote = decision.confidence >= 72 ? 'for' : decision.confidence >= 65 ? 'neutral' : 'against';

        return {
            analysis: 'أبحث في الأنماط المخفية بين البيانات:',
            points,
            vote,
            voteLabel: vote === 'for' ? 'الأنماط تؤكد' : vote === 'against' ? 'الأنماط تحذر' : 'أنماط مختلطة'
        };
    }

    // ─── التفكير العميق — Deep Thinking ───
    deepAnalysis(analysis) {
        const { powerBalance, homeAwayFactor, formAnalysis, motivationAnalysis, traps, decision } = analysis;
        const points = [];

        // Strategic analysis — connecting all factors
        const factors = {
            power: powerBalance.advantage === 'home' ? 'مضيف' : 'ضيف',
            homeStrong: homeAwayFactor.homeStrength > 65,
            awayWeak: homeAwayFactor.awayStrength < 40,
            homeFormGood: formAnalysis.homeFormScore > 60,
            trapsExist: traps.length > 0,
            motivationHigh: motivationAnalysis.homeMotivation > 65
        };

        let supportingFactors = 0;
        if (factors.homeStrong) supportingFactors++;
        if (factors.awayWeak) supportingFactors++;
        if (factors.homeFormGood) supportingFactors++;
        if (factors.motivationHigh) supportingFactors++;
        if (factors.power === 'مضيف') supportingFactors++;

        points.push(`عدد العوامل المؤيدة: ${supportingFactors} من 5`);
        
        if (supportingFactors >= 4) {
            points.push(`📊 تحليل شامل: ${supportingFactors} محاور تدعم التوقع — إشارة قوية جداً`);
        } else if (supportingFactors >= 3) {
            points.push(`📊 تحليل شامل: ${supportingFactors} محاور تدعم — مقبول لكن ليس ساحق`);
        } else {
            points.push(`📊 تحليل شامل: ${supportingFactors} محاور فقط — غير كافي لثقة عالية`);
        }

        if (factors.trapsExist) {
            points.push(`⚠️ وجود فخاخ يقلل من الموثوقية الاستراتيجية`);
        }

        const vote = supportingFactors >= 4 && !factors.trapsExist ? 'for' :
                     supportingFactors >= 3 ? 'neutral' : 'against';

        return {
            analysis: 'أربط جميع العوامل ببعضها لرؤية الصورة الكاملة:',
            points,
            vote,
            voteLabel: vote === 'for' ? 'الصورة واضحة' : vote === 'against' ? 'الصورة ضبابية' : 'الصورة مختلطة'
        };
    }

    // ─── رئيس المباحث — Chief Detective ───
    detectiveAnalysis(analysis) {
        const { traps, decision } = analysis;
        const points = [];

        if (traps.length === 0) {
            points.push(`✅ مسح شامل: لا توجد فخاخ إحصائية — الطريق آمن`);
        } else {
            points.push(`🚨 اكتشفت ${traps.length} فخ إحصائي:`);
            traps.forEach((trap, i) => {
                const severity = trap.severity === 'high' ? '🔴' : trap.severity === 'medium' ? '🟡' : '🟢';
                points.push(`${severity} فخ #${i+1}: ${trap.type} — ${trap.description} (تأثير: ${trap.impact})`);
            });
        }

        const highTraps = traps.filter(t => t.severity === 'high').length;
        const vote = traps.length === 0 ? 'for' :
                     highTraps > 0 ? 'against' : 'neutral';

        return {
            analysis: 'نتائج التحقيق في الفخاخ الإحصائية:',
            points,
            vote,
            voteLabel: vote === 'for' ? 'لا فخاخ — آمن' : vote === 'against' ? '🚨 فخاخ خطيرة' : 'فخاخ بسيطة'
        };
    }

    // ─── رئيس المحكمة: أمير — The Judge ───
    judgeAnalysis(analysis) {
        const { scores, traps, decision } = analysis;
        const points = [];
        const bestOption = decision.bestOption;
        const confidence = decision.confidence;
        const highTraps = traps.filter(t => t.severity === 'high').length;

        points.push(`التوقع الأعلى: <span class="highlight-gold">${bestOption}</span> بثقة <span class="highlight-gold">${confidence.toFixed(1)}%</span>`);

        if (decision.dcAccepted || decision.goalsAccepted) {
            // Show which recommendations passed
            let accepted = [];
            if (decision.dcAccepted) accepted.push(`${bestOption} (${confidence.toFixed(1)}%)`);
            if (decision.goalsAccepted) accepted.push(`Over 1.5 (${decision.goalsScore?.toFixed(1) || '?'}%)`);
            points.push(`✅ توصيات مقبولة: ${accepted.join(' + ')}`);

            if (traps.length === 0) {
                points.push(`✅ لا توجد فخاخ — أصدر حكمي: <span class="highlight-green">هجوم</span>`);
            } else if (highTraps === 0) {
                points.push(`⚠️ فخاخ بسيطة موجودة — <span class="highlight-green">هجوم بحذر</span>`);
            } else {
                points.push(`🚨 فخاخ خطيرة مكتشفة — <span class="highlight-red">أخفض الثقة</span>`);
            }
        } else {
            points.push(`❌ الثقة ${confidence.toFixed(1)}% غير كافية — <span class="highlight-red">المباراة مرفوضة</span>`);
            points.push(`القرار: <span class="highlight-red">تجاوز المباراة — لا توجد فرصة مؤهلة</span>`);
        }

        const vote = (decision.dcAccepted || decision.goalsAccepted) && highTraps === 0 ? 'for' : 
                     (decision.dcAccepted || decision.goalsAccepted) ? 'neutral' : 'against';

        return {
            analysis: 'بعد سماع جميع الآراء، إليكم حكمي النهائي:',
            points,
            vote,
            voteLabel: vote === 'for' ? '✅ هجوم' : '❌ تجاوز'
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export
window.CourtroomSystem = CourtroomSystem;
