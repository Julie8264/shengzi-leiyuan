// ===== 全局状态 =====
let currentUnitId = null;
let currentLessonId = null;
let currentCharIndex = null;
let currentChar = null;
let animateWriter = null;
let quizWriter = null;
let quizState = { score: 0, question: 0, total: 10, correct: 0, currentAnswer: null, answered: false };
let currentStudent = null;     // 当前登录的学生姓名
let currentStudentClass = null; // 当前登录的学生班级

// ===== 学生管理 =====
function getCurrentStudent() {
    if (!currentStudent) {
        currentStudent = localStorage.getItem('currentStudent') || '';
    }
    return currentStudent;
}

function getCurrentStudentClass() {
    if (!currentStudentClass) {
        currentStudentClass = localStorage.getItem('currentStudentClass') || '';
    }
    return currentStudentClass;
}

function setCurrentStudent(name, className) {
    currentStudent = name;
    currentStudentClass = className;
    if (name) {
        localStorage.setItem('currentStudent', name);
    }
    if (className) {
        localStorage.setItem('currentStudentClass', className);
    }
}

function getStudentData(name) {
    // 兼容：先尝试带班级的key，再尝试旧的key
    const className = getCurrentStudentClass();
    let key = className ? 'student_' + className + '_' + name : 'student_' + name;
    let data = localStorage.getItem(key);
    if (!data) {
        // 尝试旧格式
        key = 'student_' + name;
        data = localStorage.getItem(key);
    }
    if (data) return JSON.parse(data);
    return {
        name: name,
        className: className || '',
        practiced: {},      // {字: {mistakes: 0, completed: true, date: '...'}}
        quizScores: [],     // [{score: 100, date: '...'}]
        learnedChars: [],   // 已查看过的字
        practicedChars: []  // 已完成书写练习的字
    };
}

function saveStudentData(name, data) {
    const className = data.className || getCurrentStudentClass() || '';
    // 同时写入带班级的key和旧格式key（兼容）
    const newKey = className ? 'student_' + className + '_' + name : 'student_' + name;
    localStorage.setItem(newKey, JSON.stringify(data));
    // 也写一份旧格式以兼容
    localStorage.setItem('student_' + name, JSON.stringify(data));
}

function getAllStudents() {
    const students = [];
    const seen = new Set();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('student_')) {
            // 提取学生数据
            const data = JSON.parse(localStorage.getItem(key));
            if (data && data.name && !seen.has(data.name)) {
                seen.add(data.name);
                students.push(data);
            }
        }
    }
    return students;
}

function getStudentsByClass(className) {
    const allStudents = getAllStudents();
    if (!className || className === '全部') return allStudents;
    return allStudents.filter(s => s.className === className);
}

function getAllClasses() {
    const classes = new Set();
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('student_')) {
            const data = JSON.parse(localStorage.getItem(key));
            if (data && data.className) classes.add(data.className);
        }
    }
    return Array.from(classes).sort();
}

// ===== LocalStorage 工具（兼容旧版） =====
function loadProgress() {
    const student = getCurrentStudent();
    if (student) {
        const data = getStudentData(student);
        return {
            learned: {},
            stars: data.practicedChars.length * 3 + data.learnedChars.length,
            bestScore: data.quizScores.length > 0 ? Math.max(...data.quizScores.map(s => s.score)) : 0
        };
    }
    const data = localStorage.getItem('charLearnProgress');
    return data ? JSON.parse(data) : { learned: {}, stars: 0, bestScore: 0 };
}

function saveProgress(progress) {
    if (!getCurrentStudent()) {
        localStorage.setItem('charLearnProgress', JSON.stringify(progress));
    }
}

function markLearned(unitId, lessonId, charIndex) {
    const student = getCurrentStudent();
    if (!student) return;
    const data = getStudentData(student);
    // 确保班级信息保存在数据中
    if (!data.className) data.className = getCurrentStudentClass() || '';
    const unit = charData.units.find(u => u.id === unitId);
    const lesson = unit.lessons.find(l => l.id === lessonId);
    const char = lesson.chars[charIndex];
    if (!data.learnedChars.includes(char.char)) {
        data.learnedChars.push(char.char);
        saveStudentData(student, data);
    }
    updateStats();
}

function isLearned(unitId, lessonId, charIndex) {
    const student = getCurrentStudent();
    if (!student) return false;
    const data = getStudentData(student);
    const unit = charData.units.find(u => u.id === unitId);
    const lesson = unit.lessons.find(l => l.id === lessonId);
    const char = lesson.chars[charIndex];
    return data.learnedChars.includes(char.char);
}

