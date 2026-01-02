/**
 * Phase 10: Feedback System
 * Lightweight feedback capture from users
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const FEEDBACK_DIR = path.join(os.homedir(), '.odavl-guardian', 'feedback');

/**
 * Ensure feedback directory exists
 */
function ensureFeedbackDir() {
  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  }
}

/**
 * Create readline interface for interactive prompts
 */
function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a question and get response
 */
function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Run interactive feedback session
 */
async function runFeedbackSession() {
  console.log('\n🙏 Thank you for taking time to share feedback!\n');
  console.log('This helps us improve Guardian for everyone.\n');
  
  const rl = createPrompt();
  const feedback = {
    timestamp: new Date().toISOString(),
    responses: {},
  };
  
  try {
    // Question 1: What worked?
    console.log('1️⃣  What worked well for you?');
    feedback.responses.whatWorked = await ask(rl, '   → ');
    console.log();
    
    // Question 2: What blocked you?
    console.log('2️⃣  What blocked you or was frustrating?');
    feedback.responses.whatBlocked = await ask(rl, '   → ');
    console.log();
    
    // Question 3: Would you recommend?
    console.log('3️⃣  Would you recommend Guardian to others? (yes/no)');
    const recommend = await ask(rl, '   → ');
    feedback.responses.wouldRecommend = recommend.toLowerCase().startsWith('y') ? 'yes' : 'no';
    console.log();
    
    // Optional: Email
    console.log('📧 (Optional) Share your email if you\'d like updates:');
    const email = await ask(rl, '   → ');
    if (email && email.includes('@')) {
      feedback.email = email;
    }
    
    rl.close();
    
    // Save feedback
    saveFeedback(feedback);
    
    console.log('\n✅ Feedback saved! Thank you for helping improve Guardian.\n');
    
    return feedback;
  } catch (error) {
    rl.close();
    throw error;
  }
}

/**
 * Save feedback to local file
 */
function saveFeedback(feedback) {
  ensureFeedbackDir();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `feedback-${timestamp}.json`;
  const filepath = path.join(FEEDBACK_DIR, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(feedback, null, 2), 'utf-8');
  
  return filepath;
}

/**
 * Get all feedback submissions
 */
function getAllFeedback() {
  ensureFeedbackDir();
  
  const files = fs.readdirSync(FEEDBACK_DIR)
    .filter(f => f.startsWith('feedback-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  return files.map(filename => {
    const filepath = path.join(FEEDBACK_DIR, filename);
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    } catch (_error) {
      return null;
    }
  }).filter(Boolean);
}

/**
 * Get feedback count
 */
function getFeedbackCount() {
  const feedback = getAllFeedback();
  return feedback.length;
}

/**
 * Clear all feedback (for testing)
 */
function clearFeedback() {
  if (fs.existsSync(FEEDBACK_DIR)) {
    const files = fs.readdirSync(FEEDBACK_DIR);
    files.forEach(file => {
      fs.unlinkSync(path.join(FEEDBACK_DIR, file));
    });
  }
}

module.exports = {
  runFeedbackSession,
  saveFeedback,
  getAllFeedback,
  getFeedbackCount,
  clearFeedback,
};
