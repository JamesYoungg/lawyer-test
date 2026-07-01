/**
 * Self-test validation script
 * Run: node src/js/validate.js
 *
 * For each persona, picks the option with the highest dot-product match
 * to the persona's vector. Then verifies the persona ranks #1.
 *
 * Validates 11 personas (9 base + 2 easter eggs) with gender independence.
 */

import { questions, TYPE_LIBRARY, dimensionOrder } from './dataset.js';
import { computeResult } from './algorithm.js';

function findOptimalAnswers(personaVec) {
    const answers = {};
    questions.forEach(q => {
        let bestIdx = 0;
        let bestScore = -Infinity;
        q.options.forEach((opt, i) => {
            // dot product between option weights and persona vector
            let score = 0;
            for (let d = 0; d < 7; d++) {
                score += opt.w[d] * personaVec[d];
            }
            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        });
        answers[q.id] = bestIdx;
    });
    return answers;
}

console.log('=== Self-Test Validation (11 personas, WITH safety nets) ===\n');

let allPass = true;
const personas = Object.values(TYPE_LIBRARY);
console.log(`Total personas: ${personas.length}\n`);

personas.forEach(p => {
    const answers = findOptimalAnswers(p.v);
    const result = computeResult(answers, questions);
    const topCode = result.finalType.code;
    const topSim = result.finalType.similarity;
    const secondCode = result.secondType.code;
    const secondDist = result.secondType.distance;
    const pass = topCode === p.code;
    if (!pass) allPass = false;
    const mark = pass ? '✓' : '✗';

    // Determine if easter egg
    const eggMark = p.easterEgg ? ' [🥚 彩蛋]' : '';

    // Show gendered cn for display
    const cnMale = typeof p.cn === 'object' ? p.cn.male : p.cn;
    const cnFemale = typeof p.cn === 'object' ? p.cn.female : p.cn;

    console.log(`${mark} ${p.code}${eggMark} (${cnMale} / ${cnFemale}) → #1: ${topCode} (${topSim}%), #2: ${secondCode} (dist ${secondDist.toFixed(1)})`);
    if (!pass) {
        console.log(`    conflict=${result.normalized.conflict.toFixed(1)} rhythm=${result.normalized.rhythm.toFixed(1)} drive=${result.normalized.drive.toFixed(1)} ability=${result.normalized.ability.toFixed(1)}`);
    }
});

console.log(`\n${allPass ? '✓ ALL PASS' : '✗ SOME FAILED'}`);

// ─── Gender Independence Test ───────────────────────────────
console.log('\n=== Gender Independence Test ===');
let genderPass = true;
personas.forEach(p => {
    const answers = findOptimalAnswers(p.v);
    const resultMale = computeResult(answers, questions, 'male');
    const resultFemale = computeResult(answers, questions, 'female');

    // Gender should NOT affect ranking (only display texts)
    const sameRank = resultMale.finalType.code === resultFemale.finalType.code;
    // Gender should affect display texts
    const maleCn = resultMale.displayTexts.finalType.cn;
    const femaleCn = resultFemale.displayTexts.finalType.cn;
    const textsDiffer = maleCn !== femaleCn || resultMale.displayTexts.finalType.desc !== resultFemale.displayTexts.finalType.desc;

    if (!sameRank) {
        console.log(`✗ ${p.code}: different ranking for male/female (${resultMale.finalType.code} vs ${resultFemale.finalType.code})`);
        genderPass = false;
    } else if (textsDiffer) {
        console.log(`✓ ${p.code}: same ranking, different gendered texts (${maleCn} / ${femaleCn})`);
    } else {
        // For easter eggs with identical cn, that's fine
        if (p.easterEgg) {
            console.log(`✓ ${p.code} [🥚 彩蛋]: same ranking, gender-neutral texts (expected)`);
        } else {
            console.log(`⚠ ${p.code}: same ranking but texts not different (check if gender fields exist)`);
        }
    }
});
console.log(`\n${genderPass ? '✓ GENDER TEST PASS' : '✗ GENDER TEST FAILED'}`);

// ─── Easter Egg Accessibility Test ──────────────────────────
console.log('\n=== Easter Egg Ranking Test ===');
const eggCodes = personas.filter(p => p.easterEgg).map(p => p.code);
const nonEggCodes = personas.filter(p => !p.easterEgg).map(p => p.code);

console.log(`Easter eggs: ${eggCodes.join(', ')}`);
console.log(`Base personas: ${nonEggCodes.join(', ')}`);

// Test: for each easter egg, its optimal answers should rank it #1
let eggPass = true;
eggCodes.forEach(code => {
    const p = TYPE_LIBRARY[code];
    const answers = findOptimalAnswers(p.v);
    const result = computeResult(answers, questions);
    if (result.finalType.code === code) {
        console.log(`✓ ${code}: ranks #1 with optimal answers (similarity ${result.finalType.similarity}%)`);
    } else {
        console.log(`✗ ${code}: optimal answers gave #1 ${result.finalType.code} (${result.finalType.similarity}%)`);
        eggPass = false;
    }
});
console.log(`\n${eggPass ? '✓ EASTER EGG TEST PASS' : '✗ EASTER EGG TEST FAILED'}`);