function recordPractice(char, mistakes) {
    const student = getCurrentStudent();
    if (!student) return;
    const data = getStudentData(student);
    if (!data.className) data.className = getCurrentStudentClass() || '';
    if (!data.practiced[char]) {
        data.practiced[char] = { mistakes: mistakes, completed: true, date: new Date().toISOString() };
    } else {
        data.practiced[char].mistakes += mistakes;
        data.practiced[char].completed = true;
        data.practiced[char].date = new Date().toISOString();
    }
    if (!data.practicedChars.includes(char)) {
        data.practicedChars.push(char);
    }
    saveStudentData(student, data);
}

function recordQuizScore(score, correct, total) {
    const student = getCurrentStudent();
    if (!student) return;
    const data = getStudentData(student);
    if (!data.className) data.className = getCurrentStudentClass() || '';
    data.quizScores.push({ score: score, correct: correct, total: total, date: new Date().toISOString() });
    saveStudentData(student, data);
}

function updateStats() {
    const progress = loadProgress();
    const el1 = document.getElementById('total-stars');
    const el2 = document.getElementById('learned-count');
    const el3 = document.getElementById('best-score');
    if (el1) el1.textContent = progress.stars || 0;
    if (el2) el2.textContent = Object.keys(progress.learned || {}).length + (getCurrentStudent() ? getStudentData(getCurrentStudent()).learnedChars.length : 0);
    if (el3) el3.textContent = progress.bestScore || 0;
}

// ===== 页面导航 =====
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function goHome() {
    showPage('home-page');
    renderUnitGrid();
    updateStats();
    updateStudentBar();
}

function goBackToLesson() {
    showPage('lesson-page');
    renderCharGrid();
}

// ===== 学生栏更新 =====
function updateStudentBar() {
    const bar = document.getElementById('student-bar');
    if (!bar) return;
    const student = getCurrentStudent();
    const className = getCurrentStudentClass();
    if (student) {
        bar.innerHTML = `<span>当前学生：<strong>${className} ${student}</strong></span> <button class="btn-student" onclick="showStudentLogin(true)">切换</button> <button class="btn-student" onclick="showStudentReport()">📊 练习记录</button>`;
    } else {
        bar.innerHTML = `<span style="color:var(--danger)">请先输入班级和姓名</span> <button class="btn-student" onclick="showStudentLogin(true)">输入信息</button>`;
    }
}

function showStudentLogin(show) {
    const modal = document.getElementById('student-modal');
    if (show) {
        // 回填已有信息
        const classInput = document.getElementById('student-class-input');
        const nameInput = document.getElementById('student-name-input');
        if (classInput) classInput.value = getCurrentStudentClass() || '';
        if (nameInput) nameInput.value = getCurrentStudent() || '';
        modal.style.display = 'flex';
    } else {
        modal.style.display = 'none';
    }
}

function confirmStudentName() {
    const classInput = document.getElementById('student-class-input');
    const nameInput = document.getElementById('student-name-input');
    const className = classInput ? classInput.value.trim() : '';
    const name = nameInput.value.trim();
    if (!className) {
        alert('请选择班级');
        return;
    }
    if (!name) {
        alert('请输入学生姓名');
        return;
    }
    setCurrentStudent(name, className);
    showStudentLogin(false);
    updateStudentBar();
    updateStats();
    goHome();
}

