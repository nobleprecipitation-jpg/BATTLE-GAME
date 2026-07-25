const loadingScreen = document.querySelector('#loading-screen');
const introScreen = document.querySelector('#intro-screen');
const titleScreen = document.querySelector('#title-screen');
const battleScreen = document.querySelector('#battle-screen');
const overlay = document.querySelector('#overlay');
const overlayPanel = document.querySelector('#overlay-panel');
const questionText = document.querySelector('#question-text');
const battleStatus = document.querySelector('#battle-status');
const answers = document.querySelector('#answers');
const enemyName = document.querySelector('#enemy-name');
const enemyLevel = document.querySelector('#enemy-level');
const enemyHp = document.querySelector('#enemy-hp');
const enemyHpText = document.querySelector('#enemy-hp-text');
const playerHp = document.querySelector('#player-hp');
const playerHpText = document.querySelector('#player-hp-text');
const comboLabel = document.querySelector('#combo-label');
const roundLabel = document.querySelector('#round-label');
const enemySprite = document.querySelector('#enemy-sprite');
const playerSprite = document.querySelector('#player-sprite');
const arena = document.querySelector('#arena');
const damageLayer = document.querySelector('#damage-layer');

const weatherLabel = document.querySelector('#weather-label');
const weatherLayer = document.querySelector('#weather-layer');
const networkStatus = document.querySelector('#network-status');
const state = { enemies: [], achievements: [], enemyIndex: 0, questionIndex: 0, playerHealth: 100, enemyHealth: 100, combo: 0, highestCombo: 0, correct: 0, wrong: 0, roundCorrect: 0, roundWrong: 0, damageDealt: 0, damageTaken: 0, startedAt: 0, locked: false, typeTimer: null, presentation: false, invincible: false, currentScreen: 'loading', typingActive: false, currentMessage: '', dataReady: false };
const settings = { textSpeed: 24, largeText: false, reducedMotion: false, screenShake: true };
const moves = { correct: { damage: 34 }, wrong: { damage: 34 } };
let audioContext;
const savedProgress = JSON.parse(localStorage.getItem('quizmon-progress') || '{"unlocked":[],"stats":{"battlesWon":0}}');

function spawnEnemyProjectile(enemyShortName) {
  const proj = document.createElement('div');
  proj.className = 'attack-projectile';
  if (enemyShortName === 'ARC') {
    proj.classList.add('projectile-pokeball');
  } else if (enemyShortName === 'JAY') {
    proj.classList.add('projectile-hollow-purple');
  } else if (enemyShortName === 'PAT') {
    proj.classList.add('projectile-dark-matter');
  } else {
    proj.classList.add('projectile-pokeball');
  }
  damageLayer.appendChild(proj);
  window.setTimeout(() => proj.remove(), 1000);
}

function spawnPlayerProjectile() {
  const proj = document.createElement('div');
  proj.className = 'attack-projectile projectile-aster-packet';
  damageLayer.appendChild(proj);
  window.setTimeout(() => proj.remove(), 800);
}

function loadSettings() { Object.assign(settings, JSON.parse(localStorage.getItem('quizmon-settings') || '{}')); document.body.classList.toggle('large-text', settings.largeText); document.body.classList.toggle('reduced-motion', settings.reducedMotion); }
function saveSettings() { localStorage.setItem('quizmon-settings', JSON.stringify(settings)); }
function getAccuracy() { const total = state.correct + state.wrong; return total ? Math.round((state.correct / total) * 100) : 0; }
function getRank(accuracy) { return accuracy >= 100 ? 'S+' : accuracy >= 90 ? 'S' : accuracy >= 80 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 60 ? 'C' : 'D'; }
function initAudio() { if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
function beep(frequency, duration = .08, type = 'sine') { if (!audioContext) return; const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.035, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration); }
function persistProgress() { localStorage.setItem('quizmon-progress', JSON.stringify(savedProgress)); }
function unlock(id) { if (!savedProgress.unlocked.includes(id)) { savedProgress.unlocked.push(id); persistProgress(); } }
function updateAchievements() { unlock('first-victory'); if (getAccuracy() === 100) { unlock('perfect-battle'); unlock('quiz-master'); } if (state.damageTaken === 0) unlock('no-damage'); if (state.highestCombo >= 5) unlock('combo-five'); savedProgress.stats.battlesWon = (savedProgress.stats.battlesWon || 0) + 1; persistProgress(); }

