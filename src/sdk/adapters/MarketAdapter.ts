export interface Opportunity {
  question: string;
  buyOn: string;
  buyPrice: number;
  sellOn: string;
  sellPrice: number;
  gapPercent: number;
  estimatedProfit: number;
  category: string;
}

export interface Receipt {
  txHash: string;
  stealthAddress: string;
  settled: boolean;
  timestamp: string;
}

export interface MarketAdapter {
  name: string;
  scan(): Promise<Opportunity[]>;
  execute(opp: Opportunity, stealthAddress: string): Promise<Receipt>;
}