// ===== 学生练习记录报表 =====
function showStudentReport() {
    const student = getCurrentStudent();
    if (!student) return;
    const data = getStudentData(student);
    const reportPage = document.getElementById('report-page');
    
    // 统计所有生字
    const allChars = [];
    charData.units.forEach(u => u.lessons.forEach(l => l.chars.forEach(c => allChars.push(c))));
    const totalChars = allChars.length;
    
    let html = `
        <div style="padding:20px;">
        <h2 style="color:var(--primary-dark);">📊 ${className} ${student} 的练习记录</h2>
        <div style="display:flex;gap:16px;margin:16px 0;flex-wrap:wrap;">
            <div class="report-stat"><div class="report-stat-num">${data.learnedChars.length}</div><div class="report-stat-label">已学生字</div></div>
            <div class="report-stat"><div class="report-stat-num">${data.practicedChars.length}</div><div class="report-stat-label">已练书写</div></div>
            <div class="report-stat"><div class="report-stat-num">${data.quizScores.length}</div><div class="report-stat-label">挑战次数</div></div>
            <div class="report-stat"><div class="report-stat-num">${data.quizScores.length > 0 ? Math.max(...data.quizScores.map(s => s.score)) : 0}</div><div class="report-stat-label">最高分</div></div>
        </div>
    `;
    
    // 书写练习详情
    html += '<h3 style="color:var(--primary-dark);margin-top:20px;">✍ 书写练习记录</h3>';
    if (data.practicedChars.length === 0) {
        html += '<p style="color:var(--text-light);">还没有练习书写哦，加油！</p>';
    } else {
        html += '<table class="report-table"><tr><th>生字</th><th>错误次数</th><th>状态</th><th>练习时间</th></tr>';
        data.practicedChars.forEach(ch => {
            const p = data.practiced[ch] || {};
            const date = p.date ? new Date(p.date).toLocaleString('zh-CN') : '-';
            const status = p.mistakes === 0 ? '⭐ 一次过关' : (p.mistakes <= 2 ? '✅ 优秀' : '👍 已完成');
            html += `<tr><td style="font-size:1.5rem;">${ch}</td><td>${p.mistakes || 0}</td><td>${status}</td><td>${date}</td></tr>`;
        });
        html += '</table>';
    }
    
    // 未练习的字
    const notPracticed = allChars.filter(c => !data.practicedChars.includes(c.char));
    if (notPracticed.length > 0) {
        html += `<h3 style="color:var(--danger);margin-top:20px;">📝 还未练习的字（${notPracticed.length}个）</h3>`;
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;">';
        notPracticed.forEach(c => {
            html += `<span style="font-size:1.5rem;padding:8px 12px;background:#f0f0f0;border-radius:8px;">${c.char}</span>`;
        });
        html += '</div>';
    }
    
    // 挑战记录
    html += '<h3 style="color:var(--primary-dark);margin-top:20px;">🎯 识字挑战记录</h3>';
    if (data.quizScores.length === 0) {
        html += '<p style="color:var(--text-light);">还没有参加过挑战哦！</p>';
    } else {
        html += '<table class="report-table"><tr><th>次数</th><th>得分</th><th>正确率</th><th>时间</th></tr>';
        data.quizScores.slice().reverse().forEach((s, i) => {
            const date = new Date(s.date).toLocaleString('zh-CN');
            const rate = Math.round(s.correct / s.total * 100) + '%';
            html += `<tr><td>第${data.quizScores.length - i}次</td><td>${s.score}分</td><td>${s.correct}/${s.total} (${rate})</td><td>${date}</td></tr>`;
        });
        html += '</table>';
    }
    
    html += '<button class="quiz-start-btn" style="margin-top:20px;" onclick="goHome()">返回首页</button>';
    html += '</div>';
    
    reportPage.innerHTML = html;
    showPage('report-page');
}

// ===== 教师查看全班记录 =====
function showTeacherReport() {
    const allStudents = getAllStudents();
    const classes = getAllClasses();
    const reportPage = document.getElementById('report-page');
    
    // 如果没有班级数据，显示所有学生
    const currentFilter = window._teacherClassFilter || '全部';
    const students = currentFilter === '全部' ? allStudents : allStudents.filter(s => s.className === currentFilter);
    
    let html = `
        <div style="padding:20px;">
        <h2 style="color:var(--primary-dark);">📋 全班练习记录</h2>
        <p style="color:var(--text-light);">共 ${allStudents.length} 名学生有练习记录${classes.length > 0 ? '，分布在 ' + classes.length + ' 个班级' : ''}</p>
    `;
    
    // 班级筛选器
    if (classes.length > 0) {
        html += '<div style="margin:12px 0 20px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">';
        html += '<span style="color:var(--text-light);font-size:0.95rem;">筛选班级：</span>';
        html += `<button class="btn-student" style="background:${currentFilter === '全部' ? 'var(--primary)' : '#fff'};color:${currentFilter === '全部' ? '#fff' : 'var(--primary-dark)'};border-color:${currentFilter === '全部' ? 'var(--primary)' : 'var(--primary-light)'};" onclick="filterTeacherReport('全部')">全部</button>`;
        classes.forEach(c => {
            const active = currentFilter === c;
            html += `<button class="btn-student" style="background:${active ? 'var(--primary)' : '#fff'};color:${active ? '#fff' : 'var(--primary-dark)'};border-color:${active ? 'var(--primary)' : 'var(--primary-light)'};" onclick="filterTeacherReport('${c}')">${c}</button>`;
        });
        html += '</div>';
    }
    
    if (students.length === 0) {
        html += '<p style="color:var(--text-light);">还没有学生练习记录</p>';
    } else {
        // 全班概览表
        const allChars = [];
        charData.units.forEach(u => u.lessons.forEach(l => l.chars.forEach(c => { if (!allChars.find(x => x.char === c.char)) allChars.push(c); })));
        const totalChars = allChars.length;
        
        html += '<table class="report-table"><tr><th>班级</th><th>姓名</th><th>已学</th><th>已练书写</th><th>挑战次数</th><th>最高分</th><th>未练习字数</th></tr>';
        students.forEach(s => {
            const bestScore = s.quizScores.length > 0 ? Math.max(...s.quizScores.map(x => x.score)) : 0;
            const notDone = totalChars - s.practicedChars.length;
            html += `<tr><td style="font-size:0.9rem;color:var(--text-light);">${s.className || '-'}</td><td style="font-weight:bold;">${s.name}</td><td>${s.learnedChars.length}/${totalChars}</td><td>${s.practicedChars.length}/${totalChars}</td><td>${s.quizScores.length}</td><td>${bestScore}分</td><td style="color:${notDone > 0 ? 'var(--danger)' : 'var(--success)'};">${notDone}</td></tr>`;
        });
        html += '</table>';
        
        // 班级统计汇总
        if (classes.length > 1) {
            html += '<h3 style="color:var(--primary-dark);margin-top:24px;">📊 班级统计汇总</h3>';
            html += '<table class="report-table"><tr><th>班级</th><th>学生数</th><th>平均已练字数</th><th>平均挑战次数</th><th>平均最高分</th></tr>';
            classes.forEach(c => {
                const classStudents = allStudents.filter(s => s.className === c);
                const avgPracticed = classStudents.length > 0 ? Math.round(classStudents.reduce((sum, s) => sum + s.practicedChars.length, 0) / classStudents.length) : 0;
                const avgQuiz = classStudents.length > 0 ? Math.round(classStudents.reduce((sum, s) => sum + s.quizScores.length, 0) / classStudents.length * 10) / 10 : 0;
                const avgBest = classStudents.length > 0 ? Math.round(classStudents.reduce((sum, s) => {
                    const best = s.quizScores.length > 0 ? Math.max(...s.quizScores.map(x => x.score)) : 0;
                    return sum + best;
                }, 0) / classStudents.length) : 0;
                html += `<tr><td style="font-weight:bold;">${c}</td><td>${classStudents.length}</td><td>${avgPracticed}/${totalChars}</td><td>${avgQuiz}</td><td>${avgBest}分</td></tr>`;
            });
            html += '</table>';
        }
        
        // 每个学生的详情
        html += '<h3 style="color:var(--primary-dark);margin-top:24px;">📝 未完成书写练习的学生详情</h3>';
        students.forEach(s => {
            const notPracticed = allChars.filter(c => !s.practicedChars.includes(c.char));
            if (notPracticed.length > 0) {
                html += `<div style="margin:10px 0;padding:10px;background:#fff8f0;border-radius:8px;border-left:4px solid var(--accent);">`;
                html += `<strong>${s.className || ''} ${s.name}</strong>（还差 ${notPracticed.length} 个字）：`;
                html += '<div style="margin-top:6px;">';
                notPracticed.slice(0, 20).forEach(c => {
                    html += `<span style="font-size:1.3rem;margin:2px;">${c.char}</span>`;
                });
                if (notPracticed.length > 20) html += '<span style="color:var(--text-light);">...</span>';
                html += '</div></div>';
            }
        });
    }
    
    html += '<button class="quiz-start-btn" style="margin-top:20px;" onclick="goHome()">返回首页</button>';
    html += '</div>';
    
    reportPage.innerHTML = html;
    showPage('report-page');
}

