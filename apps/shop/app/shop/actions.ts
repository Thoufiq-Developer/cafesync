import {
  addDailyTransaction,
  updateDailyTransaction,
  deleteDailyTransaction,
  restoreDailyTransaction,
  saveShopItem,
  toggleShopItemStatus,
  updateDaysWorked,
  recordSalaryTransaction,
  logAssetService,
} from '@/lib/api/shop';

export const addDailyTransactionAction = addDailyTransaction;
export const updateDailyTransactionAction = updateDailyTransaction;
export const deleteDailyTransactionAction = deleteDailyTransaction;
export const restoreDailyTransactionAction = restoreDailyTransaction;
export const saveShopItemAction = saveShopItem;
export const toggleShopItemStatusAction = toggleShopItemStatus;
export const updateDaysWorkedAction = updateDaysWorked;
export const recordSalaryTransactionAction = recordSalaryTransaction;
export const logAssetServiceAction = logAssetService;