async function loadQuestions() {
  const responses = await Promise.all(['data/questions.json', 'data/enemies.json', 'data/achievements.json', 'data/moves.json'].map((path) => fetch(path)));
  if (responses.some((response) => !response.ok)) throw new Error('Lesson data unavailable');
  const [questions, enemyData, achievementData, moveData] = await Promise.all(responses.map((response) => response.json()));
  state.enemies = enemyData.enemies.map((enemy, index) => ({ ...enemy, questions: questions.enemies[index].questions })); state.achievements = achievementData.achievements; Object.assign(moves, moveData.moves); state.dataReady = true;
}

function showScreen(screen) {
  loadingScreen.hidden = screen !== 'loading';
  introScreen.hidden = screen !== 'intro';
  titleScreen.hidden = screen !== 'title';
  battleScreen.hidden = screen !== 'battle';
  loadingScreen.classList.toggle('is-active', screen === 'loading');
  introScreen.classList.toggle('is-active', screen === 'intro');
  titleScreen.classList.toggle('is-active', screen === 'title');
  battleScreen.classList.toggle('is-active', screen === 'battle');
  state.currentScreen = screen;
}

async function startGame() {
  if (!state.dataReady) {
    try {
      await loadQuestions();
    } catch (error) {
      questionText.textContent = 'Could not load the lesson bank.';
      battleStatus.textContent = 'Please refresh and try again.';
      return;
    }
  }
  state.enemyIndex = 0; state.questionIndex = 0; state.playerHealth = 100; state.enemyHealth = 100; state.combo = 0; state.highestCombo = 0; state.correct = 0; state.wrong = 0; state.roundCorrect = 0; state.roundWrong = 0; state.damageDealt = 0; state.damageTaken = 0; state.startedAt = Date.now(); state.locked = false;
  showScreen('battle');
  loadEnemy();
}

function loadEnemy() {
  const enemy = state.enemies[state.enemyIndex];
  state.questionIndex = 0; state.enemyHealth = 100; state.roundCorrect = 0; state.roundWrong = 0; state.locked = false;
  enemyName.textContent = enemy.shortName;
  enemyLevel.textContent = `LV. ${enemy.level}`;
  enemySprite.className = `sprite enemy-sprite ${enemy.sprite}`;
  enemySprite.style.opacity = '1';
  state.enemyHealth = 100;
  enemyHp.style.width = '100%';
  enemyHpText.textContent = '100';
  playerHp.style.width = `${state.playerHealth}%`;
  playerHpText.textContent = state.playerHealth;
  roundLabel.textContent = `0${state.enemyIndex + 1} / 03`;
  const currentWeather = enemy.weather; weatherLabel.textContent = currentWeather; arena.className = `arena stage-${enemy.stage} stage-${currentWeather.toLowerCase()}`; weatherLayer.setAttribute('data-weather', currentWeather);
  updateNetworkStatus();
  showDialogue(enemy.intro, renderQuestion);
}

function showDialogue(message, next) {
  state.locked = true; state.currentMessage = message; answers.innerHTML = ''; battleStatus.textContent = 'Press Enter or tap the arena to continue.'; typeText(message);
  const go = () => { if (!state.locked) return; clearTimeout(state.typeTimer); state.typingActive = false; state.locked = false; next(); };
  const handleDialogueKey = (event) => { if (event.key === 'Enter') { event.preventDefault(); if (state.typingActive) { clearTimeout(state.typeTimer); questionText.textContent = state.currentMessage; state.typingActive = false; state.locked = false; next(); } else { go(); } } };
  document.addEventListener('keydown', handleDialogueKey, { once: true });
  arena.onclick = go;
}

function typeText(message) { clearTimeout(state.typeTimer); state.currentMessage = message; questionText.textContent = ''; state.typingActive = true; let index = 0; const write = () => { questionText.textContent = message.slice(0, index); if (index < message.length) { index += 1; state.typeTimer = window.setTimeout(write, settings.textSpeed); } else { state.typingActive = false; } }; write(); }

function getCurrentEnemy() { return state.enemies?.[state.enemyIndex] || null; }
function getCurrentQuestion() { const enemy = getCurrentEnemy(); if (!enemy?.questions) return null; return enemy.questions[state.questionIndex] || null; }

