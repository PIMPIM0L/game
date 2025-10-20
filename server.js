import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
// import pool from './database/db.js';
import dotenv from 'dotenv';
import { loadQuestions, saveQuestions, getAllQuestions, getQuestionsCount, getRandomQuestions } 
  from './database/questions.js';
import connectPgSimple from "connect-pg-simple";
import pg from "pg";


dotenv.config();

const __filename = fileURLToPath(import.meta.url);

const app = express();
const PORT = process.env.PORT || 3000;

// --- PostgreSQL pool ---
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// --- Session Store (เก็บ session ลง Postgres) ---
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session", // ชื่อตาราง session (ปล่อยให้ lib สร้างให้โดยอัตโนมัติ)
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24, // 1 วัน
    },
  })
);

// --- Helper: แนบ user เข้ากับ req จาก session ---
app.use((req, res, next) => {
  if (req.session && req.session.user) {
    req.user = req.session.user;
  }
  next();
});

// Auth Middleware
app.use((req, res, next) => {
  const publicPaths = ['/login', '/register']; // หน้าที่ไม่ต้องล็อกอิน
  if (!req.user.id && !publicPaths.includes(req.path)) {
    return res.redirect('/login');
  }
  next();
});


function requireAuth(...roles) {
  return (req, res, next) => {
    if (!req.user.id) return res.status(401).send("Unauthorized");
    if (!roles.includes(req.user.role)) return res.status(403).send("บทบาทของคุณไม่ได้รับอนุญาตให้เข้าหน้านี้");
    next();
  };
}

// Routes

// Home - Redirect based on auth status
app.get('/', (req, res) => {
  if (req.user.id) {
    if (req.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/player/dashboard');
  }
  res.redirect('/login');
});

// Login Page
app.get('/login', (req, res) => {
  if (req.user.id) {
    return res.redirect('/');
  }
  res.render('login', { error: null });
});

// Login POST
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const {result} = await pool.query('SELECT * FROM users WHERE username = $1 LIMIT 1', [username]);
    
    if (result.length === 0) {
      return res.render('login', { error: 'Invalid username or password' });
    }    

    const u = result[0];
    req.session.user = {
      id: u.id,
      username: u.username,
      role: u.role,
    };

    if (u.role === 'admin') {
      res.redirect('/admin/dashboard');
    } else {
      res.redirect('/player/dashboard');
    }
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'An error occurred' });
  }
});

// Register Page
app.get('/register', (req, res) => {
  if (req.user.id) {
    return res.redirect('/');
  }
  res.render('register', { error: null });
});

// Register POST
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    const userExists = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    
    if (userExists.rows.length > 0) {
      return res.render('register', { error: 'Username or email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
      [username, email, hashedPassword, 'player']
    );
    
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'An error occurred' });
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// PLAYER ROUTES

// Player Dashboard
app.get('/player/dashboard', requireAuth("player"), (req, res) => {
  res.render('player/dashboard', { username: req.user.username });
});

// Game Page
app.get('/player/game', requireAuth("player"), (req, res) => {
  res.render('player/game', { username: req.user.username });
});

// Get Random Questions API
app.get('/api/questions', requireAuth("player"), (req, res) => {
  try {
    const questions = getRandomQuestions(10);
    res.json(questions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Save Game Result
app.post('/api/game/save', requireAuth("player"), async (req, res) => {
  const { score, timeUsed } = req.body;
  
  try {
    await pool.query(
      'INSERT INTO game_history (user_id, score, time_used) VALUES ($1, $2, $3)',
      [req.user.id, score, timeUsed]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save game result' });
  }
});

// Player History
app.get('/player/history', requireAuth("player"), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM game_history WHERE user_id = $1 ORDER BY played_at DESC',
      [req.user.id]
    );
    res.render('player/history', { 
      username: req.user.username,
      history: result.rows 
    });
  } catch (err) {
    console.error(err);
    res.render('player/history', { 
      username: req.user.username,
      history: [] 
    });
  }
});

// Player Settings
app.get('/player/settings', requireAuth("player"), async (req, res) => {
  try {
    const result = await pool.query('SELECT username, email FROM users WHERE id = $1', [req.user.id]);
    res.render('player/settings', { 
      username: req.user.username,
      user: result.rows[0],
      success: null,
      error: null
    });
  } catch (err) {
    console.error(err);
    res.redirect('/player/dashboard');
  }
});

// Update Player Settings
app.post('/player/settings', requireAuth("player"), async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE users SET username = $1, email = $2, password = $3 WHERE id = $4',
        [username, email, hashedPassword, req.user.id]
      );
    } else {
      await pool.query(
        'UPDATE users SET username = $1, email = $2 WHERE id = $3',
        [username, email, req.user.id]
      );
    }
    
    req.user.username = username;
    
    res.render('player/settings', { 
      username: username,
      user: { username, email },
      success: 'Settings updated successfully!',
      error: null
    });
  } catch (err) {
    console.error(err);
    const userResult = await pool.query('SELECT username, email FROM users WHERE id = $1', [req.user.id]);
    res.render('player/settings', { 
      username: req.user.username,
      user: userResult.rows[0],
      success: null,
      error: 'Failed to update settings'
    });
  }
});

