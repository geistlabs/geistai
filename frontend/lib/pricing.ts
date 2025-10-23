export interface PricePoint {
  price: number;
  description: string;
}

export const PRICE_POINTS: PricePoint[] = [
  {
    price: 20,
    description: 'Perfect for your usage level',
  },
  {
    price: 30,
    description: 'Great fit for your needs',
  },
  {
    price: 40,
    description: 'Ideal for your usage pattern',
  },
];

export interface NegotiationQuestion {
  id: string;
  question: string;
  options: { text: string; priceImpact: number }[]; // negative = lower price
}

export const NEGOTIATION_QUESTIONS: NegotiationQuestion[] = [
  {
    id: 'usage',
    question: 'How often do you plan to use Geist AI?',
    options: [
      { text: 'Occasionally (few times a week)', priceImpact: -10 },
      { text: 'Regularly (once a day)', priceImpact: 0 },
      { text: 'Frequently (multiple times daily)', priceImpact: 10 },
    ],
  },
  {
    id: 'budget',
    question: "What's your comfort level for a monthly AI assistant?",
    options: [
      { text: 'Under $25 preferred', priceImpact: -10 },
      { text: '$25-35 is reasonable', priceImpact: 0 },
      { text: '$35+ for premium quality', priceImpact: 10 },
    ],
  },
];

/**
 * Calculate recommended price based on answers
 */
export function calculateRecommendedPrice(
  answers: Record<string, number>,
): number {
  const basePrice = 30; // Start at recommended price point
  const totalImpact = Object.values(answers).reduce(
    (sum, impact) => sum + impact,
    0,
  );

  const calculatedPrice = Math.max(20, Math.min(40, basePrice + totalImpact));

  // Round to nearest available price point
  const availablePrices = PRICE_POINTS.map(p => p.price);
  const nearest = availablePrices.reduce((prev, curr) =>
    Math.abs(curr - calculatedPrice) < Math.abs(prev - calculatedPrice)
      ? curr
      : prev,
  );

  return nearest;
}

/**
 * Get price point info by price
 */
export function getPricePointByPrice(price: number): PricePoint | undefined {
  return PRICE_POINTS.find(p => p.price === price);
}
