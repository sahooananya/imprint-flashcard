/**
 * Contextual motivational messages
 * Subtle, not cringe, not generic
 */

const messages = {
  start: [
    "Cards don't memorize themselves.",
    "Your future self will thank you.",
    "Let's see what sticks today.",
    "One session at a time.",
    "The best time to review is now.",
  ],
  struggling: [
    "Hard cards = brain growth. Keep going.",
    "Struggle is the learning. Don't skip it.",
    "This one's fighting back. Good.",
    "The cards you hate are the ones you need.",
    "Difficulty now, fluency later.",
  ],
  doing_well: [
    "You're in the zone.",
    "This deck is starting to stick.",
    "Solid recall. Keep the streak alive.",
    "Your brain is doing the work.",
    "Almost there — don't stop now.",
  ],
  almost_done: [
    "Last few cards. Finish strong.",
    "Almost mastered. One more push.",
    "This deck is nearly yours.",
    "So close. Don't quit on the last mile.",
  ],
  streak: [
    "Consistency beats intensity. Always.",
    "Showing up daily is the real skill.",
    "The streak is a signal. Keep it.",
  ],
  test_mode: [
    "Test mode: no hints, just recall.",
    "Simulate the real thing.",
    "You know more than you think.",
    "Pressure reveals what practice built.",
  ],
  mcq: [
    "Don't guess — reason it out.",
    "Elimination is a skill too.",
    "Wrong answers teach more than right ones.",
  ],
};

export function getMotivation(context = 'start', accuracy = 100, remaining = 0) {
  let pool;
  if (remaining <= 3) pool = messages.almost_done;
  else if (context === 'struggling' || accuracy < 50) pool = messages.struggling;
  else if (context === 'doing_well' || accuracy >= 75) pool = messages.doing_well;
  else if (context === 'test_mode') pool = messages.test_mode;
  else if (context === 'mcq') pool = messages.mcq;
  else if (context === 'streak') pool = messages.streak;
  else pool = messages.start;

  return pool[Math.floor(Math.random() * pool.length)];
}
