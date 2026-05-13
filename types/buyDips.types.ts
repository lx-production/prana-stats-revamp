export type BuyDipsJson = {
  total_volume_in_usd?: number;
  total_prana_bought?: number;
  total_buy_transactions?: number;
};

export type BuyDipsData = BuyDipsJson & {
  isLoading: boolean;
  error: string | null;
};