function filterTeacherReport(className) {
    window._teacherClassFilter = className;
    showTeacherReport();
}

// ===== 渲染单元卡片 =====
function renderUnitGrid() {
    const grid = document.getElementById('unit-grid');
    grid.innerHTML = '';
    charData.units.forEach(unit => {
        const totalChars = unit.lessons.reduce((sum, l) => sum + l.chars.length, 0);
        let learnedCount = 0;
        unit.lessons.forEach(l => {
            l.chars.forEach((c, i) => {
                if (isLearned(unit.id, l.id, i)) learnedCount++;
            });
        });
        const percent = totalChars > 0 ? Math.round(learnedCount / totalChars * 100) : 0;

        const card = document.createElement('div');
        card.className = 'unit-card';
        card.onclick = () => openUnit(unit.id);
        card.innerHTML = `
            <div class="unit-num">${unit.name}</div>
            ${unit.lessons.map(l => `<div class="unit-lessons">📖 ${l.name}（${l.chars.length}字）</div>`).join('')}
            <div class="unit-progress">
                <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
                <span class="progress-text">${learnedCount}/${totalChars}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openUnit(unitId) {
    currentUnitId = unitId;
    const unit = charData.units.find(u => u.id === unitId);
    document.getElementById('lesson-title').textContent = unit.name;
    showPage('lesson-page');
    renderCharGrid();
}

// ===== 渲染生字卡片 =====
function renderCharGrid() {
    const unit = charData.units.find(u => u.id === currentUnitId);
    const grid = document.getElementById('char-grid');
    grid.innerHTML = '';

    unit.lessons.forEach(lesson => {
        const title = document.createElement('div');
        title.style.cssText = 'grid-column: 1 / -1; font-size:1.2rem; font-weight:bold; color:var(--primary-dark); margin-top:10px; padding:8px; border-left:4px solid var(--accent);';
        title.textContent = lesson.name;
        grid.appendChild(title);

        lesson.chars.forEach((charData, index) => {
            const learned = isLearned(unit.id, lesson.id, index);
            const card = document.createElement('div');
            card.className = 'char-card' + (learned ? ' learned' : '');
            card.innerHTML = `
                <div class="card-check">✅</div>
                <div class="card-char">${charData.char}</div>
                <div class="card-pinyin">${charData.pinyin}</div>
            `;
            card.onclick = () => openCharDetail(unit.id, lesson.id, index);
            grid.appendChild(card);
        });
    });
}

// ===== 生字详情页 =====
function openCharDetail(unitId, lessonId, charIndex) {
    currentUnitId = unitId;
    currentLessonId = lessonId;
    currentCharIndex = charIndex;

    const unit = charData.units.find(u => u.id === unitId);
    const lesson = unit.lessons.find(l => l.id === lessonId);
    currentChar = lesson.chars[charIndex];

    document.getElementById('detail-title').textContent = `${lesson.name} - ${currentChar.char}`;
    document.getElementById('big-char').textContent = currentChar.char;
    document.getElementById('char-pinyin').textContent = currentChar.pinyin;
    document.getElementById('char-structure').textContent = `结构：${currentChar.structure}`;
    document.getElementById('char-meaning').textContent = `释义：${currentChar.meaning}`;

    // 重置按钮为"开始书写"
    const startBtn = document.querySelector('.ctrl-start');
    if (startBtn) startBtn.textContent = '▶ 开始书写';

    switchMode('stroke');
    markLearned(unitId, lessonId, charIndex);
    showPage('detail-page');
}

// ===== 模式切换 =====
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => switchMode(tab.dataset.mode));
    });
    renderUnitGrid();
    updateStats();
    // 强制检查：如果没有班级或姓名，弹出登录框
    const student = getCurrentStudent();
    const className = getCurrentStudentClass();
    if (!student || !className) {
        // 强制弹出，阻止用户使用网站
        showStudentLogin(true);
        // 给弹窗加遮罩，阻止点击穿透
        const modal = document.getElementById('student-modal');
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
    } else {
        updateStudentBar();
    }
});

function switchMode(mode) {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mode-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.mode-tab[data-mode="${mode}"]`).classList.add('active');
    document.getElementById(`${mode}-mode`).classList.add('active');

    if (mode === 'words') renderWords();
    if (mode === 'quiz') initQuiz();
    if (mode === 'stroke') {
        setTimeout(() => { initAnimateWriter(); }, 100);
    }
}

// ===== 笔顺子模式切换 =====
function switchStrokeSubMode(submode) {
    document.querySelectorAll('.sub-mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sub-mode-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.sub-mode-tab[data-submode="${submode}"]`).classList.add('active');
    document.getElementById(`submode-${submode}`).classList.add('active');

    if (submode === 'watch') {
        setTimeout(() => { initAnimateWriter(); }, 100);
    }
    if (submode === 'practice') {
        setTimeout(() => { initQuizWriter(); }, 100);
    }
}

// ===== 语音合成 =====
function speak(text) {
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.7;
        speechSynthesis.speak(utterance);
    }
}

// ===== 提示音 =====
function playDing() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
}