// ─── Inter-Persona Distances ───────────────────────────────
console.log('\n=== Inter-Persona Distances ===');
let minDist = Infinity;
let minPair = '';
for (let i = 0; i < personas.length; i++) {
    for (let j = i + 1; j < personas.length; j++) {
        let dist = 0;
        for (let d = 0; d < 7; d++) {
            const diff = personas[i].v[d] - personas[j].v[d];
            dist += diff * diff;
        }
        dist = Math.sqrt(dist);
        if (dist < minDist) {
            minDist = dist;
            minPair = `${personas[i].code}/${personas[j].code}`;
        }
    }
}
console.log(`Min distance: ${minDist.toFixed(1)} (${minPair}) — ${minDist >= 12 ? '✓ >= 12' : '✗ < 12'}`);

// ─── Zero-Weight Density ───────────────────────────────────
console.log('\n=== Zero-Weight Density ===');
let total = 0;
let zeros = 0;
const dimZeros = {};
const dimTotal = {};
dimensionOrder.forEach(d => { dimZeros[d] = 0; dimTotal[d] = 0; });
questions.forEach(q => {
    q.options.forEach(opt => {
        dimensionOrder.forEach((d, i) => {
            total++;
            dimTotal[d]++;
            if (opt.w[i] === 0) {
                zeros++;
                dimZeros[d]++;
            }
        });
    });
});
console.log(`Overall zero rate: ${(zeros / total * 100).toFixed(1)}% (${zeros}/${total})`);
dimensionOrder.forEach(d => {
    console.log(`  ${d}: ${((dimZeros[d] / dimTotal[d]) * 100).toFixed(1)}% (${dimZeros[d]}/${dimTotal[d]})`);
});

// ─── Safety Net Tests ──────────────────────────────────────
// Low-rhythm safety net
console.log('\n=== Low-Rhythm Safety Net Scenario ===');
const lazyAnswers = {};
questions.forEach(q => {
    let bestIdx = 0;
    let minRhythm = Infinity;
    q.options.forEach((opt, i) => {
        if (opt.w[1] < minRhythm) {
            minRhythm = opt.w[1];
            bestIdx = i;
        }
    });
    lazyAnswers[q.id] = bestIdx;
});
const lazyResult = computeResult(lazyAnswers, questions);
console.log(`Lazy slacker result: #1 ${lazyResult.finalType.code} (${lazyResult.finalType.cn.male || lazyResult.finalType.cn})`);
console.log(`  rhythm=${lazyResult.normalized.rhythm.toFixed(1)}, boundary=${lazyResult.normalized.boundary.toFixed(1)}`);
const isHighRhythm = lazyResult.finalType.v[1] >= 5;
console.log(`  High-rhythm match: ${isHighRhythm ? '✗ BAD (user chose slacker answers!)' : '✓ Good (low-rhythm persona matched)'}`);

// HFIP dark wolf safety net
console.log('\n=== HFIP Dark Wolf Safety Net Scenario ===');
const hfipAnswers = {};
questions.forEach(q => {
    // Pick options that maximize conflict, boundary, ability, minimize expansion, low rhythm
    let bestIdx = 0;
    let bestScore = -Infinity;
    q.options.forEach((opt, i) => {
        const score = opt.w[0] + opt.w[2] + opt.w[6] - opt.w[3] - opt.w[1]; // +conflict +boundary +ability -expansion -rhythm
        if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
        }
    });
    hfipAnswers[q.id] = bestIdx;
});
const hfipResult = computeResult(hfipAnswers, questions);
console.log(`HFIP-scenario: #1 ${hfipResult.finalType.code} (${hfipResult.finalType.cn.male || hfipResult.finalType.cn})`);
console.log(`  conflict=${hfipResult.normalized.conflict.toFixed(1)} boundary=${hfipResult.normalized.boundary.toFixed(1)} rhythm=${hfipResult.normalized.rhythm.toFixed(1)} expansion=${hfipResult.normalized.expansion.toFixed(1)} ability=${hfipResult.normalized.ability.toFixed(1)}`);

// SFIP hermit safety net
console.log('\n=== SFIP Hermit Safety Net Scenario ===');
const sfipAnswers = {};
questions.forEach(q => {
    let bestIdx = 0;
    let minConflictRhythm = Infinity;
    q.options.forEach((opt, i) => {
        const score = opt.w[0] + opt.w[1]; // conflict + rhythm (choose minimum)
        if (score < minConflictRhythm) {
            minConflictRhythm = score;
            bestIdx = i;
        }
    });
    sfipAnswers[q.id] = bestIdx;
});
const sfipResult = computeResult(sfipAnswers, questions);
console.log(`SFIP-scenario: #1 ${sfipResult.finalType.code} (${sfipResult.finalType.cn.male || sfipResult.finalType.cn})`);
console.log(`  conflict=${sfipResult.normalized.conflict.toFixed(1)} rhythm=${sfipResult.normalized.rhythm.toFixed(1)}`);