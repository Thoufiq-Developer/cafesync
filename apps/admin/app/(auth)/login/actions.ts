import { loginWithCredentials } from '@/lib/api/auth';

export async function loginAction(prevState: any, formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const expectedBrandId = (formData.get('expectedBrandId') as string)?.trim() || undefined;

  const res = await loginWithCredentials(email, password, expectedBrandId);
  if (!res.success) {
    return { error: res.error || 'Authentication failed' };
  }
  return { success: true };
}

export async function signOutAction() {
  if (typeof window !== 'undefined') {
    window.location.href = '/login/';
  }
}