// ===== 笔顺演示（HanziWriter 动画） =====
function initAnimateWriter() {
    if (!currentChar) return;
    const target = document.getElementById('hw-animate-target');
    if (!target) return;
    target.innerHTML = '';

    try {
        animateWriter = HanziWriter.create('hw-animate-target', currentChar.char, {
            width: 400,
            height: 400,
            padding: 20,
            strokeAnimationSpeed: 1,
            delayBetweenStrokes: 800,
            showCharacter: false,
            showOutline: true,
            strokeColor: '#333333',
            outlineColor: '#ccc',
            drawingColor: '#333333',
            radicalColor: '#168c2d',
            onLoadCharDataError: function(reason) {
                target.innerHTML = '<p style="color:#999;text-align:center;padding:60px 0;">该字暂无笔顺数据<br>可使用其他功能学习</p>';
            }
        });
    } catch(e) {
        target.innerHTML = '<p style="color:#999;text-align:center;padding:60px 0;">该字暂无笔顺数据</p>';
    }

    document.getElementById('stroke-order-display').innerHTML =
        '<p class="stroke-hint">点击"播放笔顺动画"观看书写演示，同时会朗读每一笔的名称</p>';
}

function playHanziWriterAnimation() {
    if (!animateWriter || !currentChar) return;

    const display = document.getElementById('stroke-order-display');
    const strokes = currentChar.strokes || [];
    const totalStrokes = strokes.length;

    let stepsHtml = '';
    if (totalStrokes > 0) {
        stepsHtml = '<div class="stroke-steps">';
        for (let i = 0; i < totalStrokes; i++) {
            stepsHtml += `<span class="stroke-step" id="anim-step-${i}" title="第${i+1}笔：${strokes[i]}">${i + 1}</span>`;
        }
        stepsHtml += '</div>';
    }
    display.innerHTML =
        `<p class="stroke-hint" id="anim-hint" style="color:var(--accent-dark);font-weight:bold;">正在播放笔顺动画...</p>` +
        stepsHtml;

    // 启动 HanziWriter 动画
    animateWriter.animateCharacter();

    // 用语音 onend 事件串联，确保每笔读完再读下一笔，不会累积偏差
    function highlightStroke(idx) {
        document.querySelectorAll('.stroke-step').forEach(s => s.classList.remove('active'));
        const stepEl = document.getElementById(`anim-step-${idx}`);
        if (stepEl) stepEl.classList.add('active');
        const hintEl = document.getElementById('anim-hint');
        if (hintEl) hintEl.textContent = `第${idx + 1}笔：${strokes[idx]}（共${totalStrokes}画）`;
    }

    function speakStrokeSequentially(idx) {
        if (idx >= totalStrokes) {
            document.querySelectorAll('.stroke-step').forEach(s => s.classList.remove('active'));
            const hintEl = document.getElementById('anim-hint');
            if (hintEl) {
                hintEl.textContent = `✅ "${currentChar.char}"字共${totalStrokes}画，书写完成！`;
                hintEl.style.color = 'var(--success)';
            }
            return;
        }

        highlightStroke(idx);

        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(strokes[idx]);
            utterance.lang = 'zh-CN';
            utterance.rate = 0.8;
            utterance.onend = function() {
                speakStrokeSequentially(idx + 1);
            };
            utterance.onerror = function() {
                speakStrokeSequentially(idx + 1);
            };
            speechSynthesis.speak(utterance);
        } else {
            setTimeout(() => speakStrokeSequentially(idx + 1), 600);
        }
    }

    speechSynthesis.cancel();
    speakStrokeSequentially(0);
}

