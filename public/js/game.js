let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timeRemaining = 90;
let timerInterval;
let gameStartTime;
let gameActive = false;

const timerDisplay = document.getElementById('timer');
const emojiDisplay = document.getElementById('emoji-display');
const scoreDisplay = document.getElementById('score-display');
const answerInput = document.getElementById('answer-input');
const submitBtn = document.getElementById('submit-btn');
const skipBtn = document.getElementById('skip-btn');
const gameArea = document.getElementById('game-area');
const hintDisplay = document.getElementById('hint-display');
const hintBtn = document.getElementById('hint-btn');

// Start Game
window.addEventListener('DOMContentLoaded', startGame);

async function startGame() {
  try {
    const response = await axios.get('/api/questions?' + new Date().getTime()); // ป้องกัน cache
    questions = response.data;
    if (questions.length === 0) {
      alert('No questions available!');
      return;
    }


    currentQuestionIndex = 0;
    score = 0;
    timeRemaining = 90;
    gameActive = true;
    gameStartTime = Date.now();

    gameArea.style.display = 'block';

    updateScore();
    displayQuestion();
    startTimer();
  } catch (error) {

  }
}

// Display Question

let hintShown = false; // กันกดซ้ำ

function displayQuestion() {
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }
  
  const question = questions[currentQuestionIndex];
  emojiDisplay.textContent = question.emojis;
  answerInput.value = '';
  answerInput.focus();

  hintDisplay.style.display = 'none';
  hintDisplay.textContent = question.hint ? `คำใบ้: ${question.hint}` : "(ไม่มีคำใบ้)";
  hintShown = false;
}
if (hintBtn) {
  hintBtn.addEventListener('click', () => {
    if (!hintShown) {
      hintDisplay.style.display = 'block';
      hintShown = true;
    }
  });
}

// Timer
function startTimer() {
  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    
    if (timeRemaining <= 0) {
      endGame();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  if (timeRemaining <= 10) {
    timerDisplay.style.color = '#f44336';
  } else {
    timerDisplay.style.color = '#4A4947';
  }
}

// Update Score
function updateScore() {
  scoreDisplay.textContent = `คะแนน: ${score}`;
}

// Check Answer
if (submitBtn) {
  submitBtn.addEventListener('click', checkAnswer);
}

if (answerInput) {
  answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      checkAnswer();
    }
  });
}

function checkAnswer() {
  if (!gameActive) return;
  
  const userAnswer = answerInput.value.trim().toLowerCase();
  const correctAnswer = questions[currentQuestionIndex].answer.toLowerCase();
  
  if (userAnswer === correctAnswer) {
    score++;
    updateScore();
    currentQuestionIndex++;
    displayQuestion();
  } else {
    alert('คำตอบไม่ถูกต้อง! ลองใหม่อีกครั้ง');
    answerInput.value = '';
    answerInput.focus();
  }
}

// Skip Question
if (skipBtn) {
  skipBtn.addEventListener('click', () => {
    if (!gameActive) return;
    
    currentQuestionIndex++;
    displayQuestion();
  });
}

// End Game
async function endGame() {
  gameActive = false;
  clearInterval(timerInterval);

  const timeUsed = Math.floor((Date.now() - gameStartTime) / 1000);
  const minutes = Math.floor(timeUsed / 60);
  const seconds = timeUsed % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  try {
    await axios.post('/api/game/save', {
      score: score,
      timeUsed: timeString
    });
    window.location.replace('/player/history');
  } catch (error) {
    console.error('Error saving game:', error);
  }
}