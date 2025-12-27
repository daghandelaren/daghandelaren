import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import HomepageLogin from '@/components/auth/HomepageLogin';
import AccessRequestForm from '@/components/auth/AccessRequestForm';

export default async function HomePage() {
  // If already authenticated, redirect to dashboard
  const session = await getServerSession(authOptions);
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div className="bg-surface-primary border border-border-primary rounded-xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-accent-blue rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">D</span>
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Daghandelaren</h1>
            <p className="text-text-secondary text-sm mt-1">Forex Sentiment Dashboard</p>
          </div>

          {/* Login Form */}
          <HomepageLogin />

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-primary"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-surface-primary px-4 text-text-muted">Need access?</span>
            </div>
          </div>

          {/* Access Request Form */}
          <AccessRequestForm />
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-xs mt-6">
          Professional forex sentiment analysis tool
        </p>
      </div>
    </div>
  );
}
