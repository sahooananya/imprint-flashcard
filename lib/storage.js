/**
 * Storage helpers — all data lives in localStorage under 'fe_decks'
 * Structure: { [deckId]: { id, title, createdAt, cards: [...] } }
 */

const KEY = 'fe_decks';

export function getAllDecks() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function getDeck(id) {
  return getAllDecks()[id] || null;
}

export function saveDeck(deck) {
  const all = getAllDecks();
  all[deck.id] = deck;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteDeck(id) {
  const all = getAllDecks();
  delete all[id];
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function updateCard(deckId, cardId, updates) {
  const deck = getDeck(deckId);
  if (!deck) return;
  deck.cards = deck.cards.map((c) =>
    c.id === cardId ? { ...c, ...updates } : c
  );
  saveDeck(deck);
  return deck;
}
