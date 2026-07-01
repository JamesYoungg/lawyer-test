/**
 * Debug: show full result vectors for HFIP and SFIP
 */
import { questions, TYPE_LIBRARY, dimensionOrder } from './dataset.js';
import { computeResult } from './algorithm.js';

function findOptimalAnswers(personaVec) {
    const answers = {};
    questions.forEach(q => {
        let bestIdx = 0;
        let bestScore = -Infinity;
        q.options.forEach((opt, i) => {
            let score = 0;
            for (let d = 0; d < 7; d++) score += opt.w[d] * personaVec[d];
            if (score > bestScore) { bestScore = score; bestIdx = i; }
        });
        answers[q.id] = bestIdx;
    });
    return answers;
}

function debugPersona(code) {
    const p = TYPE_LIBRARY[code];
    const answers = findOptimalAnswers(p.v);
    const r = computeResult(answers, questions);
    console.log(`\n=== ${code} (${p.cn}) ===`);
    console.log(`Target vector: [${p.v}]`);
    console.log(`Normalized:    [${dimensionOrder.map(d => r.normalized[d].toFixed(1)).join(', ')}]`);
    console.log(`#1: ${r.finalType.code} (dist ${r.finalType.distance.toFixed(2)}, sim ${r.finalType.similarity}%)`);
    console.log(`#2: ${r.secondType.code} (dist ${r.secondType.distance.toFixed(2)})`);
    for (const q of questions) {
        const optIdx = answers[q.id];
        const opt = q.options[optIdx];
        console.log(`  Q${q.id.slice(1)}: w=[${opt.w}]`);
    }
    // Show all ranked
    console.log(`\nFull ranking:`);
    r.ranked.slice(0, 5).forEach((x, i) => {
        console.log(`  ${i+1}. ${x.code} dist=${x.distance.toFixed(2)} sim=${x.similarity}%`);
    });
}

debugPersona('HFIP');
debugPersona('SFIP');
