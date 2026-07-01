/**
 * algorithm.js — 纯算法层
 * 7 维向量模型：把用户的答题权重累加 → 归一化到 [-10, 10] → 与 11 种人格做欧氏距离匹配
 * 支持性别差异化文案选择
 */

import { TYPE_LIBRARY, dimensionMeta, dimensionOrder } from './dataset.js';

// 人格向量库（从 TYPE_LIBRARY 提取，避免数据冗余）
const PERSONA_ENTRIES = Object.values(TYPE_LIBRARY);

/**
 * 计算每题每个维度的理论最大/最小累加分（用于归一化）
 */
function computeTheoreticalBounds(questions) {
    const maxPerDim = {};
    const minPerDim = {};
    dimensionOrder.forEach(dim => {
        maxPerDim[dim] = 0;
        minPerDim[dim] = 0;
    });
    questions.forEach(q => {
        q.options.forEach(opt => {
            dimensionOrder.forEach((dim, i) => {
                const w = opt.w[i];
                if (w > 0) maxPerDim[dim] += w;
                else if (w < 0) minPerDim[dim] += w;
            });
        });
    });
    return { maxPerDim, minPerDim };
}

/**
 * 把原始累加分对称归一化到 [-10, 10]
 * 分母取正负边界中绝对值较大的那个，保证 +10 和 -10 对称
 */
function normalizeScores(rawScores, bounds) {
    const normalized = {};
    dimensionOrder.forEach(dim => {
        const raw = rawScores[dim];
        const pos = bounds.maxPerDim[dim];
        const neg = Math.abs(bounds.minPerDim[dim]);
        const denom = Math.max(pos, neg);
        if (denom === 0) {
            normalized[dim] = 0;
        } else {
            normalized[dim] = Math.max(-10, Math.min(10, (raw / denom) * 10));
        }
    });
    return normalized;
}

/**
 * 欧氏距离
 */
