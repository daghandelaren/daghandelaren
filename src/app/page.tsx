import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import LoginPageContent from '@/components/auth/LoginPageContent';

export default async function HomePage() {
  // If already authenticated, redirect to dashboard
  const session = await getServerSession(authOptions);
  if (session) {
    redirect('/dashboard');
  }

  return <LoginPageContent />;
}
