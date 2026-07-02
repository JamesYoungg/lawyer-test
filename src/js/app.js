/**
 * app.js — 应用层
 * 负责 DOM 渲染、交互与事件绑定，无 AI、无后端依赖
 */

import { questions, dimensionMeta, dimensionOrder, DIM_EXPLANATIONS, TYPE_LIBRARY } from './dataset.js';
import { computeResult } from './algorithm.js';

// ─── Chart.js 实例管理 ─────────────────────────────────────
const chartInstances = {
    personaModal: null,
    resultPage: null,
    posterCard: null
};

function destroyChart(key) {
    if (chartInstances[key]) {
        chartInstances[key].destroy();
        chartInstances[key] = null;
    }
}

function renderRadarChart(canvasId, labels, data, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const isDark = opts.isDark !== false;
    const gridColor = isDark ? 'rgba(0, 255, 136, 0.15)' : 'rgba(0, 255, 136, 0.2)';
    const labelColor = isDark ? '#7a9a82' : '#7a9a82';

    const chart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: opts.label || '七维向量',
                data: data,
                backgroundColor: 'rgba(0, 255, 136, 0.1)',
                borderColor: '#00ff88',
                borderWidth: 2,
                pointBackgroundColor: '#00ff88',
                pointBorderColor: '#0a0e0a',
                pointBorderWidth: 1,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                r: {
                    min: -10,
                    max: 10,
                    ticks: {
                        stepSize: 5,
                        color: '#7a9a82',
                        backdropColor: 'transparent',
                        font: { size: 9, family: 'Courier New' }
                    },
                    grid: { color: gridColor },
                    angleLines: { color: gridColor },
                    pointLabels: {
                        color: labelColor,
                        font: { size: 11, family: 'Inter, sans-serif' }
                    }
                }
            }
        }
    });

    return chart;
}

// ─── 性别选择 ─────────────────────────────────────────────
let selectedGender = null; // 'male' | 'female' | null

function applyGenderTheme(gender) {
    const body = document.body;
    body.classList.remove('theme-male', 'theme-female');
    if (gender === 'male') {
        body.classList.add('theme-male');
    } else if (gender === 'female') {
        body.classList.add('theme-female');
    }
}

function updateGenderButtonsUI() {
    document.querySelectorAll('.gender-btn').forEach(btn => {
        const val = btn.dataset.gender;
        btn.classList.toggle('active', val === selectedGender);
    });
}

function selectGender(gender) {
    selectedGender = gender;
    applyGenderTheme(gender);
    updateGenderButtonsUI();
    renderPersonaPreview();
}

// ─── 根据性别选取文案 ─────────────────────────────────────
function getGenderedText(persona, field) {
    if (!persona) return '';
    const val = persona[field];
    if (typeof val === 'object' && val !== null) {
        const g = selectedGender === 'female' ? 'female' : 'male';
        return val[g] || val.male || '';
    }
    return val || '';
}

function getGenderedCn(persona) {
    return getGenderedText(persona, 'cn');
}

function getGenderedIntro(persona) {
    return getGenderedText(persona, 'intro');
}

function getGenderedDesc(persona) {
    return getGenderedText(persona, 'desc');
}