function renderQuestion() {
  const enemy = getCurrentEnemy(); const question = getCurrentQuestion();
  if (!enemy || !question) {
    questionText.textContent = 'The lesson network is still loading.';
    battleStatus.textContent = 'Please restart the battle.';
    answers.innerHTML = '';
    return;
  }
  questionText.textContent = question.text; battleStatus.textContent = `Question ${state.questionIndex + 1} of 3 · Choose the answer that keeps your connection alive.`; answers.innerHTML = '';
  question.choices.forEach((choice, index) => { const button = document.createElement('button'); button.className = 'answer-button fade-in'; button.style.animationDelay = `${index * 70}ms`; const letter = String.fromCharCode(65 + index); button.innerHTML = `<span class="choice-key">${letter}</span><span class="choice-label">${choice}</span>`; button.dataset.index = index; button.addEventListener('click', () => answer(index, button)); button.addEventListener('mouseenter', () => button.classList.add('is-focused')); button.addEventListener('mouseleave', () => button.classList.remove('is-focused')); answers.appendChild(button); });
}

function answer(index, button) {
  if (state.locked) return; state.locked = true;
  initAudio(); beep(440);
  const question = getCurrentQuestion();
  if (!question) return;
  if (index === question.correct) correctAnswer(button); else wrongAnswer(button);
}

function correctAnswer(button) {
  state.correct += 1; state.roundCorrect += 1; state.combo += 1; state.highestCombo = Math.max(state.highestCombo, state.combo); state.damageDealt += 34; button.classList.add('correct'); enemySprite.classList.add('is-hit', 'flash'); playerSprite.classList.add('is-attacking');
  spawnPlayerProjectile();
  beep(660, .16, 'triangle'); showDamage(34, 'enemy');
  state.enemyHealth = Math.max(0, state.enemyHealth - 34);
  updateBars();
  const enemy = state.enemies[state.enemyIndex];
  const praise = enemy.shortName === 'ARC' ? 'Direct hit! You threw your data packet!' : enemy.shortName === 'JAY' ? 'Super effective! Jay’s glitch code cracked.' : 'Mastery hit! Boss Pat’s dark matter shatters.';
  battleStatus.textContent = praise;
  if (state.combo >= 5) arena.classList.add('critical-flash');
  window.setTimeout(() => { playerSprite.classList.remove('is-attacking'); enemySprite.classList.remove('is-hit', 'flash'); finishTurn(); }, 950);
}

function wrongAnswer(button) {
  state.wrong += 1; state.roundWrong += 1; state.combo = 0; button.classList.add('wrong'); playerSprite.classList.add('is-hit', 'flash'); enemySprite.classList.add('is-attacking');
  const enemy = state.enemies[state.enemyIndex];
  spawnEnemyProjectile(enemy.shortName);
  const damage = 34; state.damageTaken += state.invincible ? 0 : damage; beep(180, .16, 'sawtooth'); showDamage(state.invincible ? 0 : damage, 'player');
  state.playerHealth = Math.max(0, state.playerHealth - (state.invincible ? 0 : damage));
  updateBars();
  const taunt = enemy.shortName === 'ARC' ? 'Arc throws a Pokeball at you! -34 HP' : enemy.shortName === 'JAY' ? 'Jay blasts you with a Glitched Hollow Purple! -34 HP' : 'Boss Pat strikes you with Dark Matter! -34 HP';
  battleStatus.textContent = taunt;
  arena.classList.add('is-shaking');
  window.setTimeout(() => { playerSprite.classList.remove('is-hit', 'flash'); enemySprite.classList.remove('is-attacking'); arena.classList.remove('is-shaking'); finishTurn(); }, 950);
}

function finishTurn() {
  if (state.playerHealth <= 0) {
    return showGameOver('SIGNAL LOST (0 HP)', 'You made 3 wrong choices and ran out of health! Restart the battle to try again.');
  }
  const enemy = getCurrentEnemy();
  if (!enemy?.questions) return;
  const isLastQuestion = state.questionIndex >= enemy.questions.length - 1;
  if (isLastQuestion) {
    if (state.roundCorrect === 3) {
      return finishEnemy('KO'); // 3/3 -> Opponent Dies/KO'd
    } else if (state.roundCorrect === 2) {
      return finishEnemy('FORFEIT'); // 2/3 -> Opponent Forfeits
    } else {
      return showGameOver('MATCH LOST', `You got ${state.roundCorrect}/3 correct. You need at least 2/3 correct answers to beat ${enemy.shortName}!`);
    }
  }
  state.questionIndex += 1; state.locked = false; renderQuestion();
}

function finishEnemy(reason = 'KO') {
  enemySprite.classList.add('is-defeated');
  const enemy = state.enemies[state.enemyIndex];
  state.enemyHealth = 0;
  updateBars();
  if (reason === 'KO') {
    questionText.textContent = `${enemy.shortName} was knocked out! (3/3 Perfect)`;
    battleStatus.textContent = `${enemy.shortName} collapsed from your 3 consecutive correct answers!`;
  } else {
    questionText.textContent = `${enemy.shortName} forfeits the battle! (2/3 Correct)`;
    battleStatus.textContent = `${enemy.shortName} admits defeat after your strong performance!`;
  }
  answers.innerHTML = '';
  window.setTimeout(() => {
    enemySprite.classList.remove('is-defeated');
    if (state.enemyIndex === state.enemies.length - 1) {
      showVictory();
    } else {
      state.enemyIndex += 1;
      loadEnemy();
    }
  }, 1200);
}

