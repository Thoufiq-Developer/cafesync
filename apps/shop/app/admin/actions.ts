'use server';

interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function saveItemAction(..._args: any[]): Promise<ActionResult> {
  return { success: false, error: 'Not supported in shop app' };
}

export async function toggleItemStatusAction(..._args: any[]): Promise<ActionResult> {
  return { success: false, error: 'Not supported in shop app' };
}

export async function promoteItemBrandWideAction(..._args: any[]): Promise<ActionResult> {
  return { success: false, error: 'Not supported in shop app' };
}