// ─── 渲染首屏 11 种人格预览 ───────────────────────────────
function renderPersonaPreview() {
    const grid = document.getElementById('personaPreviewGrid');
    if (!grid) return;

    // 彩色循环
    const colors = ['#00ff88', '#00ccff', '#ff2d95'];
    const animVariants = ['persona-float', 'persona-float-alt', 'persona-float-reverse'];
    const pwVariants = ['persona-glow-pulse', 'persona-glow-pulse-alt', 'persona-glow-pulse-slow'];

    const items = Object.values(TYPE_LIBRARY).map((p, idx) => {
        const colorIdx = idx % colors.length;
        const variantIdx = idx % animVariants.length;
        const floatAnim = animVariants[variantIdx];
        const glowAnim = pwVariants[idx % pwVariants.length];
        const floatDuration = (3 + (idx % 5) * 0.5).toFixed(1);
        const glowDuration = (3 + (idx % 4) * 0.4).toFixed(1);
        const floatDistance = (4 + (idx % 3) * 2);
        const translateY = (idx % 5) * 6;
        const rotate = ((idx % 7) - 3) * 0.5;
        const cardColor = colors[colorIdx];

        const isEgg = p.easterEgg === true;
        const eggClass = isEgg ? 'persona-card--egg' : '';

        const displayCn = isEgg ? '❓ 神秘人格' : getGenderedCn(p);
        const displayIntro = isEgg ? '' : `"${getGenderedIntro(p)}"`;
        const displayTag = isEgg ? '' : `🎯 天选业务: ${p.tag}`;
        const avatarPlaceholder = isEgg
            ? `<div class="preview-avatar egg-avatar"><span>❓</span></div>`
            : (() => {
                const g = selectedGender === 'female' ? 'female' : 'male';
                return `<div class="preview-avatar"><picture>
                    <source srcset="/avatars_webp/${p.code}_${g}.webp" type="image/webp">
                    <img src="/avatars/${p.code}_${g}.png" alt="${displayCn}" class="preview-avatar-img" loading="lazy" onerror="this.style.display='none'">
                </picture></div>`;
              })();

        return `
        <div class="persona-preview-card ${eggClass}"
             data-code="${p.code}"
             data-easter-egg="${isEgg}"
             style="--card-color: ${cardColor}; --float-duration: ${floatDuration}s; --glow-duration: ${glowDuration}s; --float-distance: ${floatDistance}px; --float-anim: ${floatAnim}; --glow-anim: ${glowAnim}; --card-translate-y: ${translateY}px; --card-rotate: ${rotate}deg;">
            ${avatarPlaceholder}
            <div class="persona-code">${p.code}</div>
            <div class="persona-cn">${displayCn}</div>
            ${displayIntro ? `<div class="persona-intro">${displayIntro}</div>` : ''}
            ${displayTag ? `<div class="persona-tag">${displayTag}</div>` : ''}
            ${isEgg ? `<div class="persona-egg-hint">✦ 神秘人格 · 完成测试解锁</div>` : ''}
        </div>
        `;
    }).join('');
    grid.innerHTML = items;

    // 事件绑定：可点击 = 非彩蛋
    grid.querySelectorAll('.persona-preview-card:not(.persona-card--egg)').forEach(card => {
        card.addEventListener('click', () => {
            const code = card.dataset.code;
            const persona = TYPE_LIBRARY[code];
            if (persona) openPersonaModal(persona);
        });
    });
}

// ─── 人格详情弹窗 ─────────────────────────────────────────
function openPersonaModal(persona) {
    // 保存当前滚动位置
    const scrollY = window.scrollY;
    document.documentElement.style.setProperty('--scroll-y', `${scrollY}px`);

    document.getElementById('personaModalCode').textContent = persona.code;
    document.getElementById('personaModalCn').textContent = getGenderedCn(persona);
    document.getElementById('personaModalTag').textContent = persona.tag;
    document.getElementById('personaModalIntro').textContent = `"${getGenderedIntro(persona)}"`;
    document.getElementById('personaModalDesc').textContent = getGenderedDesc(persona);

    document.getElementById('personaModal').classList.add('active');
    document.body.classList.add('modal-open');

    const labels = dimensionOrder.map(dim => dimensionMeta[dim].name);
    destroyChart('personaModal');
    requestAnimationFrame(() => {
        chartInstances.personaModal = renderRadarChart('personaRadarChart', labels, persona.v, {
            label: persona.code,
            isDark: true
        });
    });
}

function closePersonaModal() {
    destroyChart('personaModal');
    document.getElementById('personaModal').classList.remove('active');
    document.body.classList.remove('modal-open');
    requestAnimationFrame(() => {
        const scrollY = parseInt(document.documentElement.style.getPropertyValue('--scroll-y') || '0', 10);
        window.scrollTo(0, scrollY);
    });
}

const LS_ANSWERS_KEY = 'lawyer_answers';
const LS_QUESTIONS_KEY = 'lawyer_questions';
const LS_GENDER_KEY = 'lawyer_gender';

const app = {
    shuffledQuestions: [],
    answers: {}
};

// ─── 进度持久化 ─────────────────────────────────────────
function saveState() {
    localStorage.setItem(LS_ANSWERS_KEY, JSON.stringify(app.answers));
    localStorage.setItem(LS_QUESTIONS_KEY, JSON.stringify(app.shuffledQuestions));
    checkSavedState();
}