function resetHanziWriter() {
    initAnimateWriter();
}

// ===== 按笔顺书写（HanziWriter Quiz） =====
function initQuizWriter() {
    if (!currentChar) return;
    const target = document.getElementById('hw-quiz-target');
    if (!target) return;
    target.innerHTML = '';

    // 每次进入时重置按钮为"开始书写"
    const startBtn = document.querySelector('.ctrl-start');
    if (startBtn) startBtn.textContent = '▶ 开始书写';

    // 重置UI
    document.getElementById('practice-stroke-name').textContent = '点击"开始书写"按钮';
    document.getElementById('practice-stroke-name').style.color = 'var(--accent-dark)';
    document.getElementById('practice-progress').innerHTML = '';
    document.getElementById('practice-result').innerHTML =
        '<p class="info-msg">用手指或鼠标在田字格中按正确笔顺书写。不会提示笔画名称，写对了笔画自动加深，写错了会告诉你正确答案！</p>';

    try {
        quizWriter = HanziWriter.create('hw-quiz-target', currentChar.char, {
            width: 400,
            height: 400,
            padding: 20,
            showCharacter: false,
            showOutline: true,
            strokeColor: '#333333',
            outlineColor: '#d0d0d0',
            drawingColor: '#333',
            highlightColor: '#a5d6ff',
            radicalColor: '#168c2d',
            onLoadCharDataError: function(reason) {
                target.innerHTML = '<p style="color:#999;text-align:center;padding:60px 0;">该字暂无笔顺数据<br>无法进行书写练习</p>';
            }
        });
    } catch(e) {
        target.innerHTML = '<p style="color:#999;text-align:center;padding:60px 0;">该字暂无笔顺数据</p>';
    }
}

function startHanziQuiz() {
    if (!quizWriter || !currentChar) return;

    const strokes = currentChar.strokes || [];
    const totalStrokes = strokes.length;

    updateQuizDisplay(0, totalStrokes, strokes, 'start');

    quizWriter.quiz({
        showHintAfterMisses: 1,
        leniency: 1.0,
        highlightOnComplete: true,
        onMistake: function(strokeData) {
            const strokeNum = strokeData.strokeNum;
            const strokeName = strokes[strokeNum] || '';

            updateQuizDisplay(strokeNum, totalStrokes, strokes, 'error');
            speak(`笔顺错误，第${strokeNum + 1}笔是${strokeName}，请重写`);
            document.getElementById('practice-result').innerHTML =
                `<p class="error-msg">❌ 笔顺有误！第${strokeNum + 1}笔应为"${strokeName}"，请重新写这一笔</p>`;
        },
        onCorrectStroke: function(strokeData) {
            const strokeNum = strokeData.strokeNum;
            const remaining = strokeData.strokesRemaining;
            const nextStrokeNum = strokeNum + 1;

            updateQuizDisplay(nextStrokeNum, totalStrokes, strokes, 'correct');
            playDing();

            if (remaining > 0) {
                document.getElementById('practice-result').innerHTML =
                    `<p class="success-msg" style="font-size:1.1rem;">✅ 第${strokeNum + 1}笔正确！还剩${remaining}笔，继续写</p>`;
            }
        },
        onComplete: function(summary) {
            const total = summary.totalMistakes || 0;
            updateQuizDisplay(totalStrokes, totalStrokes, strokes, 'complete');
            speak(`${currentChar.char}字书写完成，太棒了`);

            // 记录到学生数据
            recordPractice(currentChar.char, total);

            let msg = '';
            if (total === 0) {
                msg = `🏆 完美！一字不差，全部笔顺正确！${currentChar.char}字共${totalStrokes}画`;
            } else if (total <= 2) {
                msg = `🎉 太棒了！你按正确笔顺写完了"${currentChar.char}"字（共${totalStrokes}画，错了${total}次）`;
            } else {
                msg = `👍 完成了！你写完了"${currentChar.char}"字（共${totalStrokes}画），再多练习几次吧！`;
            }

            document.getElementById('practice-result').innerHTML = `<p class="success-msg">${msg}</p>`;

            // 按钮恢复为"开始书写"
            document.querySelector('.ctrl-start').textContent = '▶ 开始书写';
        }
    });

    document.querySelector('.ctrl-start').textContent = '🔄 重新开始';
}

