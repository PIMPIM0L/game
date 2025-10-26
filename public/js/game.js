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
const startBtn = document.getElementById('start-btn');
const gameArea = document.getElementById('game-area');
const startArea = document.getElementById('start-area');

// Start Game
window.addEventListener('DOMContentLoaded', startGame);

if (startBtn) {
  startBtn.addEventListener('click', startGame);
}

async function startGame() {
  try {
    const response = await axios.get('/api/questions');
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

    startArea.style.display = 'none';
    gameArea.style.display = 'block';

    updateScore();
    displayQuestion();
    startTimer();
  } catch (error) {
    console.error('Error starting game:', error);
    alert('Failed to start game. Please try again.');
  }
}


// Display Question
function displayQuestion() {
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }
  
  const question = questions[currentQuestionIndex];
  emojiDisplay.textContent = question.emojis;
  answerInput.value = '';
  answerInput.focus();
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
    timerDisplay.style.color = '#667eea';
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

    alert(`เกมจบแล้ว!\n\nคะแนนของคุณ: ${score} คะแนน\nเวลาที่ใช้: ${timeString}\n\nบันทึกผลเรียบร้อยแล้ว!`);
    window.location.href = '/player/history';
  } catch (error) {
    console.error('Error saving game:', error);
    alert(`เกมจบแล้ว!\n\nคะแนนของคุณ: ${score} คะแนน\nเวลาที่ใช้: ${timeString}`);
  }
}