function loadState() {
    try {
        const a = localStorage.getItem(LS_ANSWERS_KEY);
        const q = localStorage.getItem(LS_QUESTIONS_KEY);
        if (a && q) {
            app.answers = JSON.parse(a);
            app.shuffledQuestions = JSON.parse(q);
            return true;
        }
    } catch (e) { }
    return false;
}

function clearState() {
    localStorage.removeItem(LS_ANSWERS_KEY);
    localStorage.removeItem(LS_QUESTIONS_KEY);
    checkSavedState();
}

function checkSavedState() {
    const hasState = !!localStorage.getItem(LS_ANSWERS_KEY);
    const startBtn = document.getElementById('startBtn');
    const freshBtn = document.getElementById('freshStartBtn');
    if (startBtn && freshBtn) {
        if (hasState) {
            startBtn.innerHTML = '⚡ 继续上次未完成的测试';
            freshBtn.style.display = 'inline-block';
        } else {
            startBtn.innerHTML = '⚡ 立即开始测试 <span>(约 3 分钟)</span>';
            freshBtn.style.display = 'none';
        }
    }
}

// ─── DOM 节点 ───────────────────────────────────────────
let screens = {};
let questionList, progressBar, progressText, submitBtn, testHint;

// ─── 屏幕切换 ───────────────────────────────────────────
function showScreen(name, pushState = true) {
    const currentActive = Object.keys(screens).find(k => screens[k] && screens[k].classList.contains('active'));
    if (currentActive !== name) {
        const modal = document.getElementById('posterModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
        const personaModal = document.getElementById('personaModal');
        if (personaModal) {
            personaModal.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    }
    Object.entries(screens).forEach(([key, el]) => {
        el.classList.toggle('active', key === name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (pushState) {
        history.pushState({ screen: name }, '', `#${name}`);
    }
}

// ─── 工具函数 ───────────────────────────────────────────
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ─── 渲染题目 ───────────────────────────────────────────
function renderQuestions() {
    questionList.innerHTML = '';
    app.shuffledQuestions.forEach((q, idx) => {
        const card = document.createElement('article');
        card.className = 'question';
        card.id = 'dom_' + q.id;
        card.innerHTML = `
          <div class="question-meta">
            <div class="badge">第 <span class="num">${idx + 1}</span> 题</div>
            <div class="dim-label">维度已隐藏</div>
          </div>
          <fieldset class="question-fieldset">
            <legend class="question-title">${q.text}</legend>
            <div class="options">
              ${q.options.map((opt, i) => {
            const code = ['A', 'B', 'C', 'D'][i] || String(i + 1);
            const checked = app.answers[q.id] === i ? 'checked' : '';
            return `
                  <label class="option-card">
                    <input type="radio" name="${q.id}" value="${i}" ${checked} class="sr-only"/>
                    <div class="option-code">${code}</div>
                    <div class="option-text">${opt.label}</div>
                    <div class="radio-indicator"></div>
                  </label>
                `;
        }).join('')}
            </div>
          </fieldset>
        `;
        card.style.opacity = '1';
        questionList.appendChild(card);
    });

    questionList.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const { name, value } = e.target;
            app.answers[name] = Number(value);
            saveState();
            updateProgress();
        });
    });

    updateProgress();
}

function updateProgress() {
    const total = app.shuffledQuestions.length;
    const done = app.shuffledQuestions.filter(q => app.answers[q.id] !== undefined).length;
    const percent = total ? (done / total) * 100 : 0;
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${done} / ${total}`;

    const complete = done === total && total > 0;
    submitBtn.disabled = false;

    testHint.textContent = complete
        ? '都做完了，现在可以把你的电子魂魄交给结果页审判。'
        : '系统会在提交时帮你检查遗漏选项';
    testHint.style.color = '';
}

function handleSubmit() {
    // 检查性别是否已选
    if (!selectedGender) {
        testHint.textContent = '❌ 请先在首页选择性别后再提交！';
        testHint.style.color = '#ff4d4f';
        showScreen('intro');
        return;
    }

    const missingQ = app.shuffledQuestions.find(q => app.answers[q.id] === undefined);
    if (missingQ) {
        const targetCard = document.getElementById('dom_' + missingQ.id);
        if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            questionList.querySelectorAll('.missing-alert').forEach(alert => alert.remove());
            const alertMsg = document.createElement('div');
            alertMsg.className = 'missing-alert';
            alertMsg.style.color = '#ff4d4f';
            alertMsg.style.marginTop = '12px';
            alertMsg.style.fontWeight = 'bold';
            alertMsg.textContent = '👆 这道题还没选呢！请补充';
            targetCard.appendChild(alertMsg);
        }
        testHint.textContent = '❌ 有题目未完成，已为您滚动到该题上方';
        testHint.style.color = '#ff4d4f';
        setTimeout(updateProgress, 3000);
        return;
    }

    // 提交成功：清空状态，确保返回首页不再显示"继续上次"
    clearState();
    renderResult();
}

// ─── 渲染结果页 ─────────────────────────────────────────
function renderDimList(result) {
    const dimList = document.getElementById('dimList');
    dimList.innerHTML = dimensionOrder.map(dim => {
        const level = result.levels[dim];
        const explanation = DIM_EXPLANATIONS[dim][level];
        const score = result.normalized[dim];
        const sign = score >= 0 ? '+' : '';
        return `
          <div class="dim-item">
            <div class="dim-item-top">
              <div class="dim-item-name">${dimensionMeta[dim].name}</div>
              <div class="dim-item-score">${sign}${score.toFixed(1)}</div>
            </div>
            <p>${explanation}</p>
          </div>
        `;
    }).join('');
}

function renderResultRadar(result) {
    destroyChart('resultPage');
    const labels = dimensionOrder.map(dim => dimensionMeta[dim].name);
    const data = dimensionOrder.map(dim => result.normalized[dim]);
    chartInstances.resultPage = renderRadarChart('resultRadarChart', labels, data, {
        label: '你的向量',
        isDark: true
    });
}

function renderResult() {
    const result = computeResult(app.answers, questions, selectedGender || 'male');
    const type = result.finalType;
    const texts = result.displayTexts;
    const secondTexts = result.displayTexts.secondType;
    const worstTexts = result.displayTexts.worstType;
    const isEgg = type.easterEgg === true;

    document.getElementById('resultModeKicker').textContent = result.modeKicker;

    // 彩蛋人格 #1 特殊展示
    const typeNameEl = document.getElementById('resultTypeName');
    if (isEgg) {
        typeNameEl.innerHTML = `🥚 ${type.code}（${texts.finalType.cn}）<span class="egg-badge">✨ 隐藏人格解锁</span>`;
    } else {
        typeNameEl.textContent = `${type.code}（${texts.finalType.cn}）`;
    }

    document.getElementById('matchBadge').textContent = result.badge;
    document.getElementById('resultTypeSub').textContent = result.sub;
    document.getElementById('resultDesc').textContent = texts.finalType.desc;
    document.getElementById('secondTypeName').textContent = `${result.secondType.code}（${secondTexts.cn}）`;
    document.getElementById('worstTypeName').textContent = `${result.worstType.code}（${worstTexts.cn}）`;

    // 天选业务 tag
    const resultTag = document.getElementById('resultTag');
    if (resultTag) {
        resultTag.textContent = `🎯 天选业务: ${type.tag}`;
    }

    // 头像
    const resultAvatar = document.getElementById('resultAvatar');
    if (resultAvatar) {
        const g = selectedGender === 'female' ? 'female' : 'male';
        const avatarPath = `/avatars/${type.code}_${g}.png`;
        resultAvatar.innerHTML = `
            <div class="avatar-frame avatar-${g}${isEgg ? ' avatar-egg' : ''}">
                <picture>
                    <source srcset="/avatars_webp/${type.code}_${g}.webp" type="image/webp">
                    <img src="${avatarPath}" alt="${texts.finalType.cn}" class="avatar-img"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                </picture>
                <div class="avatar-placeholder" style="display:none">
                    <span class="avatar-gender-icon">${g === 'female' ? '♀' : '♂'}</span>
                </div>
            </div>
            ${isEgg ? '<div class="egg-unlock-flash">✦ 神秘人格已解锁 ✦</div>' : ''}
        `;
    }

    showScreen('result');

    renderDimList(result);
    requestAnimationFrame(() => {
        renderResultRadar(result);
    });

    app.lastResult = result;
}

// ─── 启动测试 ───────────────────────────────────────────
function startTest() {
    if (!selectedGender) {
        const hint = document.getElementById('testHint');
        if (hint) {
            hint.textContent = '❌ 请先在首页选择性别！';
            hint.style.color = '#ff4d4f';
        }
        showScreen('intro');
        return;
    }

    clearState();
    app.answers = {};
    app.shuffledQuestions = shuffle(questions);
    saveState();
    renderQuestions();
    showScreen('test');
}

function resumeOrStartTest() {
    if (!selectedGender) {
        const hint = document.querySelector('.hero-eyebrow');
        if (hint) {
            hint.style.borderColor = '#ff4d4f';
            hint.style.color = '#ff4d4f';
            setTimeout(() => {
                hint.style.borderColor = '';
                hint.style.color = '';
            }, 2000);
        }
        return;
    }
    if (loadState()) {
        renderQuestions();
        showScreen('test');
    } else {
        startTest();
    }
}

// ─── 分享海报 ───────────────────────────────────────────
function executeResultShare() {
    if (app.lastResult) {
        openShareModal(app.lastResult);
    } else {
        alert('⚠️ 请先完成测试以生成分享海报！');
    }
}

function closeShareModal() {
    destroyChart('posterCard');
    const modal = document.getElementById('posterModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    requestAnimationFrame(() => {
        const scrollY = parseInt(document.documentElement.style.getPropertyValue('--scroll-y') || '0', 10);
        window.scrollTo(0, scrollY);
    });
}

function renderPosterRadar(result) {
    destroyChart('posterCard');
    const labels = dimensionOrder.map(dim => dimensionMeta[dim].name);
    const data = dimensionOrder.map(dim => result.normalized[dim]);
    chartInstances.posterCard = renderRadarChart('posterRadarChart', labels, data, {
        label: '七维向量',
        isDark: true
    });
}

function openShareModal(result) {
    const modal = document.getElementById('posterModal');
    if (!modal) return;
    const type = result.finalType;
    const texts = result.displayTexts.finalType;
    const isEgg = type.easterEgg === true;

    document.getElementById('posterDescText').textContent = texts.intro;
    if (isEgg) {
        document.getElementById('posterCharTitle').innerHTML = `🥚 ${type.code} · ${texts.cn} <span class="egg-badge" style="font-size:12px">✨ 隐藏人格</span>`;
    } else {
        document.getElementById('posterCharTitle').textContent = `${type.code} · ${texts.cn}`;
    }
    document.getElementById('posterCharDesc').textContent = texts.desc;
    document.getElementById('posterDate').textContent = new Date().toLocaleDateString('zh-CN').replace(/\//g, '.');

    // 天选业务 tag
    const posterTag = document.getElementById('posterTag');
    if (posterTag) {
        posterTag.textContent = `🎯 天选业务: ${type.tag}`;
    }

    // 头像
    const posterAvatar = document.getElementById('posterAvatar');
    if (posterAvatar) {
        const g = selectedGender === 'female' ? 'female' : 'male';
        const avatarPath = `/avatars/${type.code}_${g}.png`;
        posterAvatar.innerHTML = `
            <div class="poster-avatar-frame avatar-${g}">
                <picture>
                    <source srcset="/avatars_webp/${type.code}_${g}.webp" type="image/webp">
                    <img src="${avatarPath}" alt="${texts.cn}" class="poster-avatar-img"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                <div class="poster-avatar-placeholder" style="display:none">
                    <span class="avatar-gender-icon">${g === 'female' ? '♀' : '♂'}</span>
                </div>
            </div>
        `;
    }

    const scrollY = window.scrollY;
    document.documentElement.style.setProperty('--scroll-y', `${scrollY}px`);
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    requestAnimationFrame(() => {
        renderPosterRadar(result);
    });
}

async function savePosterAsImage() {
    const downloadBtn = document.getElementById('downloadPosterBtn');
    const captureArea = document.getElementById('mainPosterCard');

    if (!captureArea || typeof html2canvas === 'undefined') {
        alert('海报引擎加载中，请稍后重试');
        return;
    }

    try {
        downloadBtn.textContent = '⏳ 正在生成高清海报...';
        downloadBtn.disabled = true;

        await new Promise(r => setTimeout(r, 300));
        await new Promise(r => requestAnimationFrame(r));

        const canvas = await html2canvas(captureArea, {
            useCORS: true,
            scale: 2,
            backgroundColor: '#0a0e0a',
            logging: false
        });

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], `Lawyer_Poster_${Date.now()}.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: '律师抓马人格报告',
                text: '这是我的律师人格测试结果，快来看看你的！'
            });
        } else {
            const link = document.createElement('a');
            link.download = `Lawyer_Result_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            alert('海报已生成！请长按图片保存或前往下载管理查看。');
        }
    } catch (err) {
        console.error('Poster build failed:', err);
        alert('海报生成失败，建议手动截屏分享。');
    } finally {
        downloadBtn.textContent = '🔥 长按下方图片保存，或点我下载';
        downloadBtn.disabled = false;
    }
}

// ─── 初始化 ─────────────────────────────────────────────
function bindBtn(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
}

document.addEventListener('DOMContentLoaded', () => {
    screens = {
        intro: document.getElementById('intro'),
        test: document.getElementById('test'),
        result: document.getElementById('result')
    };
    questionList = document.getElementById('questionList');
    progressBar = document.getElementById('progressBar');
    progressText = document.getElementById('progressText');
    submitBtn = document.getElementById('submitBtn');
    testHint = document.getElementById('testHint');

    checkSavedState();
    renderPersonaPreview();

    // 性别选择事件
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectGender(btn.dataset.gender);
        });
    });

    bindBtn('startBtn', resumeOrStartTest);
    bindBtn('freshStartBtn', () => {
        if (!selectedGender) return;
        clearState();
        startTest();
    });
    bindBtn('backIntroBtn', () => { showScreen('intro'); checkSavedState(); });
    bindBtn('submitBtn', handleSubmit);
    bindBtn('restartBtn', () => {
        if (!selectedGender) return;
        clearState();
        startTest();
    });
    bindBtn('toTopBtn', () => {
        clearState();
        showScreen('intro');
    });
    bindBtn('shareResultBtn', executeResultShare);
    bindBtn('shareResultBtnTop', executeResultShare);
    bindBtn('downloadPosterBtn', savePosterAsImage);

    const closePosterBtn = document.getElementById('closePosterBtn');
    if (closePosterBtn) {
        closePosterBtn.addEventListener('click', closeShareModal);
        closePosterBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            requestAnimationFrame(closeShareModal);
        });
    }

    const posterModal = document.getElementById('posterModal');
    if (posterModal) {
        posterModal.addEventListener('click', (e) => {
            if (e.target === posterModal) closeShareModal();
        });
        posterModal.addEventListener('touchend', (e) => {
            if (e.target === posterModal) {
                e.preventDefault();
                closeShareModal();
            }
        });
        posterModal.addEventListener('touchmove', (e) => {
            const container = posterModal.querySelector('.share-card-container');
            if (container && container.contains(e.target)) return;
            e.preventDefault();
        }, { passive: false });
    }

    // 人格详情弹窗事件
    const personaModalClose = document.getElementById('personaModalClose');
    if (personaModalClose) {
        personaModalClose.addEventListener('click', closePersonaModal);
    }
    const personaModal = document.getElementById('personaModal');
    if (personaModal) {
        personaModal.addEventListener('click', (e) => {
            if (e.target === personaModal) closePersonaModal();
        });
    }

    const navStartHandler = (e) => {
        e.preventDefault();
        resumeOrStartTest();
    };
    bindBtn('navStartBtn', navStartHandler);

    if (!history.state || !history.state.screen) {
        history.replaceState({ screen: 'intro' }, '', window.location.pathname + window.location.search);
    }
});

window.addEventListener('popstate', (e) => {
    const modal = document.getElementById('posterModal');
    if (modal && modal.classList.contains('active')) {
        closeShareModal();
        return;
    }
    const personaModal = document.getElementById('personaModal');
    if (personaModal && personaModal.classList.contains('active')) {
        closePersonaModal();
        return;
    }
    if (e.state && e.state.screen) {
        showScreen(e.state.screen, false);
    } else {
        showScreen('intro', false);
    }
});