function updateQuizDisplay(currentStroke, totalStrokes, strokes, status) {
    const strokeNameEl = document.getElementById('practice-stroke-name');
    const progressEl = document.getElementById('practice-progress');

    if (status === 'complete' || currentStroke >= totalStrokes) {
        strokeNameEl.textContent = '书写完成！';
        strokeNameEl.style.color = 'var(--success)';
    } else if (status === 'start') {
        strokeNameEl.textContent = `请自己按笔顺书写（共${totalStrokes}画）`;
        strokeNameEl.style.color = 'var(--primary-dark)';
    } else if (status === 'error') {
        const stroke = strokes[currentStroke] || '';
        strokeNameEl.textContent = `第${currentStroke + 1}笔应为：${stroke}`;
        strokeNameEl.style.color = 'var(--danger)';
    } else {
        strokeNameEl.textContent = `第${currentStroke + 1}笔，请书写`;
        strokeNameEl.style.color = 'var(--accent-dark)';
    }

    let dotsHtml = '';
    for (let i = 0; i < totalStrokes; i++) {
        let cls = '';
        if (i < currentStroke) cls = 'done';
        else if (i === currentStroke) cls = 'current';
        dotsHtml += `<span class="practice-progress-dot ${cls}">${i + 1}</span>`;
    }
    progressEl.innerHTML = dotsHtml;
}

function resetHanziQuiz() {
    initQuizWriter();
}

// ===== 词语学习 =====
function renderWords() {
    if (!currentChar) return;
    const list = document.getElementById('words-list');
    list.innerHTML = '';

    currentChar.words.forEach(word => {
        const card = document.createElement('div');
        card.className = 'word-card';
        const highlighted = word.split('').map(ch => {
            if (ch === currentChar.char) {
                return `<span class="word-highlight">${ch}</span>`;
            }
            return ch;
        }).join('');
        card.innerHTML = `<div class="word-text">${highlighted}</div>`;
        card.onclick = () => { speak(word); };
        list.appendChild(card);
    });

    const sentenceCard = document.createElement('div');
    sentenceCard.className = 'word-card';
    sentenceCard.style.gridColumn = '1 / -1';
    sentenceCard.style.background = 'linear-gradient(135deg, #fff5e6 0%, #fff 100%)';
    sentenceCard.style.borderColor = 'var(--accent)';
    sentenceCard.innerHTML = `<div class="word-text" style="font-size:1rem; line-height:1.8;">💡 "${currentChar.char}"字共${currentChar.strokes.length}画，结构为${currentChar.structure}。点击上方词语听读音！</div>`;
    list.appendChild(sentenceCard);
}

// ===== 识字挑战 =====
function initQuiz() {
    quizState = { score: 0, question: 0, total: 10, correct: 0, currentAnswer: null, answered: false };
    showQuizStart();
}

function showQuizStart() {
    const area = document.getElementById('quiz-area');
    area.innerHTML = `
        <div style="padding:40px 20px;">
            <h2 style="color:var(--primary-dark); margin-bottom:16px;">🎯 识字大挑战</h2>
            <p style="color:var(--text-light); margin-bottom:20px;">共 ${quizState.total} 题，看字选拼音或看拼音选字<br>答对得分，看看你能得多少分！</p>
            <button class="quiz-start-btn" onclick="startQuiz()">开始挑战</button>
        </div>
    `;
}

function startQuiz() {
    quizState.question = 0;
    quizState.score = 0;
    quizState.correct = 0;
    nextQuestion();
}

