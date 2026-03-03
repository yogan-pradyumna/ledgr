import * as pdfjsLib from 'pdfjs-dist';
import type { ParsedTransaction } from '../types';
import { CATEGORIES } from '../types';

// Use the bundled worker via a local URL so Vite serves it correctly
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string;

/** Extract all text from a PDF file, page by page. */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Preserve relative positioning by grouping items with Y-coordinate proximity
    const items = content.items
      .filter((item) => 'str' in item)
      .map((item) => ({ str: (item as { str: string }).str, y: (item as { transform: number[] }).transform[5] }));

    // Sort by Y descending (top of page first), then X ascending
    items.sort((a, b) => b.y - a.y || 0);
    pageTexts.push(items.map((i) => i.str).join(' '));
  }

  return pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
}

/** Call Claude to parse raw statement text into structured transactions. */
export async function parseWithClaude(text: string): Promise<ParsedTransaction[]> {
  const categoriesList = CATEGORIES.join(', ');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a bank statement parser. Extract all debit/expense transactions from the following bank statement text and return them as a JSON array.

Rules:
- Include ALL debit transactions (money going OUT). Skip credits, deposits, refunds, opening/closing balances, and summary rows.
- For credit card bill payments, credit card autopay, balance transfers, inter-account transfers, loan payments, "payment thank you", "payment received", or any transaction paying off a credit card or moving money between your own accounts — include them but set "isPayment": true.
- For all regular expenses, set "isPayment": false.
- Dates must be in YYYY-MM-DD format.
- Amounts must be positive numbers (no currency symbols, no commas).
- Descriptions should be clean merchant/payee names — strip reference numbers, codes, and noise.
- For category, pick the single best match from: ${categoriesList}. For payment/transfer rows, use "Other".
- If you cannot determine a field with confidence, make a reasonable guess.
- Return ONLY a valid JSON array, no explanation or markdown.

Merchant category hints (use these as guidance):
- Household: Amazon, Flipkart, Meesho, IKEA, Pepperfry, Urban Ladder, D-Mart, Big Bazaar, Reliance Smart, DMart, Target, Walmart, Costco, Home Depot, Lowe's, Bed Bath & Beyond, Wayfair, Williams-Sonoma, Crate & Barrel
- Food: Swiggy, Zomato, McDonald's, KFC, Domino's, Pizza Hut, Starbucks, Cafe Coffee Day, Subway, Burger King, Chipotle, Dunkin', Panera Bread, Chick-fil-A, Taco Bell, Wendy's, DoorDash, Grubhub, Uber Eats, Instacart
- Groceries: BigBasket, Blinkit, Zepto, Dunzo, JioMart, Spencer's, Nature's Basket, Whole Foods, Trader Joe's, Kroger, Safeway, Publix, Aldi, Sprouts, H-E-B, Wegmans
- Commute/Car: Uber, Ola, Rapido, Metro, BMTC, BEST, FastTag, petrol, fuel, parking, Lyft, EZPass, Shell, BP, Chevron, Exxon, Mobil, Circle K, QuikTrip, SunPass
- Travel: MakeMyTrip, Goibibo, Cleartrip, IndiGo, Air India, SpiceJet, Yatra, IRCTC, Airbnb, OYO, Delta, United, American Airlines, Southwest, JetBlue, Expedia, Booking.com, Hotels.com, Marriott, Hilton, Hyatt
- OTT/Streaming Fees: Netflix, Amazon Prime, Hotstar, Disney+, Spotify, Apple Music, YouTube Premium, JioCinema, SonyLIV, Hulu, HBO Max, Max, Peacock, Paramount+, Apple TV+, Tidal, Pandora
- Internet: Airtel broadband, ACT Fibernet, BSNL broadband, Hathway, JioFiber, Comcast, Xfinity, AT&T, Verizon Fios, Spectrum, Cox, CenturyLink, Google Fiber
- Mobile: Airtel recharge, Jio recharge, Vi recharge, BSNL recharge, Verizon, AT&T, T-Mobile, Mint Mobile, Cricket Wireless, Boost Mobile
- Health: Apollo, Practo, PharmEasy, Netmeds, 1mg, Cult.fit, MedPlus, CVS, Walgreens, Rite Aid, UnitedHealth, Cigna, Aetna, Blue Cross, Kaiser
- Entertainment: BookMyShow, PVR, INOX, Wonderla, AMC Theatres, Regal Cinemas, Cinemark, Live Nation, Ticketmaster, StubHub, Dave & Buster's
- Insurance: LIC, HDFC Life, ICICI Lombard, Star Health, Bajaj Allianz, Max Life, Geico, State Farm, Progressive, Allstate, Liberty Mutual, Farmers, USAA
- Self-development/Learning: Udemy, Coursera, Duolingo, Byju's, Unacademy, LinkedIn Learning, Skillshare, MasterClass, Pluralsight, Khan Academy, Codecademy
- Apparel: Myntra, Ajio, Zara, H&M, Uniqlo, Nike, Adidas, Gap, Old Navy, Banana Republic, Nordstrom, Macy's, TJ Maxx, Levi's, Forever 21, ASOS
- Sports: Decathlon, Nike, Adidas, Under Armour, REI, Dick's Sporting Goods, Planet Fitness, LA Fitness, Equinox, Peloton
- Gifts: Archies, Ferns N Petals, 1800Flowers, FTD, ProFlowers, Etsy, Hallmark

Example output format:
[
  {"date": "2024-01-15", "description": "Swiggy", "amount": 450.00, "category": "Food", "isPayment": false},
  {"date": "2024-01-16", "description": "Uber", "amount": 120.50, "category": "Commute/Car", "isPayment": false},
  {"date": "2024-01-17", "description": "Credit Card Autopay", "amount": 2500.00, "category": "Other", "isPayment": true}
]

Bank statement text:
${text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ?? `Claude API error ${response.status}`
    );
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const raw = data.content.find((b) => b.type === 'text')?.text ?? '[]';

  // Strip any accidental markdown fences
  const json = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();

  const parsed = JSON.parse(json) as Array<{
    date: string;
    description: string;
    amount: number;
    category: string;
    isPayment?: boolean;
  }>;

  return parsed.map((t) => ({
    date: t.date,
    description: t.description,
    amount: Math.abs(t.amount),
    category: CATEGORIES.includes(t.category as typeof CATEGORIES[number]) ? t.category : 'Other',
    isPayment: t.isPayment ?? false,
    selected: !(t.isPayment ?? false),
  }));
}

/** Main entry point: parse a PDF file into a list of transactions for review. */
export async function parsePDFStatement(file: File): Promise<ParsedTransaction[]> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY is not set. Add it to your .env.local file.');
  }

  const text = await extractTextFromPDF(file);
  return parseWithClaude(text);
}
