import { Suspense } from 'react';
import GoogleLoginForm from '@/components/auth/GoogleLoginForm';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f0f4f9] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0b57d0]" />
        </div>
      }
    >
      <GoogleLoginForm initialMode="login" />
    </Suspense>
  );
}