function nextQuestion() {
    if (quizState.question >= quizState.total) {
        showQuizResult();
        return;
    }

    quizState.question++;
    quizState.answered = false;

    const allChars = [];
    charData.units.forEach(u => {
        u.lessons.forEach(l => {
            l.chars.forEach(c => allChars.push(c));
        });
    });

    const correctChar = allChars[Math.floor(Math.random() * allChars.length)];
    quizState.currentAnswer = correctChar.pinyin;

    const questionType = Math.random() > 0.5 ? 'char2pinyin' : 'pinyin2char';

    const wrongOptions = [];
    while (wrongOptions.length < 3) {
        const wrong = allChars[Math.floor(Math.random() * allChars.length)];
        const wrongVal = questionType === 'char2pinyin' ? wrong.pinyin : wrong.char;
        if (wrongVal !== correctChar.pinyin && wrongVal !== correctChar.char &&
            !wrongOptions.includes(wrongVal) &&
            (questionType === 'char2pinyin' ? wrong.pinyin !== correctChar.pinyin : wrong.char !== correctChar.char)) {
            wrongOptions.push(wrongVal);
        }
    }

    const correctOption = questionType === 'char2pinyin' ? correctChar.pinyin : correctChar.char;
    const options = [...wrongOptions, correctOption].sort(() => Math.random() - 0.5);

    const area = document.getElementById('quiz-area');
    if (questionType === 'char2pinyin') {
        area.innerHTML = `
            <div class="quiz-score">第 ${quizState.question}/${quizState.total} 题 | 得分：${quizState.score}</div>
            <div class="quiz-question">请选出下面这个字的正确读音</div>
            <div class="quiz-char">${correctChar.char}</div>
            <div class="quiz-options" id="quiz-options"></div>
            <div class="quiz-feedback" id="quiz-feedback"></div>
            <button class="quiz-next-btn" id="quiz-next-btn" onclick="nextQuestion()">下一题 →</button>
        `;
    } else {
        area.innerHTML = `
            <div class="quiz-score">第 ${quizState.question}/${quizState.total} 题 | 得分：${quizState.score}</div>
            <div class="quiz-question">请选出读音为 <span style="color:var(--accent-dark); font-weight:bold; font-size:1.5rem;">${correctChar.pinyin}</span> 的字</div>
            <div class="quiz-options" id="quiz-options"></div>
            <div class="quiz-feedback" id="quiz-feedback"></div>
            <button class="quiz-next-btn" id="quiz-next-btn" onclick="nextQuestion()">下一题 →</button>
        `;
    }

    const optionsEl = document.getElementById('quiz-options');
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = opt;
        btn.onclick = () => selectAnswer(opt, correctOption, btn);
        optionsEl.appendChild(btn);
    });
}

function selectAnswer(selected, correct, btnEl) {
    if (quizState.answered) return;
    quizState.answered = true;

    const allOptions = document.querySelectorAll('.quiz-option');
    allOptions.forEach(opt => {
        if (opt.textContent === correct) {
            opt.classList.add('correct');
        } else if (opt.textContent === selected) {
            opt.classList.add('wrong');
        }
        opt.style.pointerEvents = 'none';
    });

    const feedback = document.getElementById('quiz-feedback');
    if (selected === correct) {
        quizState.correct++;
        quizState.score += 10;
        feedback.innerHTML = `<span style="color:var(--success);">✅ 答对了！+10分</span>`;
        spawnStars(btnEl);
    } else {
        feedback.innerHTML = `<span style="color:var(--danger);">❌ 答错了，正确答案是：${correct}</span>`;
    }

    document.getElementById('quiz-next-btn').classList.add('show');
}

function showQuizResult() {
    const area = document.getElementById('quiz-area');
    const percent = Math.round(quizState.correct / quizState.total * 100);
    let medal = '';
    if (percent === 100) medal = '🏆 满分通关！你是识字大王！';
    else if (percent >= 80) medal = '🥇 优秀！你真棒！';
    else if (percent >= 60) medal = '🥈 不错哦，继续加油！';
    else medal = '🥉 还需努力，多多练习！';

    // 记录挑战成绩
    recordQuizScore(quizState.score, quizState.correct, quizState.total);

    area.innerHTML = `
        <div style="padding:30px 20px;">
            <h2 style="color:var(--primary-dark); margin-bottom:16px;">🎯 挑战完成！</h2>
            <div style="font-size:3rem; margin:20px 0;">${medal}</div>
            <div class="quiz-score" style="font-size:2rem;">总分：${quizState.score} 分</div>
            <p style="color:var(--text-light); margin:12px 0;">答对 ${quizState.correct}/${quizState.total} 题（${percent}%）</p>
            <button class="quiz-start-btn" onclick="startQuiz()">再挑战一次</button>
        </div>
    `;
}

function spawnStars(el) {
    const rect = el.getBoundingClientRect();
    for (let i = 0; i < 5; i++) {
        const star = document.createElement('div');
        star.textContent = '⭐';
        star.style.cssText = `
            position: fixed;
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top}px;
            font-size: 1.5rem;
            pointer-events: none;
            z-index: 9999;
            transition: all 0.8s ease-out;
        `;
        document.body.appendChild(star);
        setTimeout(() => {
            star.style.transform = `translate(${(Math.random() - 0.5) * 200}px, ${-100 - Math.random() * 100}px) scale(0)`;
            star.style.opacity = '0';
        }, 50);
        setTimeout(() => star.remove(), 900);
    }
}
