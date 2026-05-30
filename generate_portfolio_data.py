import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

def generate_synthetic_portfolio(num_accounts=5000, months=12):
    print(f"Generating synthetic data for {num_accounts} accounts over {months} months...")
    
    products = ['Cashback', 'Travel Reward', 'Low APR', 'Student']
    product_probs = [0.4, 0.3, 0.2, 0.1]
    
    delinquency_states = ['Current', '1-29 DPD', '30-59 DPD', '60-89 DPD', '90+ DPD', 'Charge-off']
    
    start_date = pd.to_datetime('2023-01-01')
    
    # Generate account level static data
    accounts = pd.DataFrame({
        'account_id': range(100000, 100000 + num_accounts),
        'product': np.random.choice(products, num_accounts, p=product_probs),
        'tenure_months_base': np.random.randint(1, 120, num_accounts),
        'credit_limit': np.random.choice([1000, 2500, 5000, 10000, 15000, 25000], num_accounts, p=[0.1, 0.2, 0.3, 0.2, 0.15, 0.05])
    })
    
    records = []
    
    for month_offset in range(months):
        current_date = start_date + pd.DateOffset(months=month_offset)
        
        # Vectorized generation for the month
        month_records = accounts.copy()
        month_records['reporting_month'] = current_date.strftime('%Y-%m-01')
        month_records['tenure_months'] = month_records['tenure_months_base'] + month_offset
        
        # Spend behavior: ~70% of people spend in a given month
        active_spenders = np.random.choice([True, False], num_accounts, p=[0.7, 0.3])
        # Spend amount is a random lognormal, capped by credit limit
        raw_spend = np.random.lognormal(mean=5.0, sigma=1.5, size=num_accounts)
        month_records['spend'] = np.where(active_spenders, np.minimum(raw_spend, month_records['credit_limit'] * 0.8), 0).round(2)
        
        # Balance behavior: previous balance (simulated here) + spend - payment
        # For simplicity, we just generate a realistic balance based on utilization
        utilization = np.random.beta(a=2, b=5, size=num_accounts)
        month_records['balance'] = (month_records['credit_limit'] * utilization).round(2)
        
        # Revolve balance: portion of balance that isn't paid off
        # Say 50% of users are revolvers
        is_revolver = np.random.choice([True, False], num_accounts, p=[0.5, 0.5])
        revolve_pct = np.random.uniform(0.1, 0.9, num_accounts)
        month_records['revolve_balance'] = np.where(is_revolver, month_records['balance'] * revolve_pct, 0).round(2)
        
        # Delinquency: mostly current, some roll forward
        # Simplistic assignment for cross-sectional view
        month_records['delinquency_bucket'] = np.random.choice(
            delinquency_states, 
            num_accounts, 
            p=[0.85, 0.07, 0.04, 0.02, 0.015, 0.005]
        )
        
        # If charged-off or 90+, balance is typically high, spend is 0
        bad_mask = month_records['delinquency_bucket'].isin(['90+ DPD', 'Charge-off'])
        month_records.loc[bad_mask, 'spend'] = 0
        month_records.loc[bad_mask, 'balance'] = np.maximum(month_records.loc[bad_mask, 'balance'], month_records.loc[bad_mask, 'credit_limit'] * 0.9).round(2)
        month_records.loc[bad_mask, 'revolve_balance'] = month_records.loc[bad_mask, 'balance']
        
        records.append(month_records)
        
    final_df = pd.concat(records, ignore_index=True)
    
    # Drop the base tenure used for calculation
    final_df = final_df.drop(columns=['tenure_months_base'])
    
    # Reorder columns
    cols = ['reporting_month', 'account_id', 'product', 'tenure_months', 'credit_limit', 
            'spend', 'balance', 'revolve_balance', 'delinquency_bucket']
    final_df = final_df[cols]
    
    output_file = 'synthetic_credit_card_portfolio.csv'
    final_df.to_csv(output_file, index=False)
    print(f"Dataset successfully generated and saved to {output_file}")
    print(f"Total rows: {len(final_df)}")
    print("\nSample Data:")
    print(final_df.head())

if __name__ == "__main__":
    generate_synthetic_portfolio()