function euclideanDistance(vecA, vecB) {
    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
        const diff = vecA[i] - vecB[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

/**
 * 匹配强度：在 7 个维度中有几个维度与目标向量相差 <= 2
 * 用于欧氏距离相同时的破平
 */
function matchStrength(userVec, personaVec) {
    let count = 0;
    for (let i = 0; i < userVec.length; i++) {
        if (Math.abs(userVec[i] - personaVec[i]) <= 2) count++;
    }
    return count;
}

/**
 * 将归一化后的用户向量转换为 L/M/H 级别（仅用于维度解读展示）
 */
function scoreToLevel(score) {
    if (score <= -3) return 'L';
    if (score < 3) return 'M';
    return 'H';
}

/**
 * 根据性别选取对应的显示文本
 * @param {Object} persona - TYPE_LIBRARY 中的单个人格条目
 * @param {string} gender - 'male' 或 'female'
 * @returns {{ cn: string, intro: string, desc: string }}
 */
function selectGenderedTexts(persona, gender) {
    const g = gender === 'female' ? 'female' : 'male';
    return {
        cn: typeof persona.cn === 'object' ? persona.cn[g] : persona.cn,
        intro: typeof persona.intro === 'object' ? persona.intro[g] : persona.intro,
        desc: typeof persona.desc === 'object' ? persona.desc[g] : persona.desc
    };
}

/**
 * 核心算法
 * @param {Object} answers  - { [questionId]: optionIndex }
 * @param {Array}  questions
 * @param {string} gender   - 'male' | 'female'
 * @returns {Object}
 */
export function computeResult(answers, questions, gender = 'male') {
    // 1. 累加每个维度的原始分
    const rawScores = {};
    dimensionOrder.forEach(dim => { rawScores[dim] = 0; });

    questions.forEach(q => {
        const optIdx = Number(answers[q.id]);
        if (Number.isNaN(optIdx)) return;
        const opt = q.options[optIdx];
        if (!opt) return;
        dimensionOrder.forEach((dim, i) => {
            rawScores[dim] += opt.w[i];
        });
    });

    // 2. 归一化到 [-10, 10]
    const bounds = computeTheoreticalBounds(questions);
    const normalized = normalizeScores(rawScores, bounds);

    const userVector = dimensionOrder.map(dim => normalized[dim]);

    // 3. 计算与每种人格的距离，排名
    const ranked = PERSONA_ENTRIES.map(persona => {
        const dist = euclideanDistance(userVector, persona.v);
        const strength = matchStrength(userVector, persona.v);
        const maxPossible = Math.sqrt(7 * 400); // 7 维 × (20)^2 最大跨度
        const similarity = Math.max(0, Math.round((1 - dist / maxPossible) * 100));
        return { ...persona, distance: dist, matchStrength: strength, similarity };
    }).sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        if (a.matchStrength !== b.matchStrength) return b.matchStrength - a.matchStrength;
        return b.similarity - a.similarity;
    });

    // 低节奏感安全网：如果用户节奏 <= -5 且边界 <= 0，
    // 但第一名却是高节奏人格，则把最佳低节奏人格提到第一
    if (normalized.rhythm <= -5 && normalized.boundary <= 0) {
        const bestLowRhythm = ranked.find(p => p.v[1] <= -2);
        if (bestLowRhythm && ranked[0].v[1] > -2) {
            const idx = ranked.indexOf(bestLowRhythm);
            if (idx > 0) {
                const [item] = ranked.splice(idx, 1);
                ranked.unshift(item);
            }
        }
    }

    // 暗夜孤狼安全网：高冲突(>=3) + 高边界(>=3) + 高能力(>=3) + 低扩张(<=-2) + 低节奏(< 0)
    if (normalized.conflict >= 3 && normalized.boundary >= 3 && normalized.ability >= 3 && normalized.expansion <= -2 && normalized.rhythm < 0) {
        const hfipIdx = ranked.findIndex(p => p.code === 'HFIP');
        if (hfipIdx > 0) {
            const [item] = ranked.splice(hfipIdx, 1);
            ranked.unshift(item);
        }
    }

    // 修行隐士安全网：冲突 <= -5、节奏 <= -4
    if (normalized.conflict <= -5 && normalized.rhythm <= -4) {
        const sfip = PERSONA_ENTRIES.find(p => p.code === 'SFIP');
        if (sfip && ranked[0].code !== 'SFIP') {
            const idx = ranked.indexOf(sfip);
            if (idx > 0) {
                const [item] = ranked.splice(idx, 1);
                ranked.unshift(item);
            }
        }
    }

    const best = ranked[0];
    const second = ranked[1];
    const worst = ranked[ranked.length - 1];

    // 4. 维度级别（用于解读文案）
    const levels = {};
    dimensionOrder.forEach(dim => {
        levels[dim] = scoreToLevel(normalized[dim]);
    });

    // 5. 匹配度等级文案
    let modeKicker = `你的律师人格`;
    let badge = `匹配度 ${best.similarity}%`;
    let sub = `七维向量已锁定，欢迎对号入座。`;

    if (best.similarity >= 85) {
        modeKicker = `精准命中`;
        sub = `这人格就是你，跑不掉了。建议直接打印贴墙上。`;
    } else if (best.similarity >= 70) {
        modeKicker = `高度匹配`;
        sub = `基本就是你，可能有少量偏移但大方向稳了。`;
    } else if (best.similarity < 55) {
        modeKicker = `系统勉强判定`;
        sub = `你的画像比较特殊，介于多个人格之间。`;
    }

    // 6. 根据性别选取显示文本
    const displayTexts = {
        finalType: selectGenderedTexts(best, gender),
        secondType: selectGenderedTexts(second, gender),
        worstType: selectGenderedTexts(worst, gender)
    };

    return {
        rawScores,
        normalized,
        levels,
        ranked,
        finalType: best,
        secondType: second,
        worstType: worst,
        displayTexts,
        gender,
        modeKicker,
        badge,
        sub,
        special: false
    };
}