// ADMIN ROUTES

// Admin Dashboard
app.get('/admin/dashboard', requireAuth("admin"), async (req, res) => {
  try {
    const totalPlayers = await pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['player']);
    const totalGames = await pool.query('SELECT COUNT(*) FROM game_history');
    
    res.render('admin/dashboard', { 
      username: req.user.username,
      stats: {
        players: totalPlayers.rows[0].count,
        games: totalGames.rows[0].count,
        questions: getQuestionsCount()
      }
    });
  } catch (err) {
    console.error(err);
    res.render('admin/dashboard', { 
      username: req.user.username,
      stats: { players: 0, games: 0, questions: getQuestionsCount() }
    });
  }
});

// Admin Reports
app.get('/admin/reports', requireAuth("admin"), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.username, gh.score, gh.time_used, gh.played_at 
      FROM game_history gh
      JOIN users u ON gh.user_id = u.id
      ORDER BY gh.played_at DESC
      LIMIT 100
    `);
    
    res.render('admin/reports', { 
      username: req.user.username,
      reports: result.rows
    });
  } catch (err) {
    console.error(err);
    res.render('admin/reports', { 
      username: req.user.username,
      reports: []
    });
  }
});

// Admin Questions Management
app.get('/admin/questions', requireAuth("admin"), (req, res) => {
  try {
    const questions = getAllQuestions();
    res.render('admin/questions', { 
      username: req.user.username,
      questions: questions,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error(err);
    res.render('admin/questions', { 
      username: req.user.username,
      questions: [],
      success: null,
      error: 'Error loading questions'
    });
  }
});

// หน้าเพิ่มคำถาม (GET)
app.get('/admin/questions/add', requireAuth("admin"), (req, res) => {
  res.render('admin/question', { username: req.user.username });
});

// เพิ่มคำถามใหม่
app.post('/admin/questions/add', requireAuth("admin"), (req, res) => {
  const { emojis, answer } = req.body;
  try {
    const questions = loadQuestions();
    const newId = questions.length > 0 ? Math.max(...questions.map(q => q.id)) + 1 : 1;
    questions.push({ id: newId, emojis, answer });
    saveQuestions(questions);
    res.redirect('/admin/questions?success=เพิ่มคำถามใหม่เรียบร้อยแล้ว');
    // res.render('/admin/questions' );
  } catch (err) {
    console.error(err);
    res.redirect('/admin/questions?error=ไม่สามารถเพิ่มคำถามได้');
  }
});

// แก้ไขคำถาม
app.post('/admin/questions/edit/:id', requireAuth("admin"), (req, res) => {
  const { id } = req.params;
  const { emojis, answer } = req.body;

  try {
    const questions = loadQuestions();
    const index = questions.findIndex(q => q.id === parseInt(id));
    if (index === -1) {
      return res.redirect('/admin/questions?error=ไม่พบคำถามที่ต้องการแก้ไข');
    }

    questions[index].emojis = emojis;
    questions[index].answer = answer;
    saveQuestions(questions);
    res.redirect('/admin/questions?success=แก้ไขคำถามเรียบร้อยแล้ว');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/questions?error=ไม่สามารถแก้ไขคำถามได้');
  }
});

// ลบคำถาม
app.post('/admin/questions/delete/:id', requireAuth("admin"), (req, res) => {
  const { id } = req.params;
  try {
    let questions = loadQuestions();
    questions = questions.filter(q => q.id !== parseInt(id));
    saveQuestions(questions);
    console.log("จุด 1");
    res.redirect('/admin/questions');
    // res.render('/admin/questions?success=ลบคำถามเรียบร้อยแล้ว');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/questions?error=ไม่สามารถลบคำถามได้');
  }
});


// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});