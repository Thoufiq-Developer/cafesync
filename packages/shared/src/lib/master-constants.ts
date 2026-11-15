// Master Platform Seed Catalog & Configuration

export interface SeedItem {
  name: string;
  category: string;
}

export interface SeedConfig {
  paymentModes: string[];
  expenseItems: SeedItem[];
  incomeItems: SeedItem[];
}

export const DEFAULT_SEED_CONFIG: SeedConfig = {
  paymentModes: ['CASH', 'GPAY', 'BANK', 'CARD'],
  expenseItems: [
    { name: 'Milk', category: 'Dairy' },
    { name: 'Egg', category: 'Poultry' },
    { name: 'Bread', category: 'Bakery' },
    { name: 'Gas', category: 'Utilities' },
    { name: 'Provision', category: 'Groceries' },
    { name: 'Chicken', category: 'Poultry' },
    { name: 'Water', category: 'Kitchen' },
    { name: 'Ice', category: 'Kitchen' },
    { name: 'Snacks', category: 'General' },
    { name: 'Petrol', category: 'Transport' },
    { name: 'Salary Advance', category: 'Payroll' },
  ],
  incomeItems: [
    { name: 'Billing', category: 'Sales' },
    { name: 'Zomato', category: 'Online' },
    { name: 'Swiggy', category: 'Online' },
    { name: 'Bulk Order', category: 'Events' },
  ],
};

