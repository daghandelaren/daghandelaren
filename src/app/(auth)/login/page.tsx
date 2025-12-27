import { Suspense } from 'react';
import LoginForm from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Sign In - Daghandelaren',
  description: 'Sign in to your Daghandelaren account',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-text-secondary">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