function updateNetworkStatus() {
  const hp = state.playerHealth;
  let label = 'Excellent Connection';
  let cssClass = '';
  if (hp <= 50 && hp > 20) { label = 'Weak Signal'; cssClass = 'status-weak'; }
  else if (hp <= 20 && hp > 0) { label = 'Critical Connection'; cssClass = 'status-critical'; }
  else if (hp <= 0) { label = 'Connection Lost'; cssClass = 'status-lost'; }
  networkStatus.textContent = label;
  networkStatus.className = `network-status ${cssClass}`.trim();
}

function showGameOver() { showOverlay('CONNECTION LOST', 'Your signal dropped to zero. The lesson is not over—restart the network simulation and try again.', 'Retry', startGame, 'Return to Title', () => { closeOverlay(); showScreen('title'); }); }
function showVictory() { updateAchievements(); showOverlay('MISSION COMPLETE', `You mastered the lesson with ${state.correct} correct answers and ${state.wrong} misses. Accuracy: ${getAccuracy()}%.`, 'Play Again', startGame, 'View Results', showResults); }
function showResults() { const accuracy = getAccuracy(); const elapsed = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000)); overlayPanel.innerHTML = `<p class="eyebrow">BATTLE REPORT</p><h2>Knowledge unlocked.</h2><div class="stats-grid"><span>ACCURACY<b>${accuracy}%</b></span><span>RANK<b>${getRank(accuracy)}</b></span><span>COMBO<b>${state.highestCombo}x</b></span><span>TIME<b>${elapsed}s</b></span><span>DAMAGE DEALT<b>${state.damageDealt}</b></span><span>DAMAGE TAKEN<b>${state.damageTaken}</b></span></div><button data-overlay-action="close">Return to Title</button>`; overlayPanel.querySelector('button').onclick = () => { closeOverlay(); showScreen('title'); }; }
function showOverlay(title, message, primaryText, primaryAction, secondaryText, secondaryAction) { overlay.hidden = false; overlayPanel.className = 'overlay-panel'; overlayPanel.innerHTML = `<h2>${title}</h2><p>${message}</p><button data-overlay-action="primary">${primaryText}</button><button class="secondary" data-overlay-action="secondary">${secondaryText}</button>`; overlayPanel.querySelector('[data-overlay-action="primary"]').onclick = primaryAction; overlayPanel.querySelector('[data-overlay-action="secondary"]').onclick = secondaryAction; }
function closeOverlay() { overlay.hidden = true; }
function updateBars() { enemyHp.style.width = `${state.enemyHealth}%`; playerHp.style.width = `${state.playerHealth}%`; enemyHpText.textContent = state.enemyHealth; playerHpText.textContent = state.playerHealth; comboLabel.textContent = state.combo; updateNetworkStatus(); [enemyHp, playerHp].forEach((bar) => { bar.classList.toggle('warning', parseInt(bar.style.width) <= 50); bar.classList.toggle('danger', parseInt(bar.style.width) <= 25); }); }
function showDamage(amount, target) { const number = document.createElement('span'); number.className = 'damage-number'; number.textContent = `-${amount}`; number.style.left = target === 'enemy' ? '75%' : '25%'; number.style.top = target === 'enemy' ? '35%' : '64%'; damageLayer.appendChild(number); window.setTimeout(() => number.remove(), 1200); }

