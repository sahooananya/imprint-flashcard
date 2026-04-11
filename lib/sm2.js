/**
 * SM-2 Spaced Repetition Algorithm
 * Quality: 0=blackout, 2=again, 3=hard, 4=good, 5=easy
 */

export function sm2(card, quality) {
  let { repetitions = 0, easeFactor = 2.5, interval = 0 } = card;

  if (quality >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    repetitions,
    easeFactor: parseFloat(easeFactor.toFixed(2)),
    interval,
    nextReview: nextReview.toISOString(),
    lastReviewed: new Date().toISOString(),
  };
}

export function getDueCards(cards) {
  const now = new Date();
  return cards.filter((card) => {
    if (!card.nextReview) return true;
    return new Date(card.nextReview) <= now;
  });
}

export function getMastery(cards) {
  if (!cards.length) return 0;
  const mastered = cards.filter((c) => c.repetitions >= 3).length;
  return Math.round((mastered / cards.length) * 100);
}

export function getCardStatus(card) {
  if (!card.lastReviewed) return 'new';
  if (card.repetitions === 0) return 'struggling';
  if (card.repetitions < 3) return 'learning';
  return 'mastered';
}

export function getNextReviewText(card) {
  if (!card.nextReview) return 'Due now';
  const diff = Math.ceil((new Date(card.nextReview) - new Date()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Due now';
  if (diff === 1) return 'Tomorrow';
  return `In ${diff} days`;
}

export function getWeakTopics(cards) {
  const topicStats = {};
  cards.forEach((card) => {
    if (!card.lastReviewed) return;
    if (!topicStats[card.topic]) topicStats[card.topic] = { correct: 0, total: 0 };
    topicStats[card.topic].total += 1;
    if (card.repetitions > 0) topicStats[card.topic].correct += 1;
  });

  return Object.entries(topicStats)
    .filter(([, s]) => s.total >= 2)
    .map(([topic, s]) => ({
      topic,
      accuracy: Math.round((s.correct / s.total) * 100),
      total: s.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);
}

export function getStreak() {
  if (typeof window === 'undefined') return 0;
  const data = JSON.parse(localStorage.getItem('fe_streak') || '{"streak":0,"lastDate":""}');
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (data.lastDate === today) return data.streak;
  if (data.lastDate === yesterday) return data.streak;
  return 0;
}

export function updateStreak() {
  if (typeof window === 'undefined') return 0;
  const data = JSON.parse(localStorage.getItem('fe_streak') || '{"streak":0,"lastDate":""}');
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  let newStreak;
  if (data.lastDate === today) {
    newStreak = data.streak;
  } else if (data.lastDate === yesterday) {
    newStreak = data.streak + 1;
  } else {
    newStreak = 1;
  }

  localStorage.setItem('fe_streak', JSON.stringify({ streak: newStreak, lastDate: today }));
  return newStreak;
}
