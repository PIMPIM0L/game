import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ ชี้ไปที่ไฟล์ questions.json ที่อยู่นอกโฟลเดอร์ database
const jsonPath = path.resolve(__dirname, 'questions.json');

// โหลดคำถามทั้งหมดจากไฟล์ JSON
export function loadQuestions() {
  try {
    const data = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('❌ Error loading questions:', err);
    return [];
  }
}

// บันทึกคำถามลงไฟล์ JSON
export function saveQuestions(questions) {
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(questions, null, 2), 'utf-8');
    console.log('✅ Questions saved successfully!');
  } catch (err) {
    console.error('❌ Error saving questions:', err);
  }
}

// ดึงคำถามแบบสุ่ม (จำนวนกำหนดได้)
export function getRandomQuestions(count = 10) {
  const questions = loadQuestions();
  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// ดึงคำถามทั้งหมด
export function getAllQuestions() {
  return loadQuestions();
}

// นับจำนวนคำถามทั้งหมด
export function getQuestionsCount() {
  return loadQuestions().length;
}