function showSettings() { overlay.hidden = false; overlayPanel.innerHTML = `<h2>SETTINGS</h2><p>Personalize your classroom run.</p><label class="setting-row">Text speed <input id="text-speed" type="range" min="5" max="60" value="${settings.textSpeed}"></label><label class="setting-row"><input id="large-text" type="checkbox" ${settings.largeText ? 'checked' : ''}> Large text</label><label class="setting-row"><input id="reduced-motion" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}> Reduced motion</label><label class="setting-row"><input id="screen-shake" type="checkbox" ${settings.screenShake ? 'checked' : ''}> Screen shake</label><button data-overlay-action="save">Save settings</button>`; overlayPanel.querySelector('[data-overlay-action="save"]').onclick = () => { settings.textSpeed = Number(overlayPanel.querySelector('#text-speed').value); settings.largeText = overlayPanel.querySelector('#large-text').checked; settings.reducedMotion = overlayPanel.querySelector('#reduced-motion').checked; settings.screenShake = overlayPanel.querySelector('#screen-shake').checked; saveSettings(); closeOverlay(); }; }
function showCredits() { overlay.hidden = false; overlayPanel.className = 'overlay-panel credits-panel'; overlayPanel.innerHTML = `<div class="credits-scroll"><p class="eyebrow">THE LEARNING LEAGUE PRESENTS</p><h2>QUIZMON<br><span>BATTLE ACADEMY</span></h2><p>Presenters<br><b>Your Classroom Crew</b></p><p>PowerPoint Creator<br><b>The Visual Team</b></p><p>Researchers<br><b>The Curious Minds</b></p><p>Game Programmer<br><b>Starboard Learning Labs</b></p><p>Special Thanks<br><b>Our Teacher & School</b></p><p class="credits-end">Keep asking better questions.</p></div><button data-overlay-action="close">Return to Title</button>`; overlayPanel.querySelector('button').onclick = () => { closeOverlay(); showScreen('title'); }; }
function showTrophies() { const cards = state.achievements.map((achievement) => { const unlocked = savedProgress.unlocked.includes(achievement.id); return `<div class="trophy ${unlocked ? 'unlocked' : ''}"><b>${unlocked ? achievement.icon : '·'}</b><span>${achievement.name}<small>${unlocked ? achievement.description : 'Locked achievement'}</small></span></div>`; }).join(''); showOverlay('TROPHY ROOM', `<div class="trophy-grid">${cards}</div>`, 'Return', closeOverlay, 'View Gallery', showGallery); }
function showGallery() { showOverlay('GALLERY', 'Character artwork and stage studies unlock as you complete the Learning League.', 'Return', closeOverlay, 'Trophy Room', showTrophies); }
function showInstructorMenu() { overlay.hidden = false; overlayPanel.className = 'overlay-panel instructor-panel'; overlayPanel.innerHTML = `<p class="eyebrow">PRESENTATION MODE</p><h2>Instructor tools</h2><button data-demo="skip">Skip to next rival</button><button data-demo="credits">Jump to results</button><button data-demo="invincible">Toggle invincibility: ${state.invincible ? 'ON' : 'OFF'}</button><button class="secondary" data-demo="close">Close</button>`; overlayPanel.querySelector('[data-demo="skip"]').onclick = () => { closeOverlay(); if (state.enemyIndex < 2) { state.enemyIndex += 1; loadEnemy(); } }; overlayPanel.querySelector('[data-demo="credits"]').onclick = showResults; overlayPanel.querySelector('[data-demo="invincible"]').onclick = () => { state.invincible = !state.invincible; showInstructorMenu(); }; overlayPanel.querySelector('[data-demo="close"]').onclick = closeOverlay; }
async function handleAction(action) { if (action === 'start') { if (state.currentScreen === 'title') { showScreen('intro'); } else if (state.currentScreen === 'intro' || state.currentScreen === 'loading') { await startGame(); } else { await startGame(); } return; } if (action === 'settings') showSettings(); if (action === 'credits') showCredits(); if (action === 'gallery') showGallery(); if (action === 'trophies') showTrophies(); if (action === 'pause' && !battleScreen.hidden) showOverlay('BATTLE PAUSED', 'Take a breath. Your battle state is safe.', 'Resume', closeOverlay, 'Restart Battle', startGame); }
document.addEventListener('click', (event) => { const action = event.target.closest('[data-action]')?.dataset.action; if (action) { handleAction(action); } });
document.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !battleScreen.hidden && !overlay.hidden) return; if (event.key === 'Enter' && !battleScreen.hidden && !state.locked) { const first = answers.querySelector('button'); if (first) first.focus(); } if (event.key === 'Escape' && !battleScreen.hidden) handleAction('pause'); });
document.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'p' && !battleScreen.hidden) { state.presentation = !state.presentation; document.body.classList.toggle('presentation-mode', state.presentation); } if (event.key === 'F10') { event.preventDefault(); showInstructorMenu(); } if (event.key === 'Enter' && state.currentScreen === 'title' && overlay.hidden) { event.preventDefault(); handleAction('start'); } if (event.key === 'Enter' && state.currentScreen === 'intro' && overlay.hidden) { event.preventDefault(); handleAction('start'); } });
loadSettings(); window.setTimeout(() => { showScreen('title'); }, 1200); loadQuestions().then(() => { state.dataReady = true; }).catch(() => { questionText.textContent = 'Could not load the lesson bank.'; });
