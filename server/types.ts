export interface PlaidAccountInfo {
  accountId: string;
  name: string;
  mask: string;
  type: string;
  subtype: string;
}

export interface PlaidItem {
  itemId: string;
  accessToken: string; // never sent to browser
  institutionName: string;
  institutionId: string;
  accounts: PlaidAccountInfo[];
  connectedAt: string;
}

export interface PlaidTransactionRaw {
  plaidTransactionId: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive = debit (expense)
  plaidCategory: string;
  plaidCategoryDetailed?: string;
  accountId: string;
  institutionName: string;
  isPayment: boolean;
}
