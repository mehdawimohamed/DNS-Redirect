'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginInput } from '@/schemas/auth';
import { Loader2, Eye, EyeOff, ChevronDown, Lock, ShieldAlert, Info, HelpCircle, UserX, KeyRound, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Language, languages } from '@/lib/i18n/translations';

export interface GoogleLoginFormProps {
  /** Reserved for future multi-mode support; currently unused but accepted to satisfy page callers. */
  initialMode?: 'login' | 'register';
}

export default function GoogleLoginForm(_props: GoogleLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, setLang, t, dir } = useLanguage();

  const [step, setStep] = useState<'email' | 'password'>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  // FAS parameters passed from openNDS captive portal
  const gatewaySession = searchParams.get('tok') || searchParams.get('gateway_session') || 'mock-tok-123';
  const gatewayId = searchParams.get('gateway_id') || 'gateway_001';

  // Dynamically extract Wi-Fi SSID / Network Name sent by Router / OpenNDS / Gateway
  const extractWifiName = (): string => {
    const paramKeys = ['wifi_name', 'ssid', 'gateway_name', 'gatewayname', 'gw_name', 'nasid', 'ap_name', 'wifi', 'network'];
    for (const key of paramKeys) {
      const val = searchParams.get(key);
      if (val && val.trim() !== '') {
        try {
          return decodeURIComponent(val).replace(/[_+]/g, ' ').trim();
        } catch {
          return val.replace(/[_+]/g, ' ').trim();
        }
      }
    }
    return 'Guest Wi-Fi';
  };

  const wifiName = extractWifiName();

  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleEmailNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const isValid = await loginForm.trigger('email');
    if (isValid) {
      setStep('password');
    }
  };

  const onLoginSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setServerError(null);

    const promise = async () => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Unable to connect. Please try again.');
      }

      const authRes = await fetch('/api/wifi/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatewayId,
          gatewaySessionToken: gatewaySession,
          durationMinutes: 240,
        }),
      });

      const authResult = await authRes.json();

      if (authResult.redirectUrl) {
        window.location.href = authResult.redirectUrl;
      } else {
        router.push('/wifi/success');
      }
      return authResult;
    };

    toast.promise(promise(), {
      loading: 'Activating Wi-Fi access...',
      success: 'Sign in successful! Connecting to Internet...',
      error: (err) => {
        setIsLoading(false);
        setServerError(err.message);
        return err.message;
      },
    });
  };

  // Toast handler for disabled features (Create Account, Forgot Password / Email)
  const handleDisabledFeature = (feature: 'CreateAccount' | 'ForgotPassword' | 'ForgotEmail') => {
    if (feature === 'CreateAccount') {
      toast(t.registrationDisabledTitle, {
        description: t.registrationDisabledDesc,
        icon: <UserX className="w-4 h-4 text-[#a8c7fa]" />,
        duration: 4500,
      });
    } else if (feature === 'ForgotPassword' || feature === 'ForgotEmail') {
      toast(t.recoveryDisabledTitle, {
        description: t.recoveryDisabledDesc,
        icon: <KeyRound className="w-4 h-4 text-[#a8c7fa]" />,
        duration: 4500,
      });
    }
  };

  // Toast handler for protected navigation links and Guest Mode
  const handleProtectedNavigation = (pageName: string) => {
    if (pageName === 'Guest') {
      toast(t.guestUnavailableTitle, {
        description: t.guestUnavailableDesc,
        icon: <Info className="w-4 h-4 text-[#a8c7fa]" />,
        duration: 4500,
      });
      return;
    }

    let description = '';
    let icon = <Lock className="w-4 h-4 text-[#a8c7fa]" />;

    if (pageName === 'Help') {
      description = t.protectedHelpDesc;
      icon = <HelpCircle className="w-4 h-4 text-[#a8c7fa]" />;
    } else if (pageName === 'Privacy') {
      description = t.protectedPrivacyDesc;
      icon = <Lock className="w-4 h-4 text-[#a8c7fa]" />;
    } else if (pageName === 'Terms') {
      description = t.protectedTermsDesc;
      icon = <ShieldAlert className="w-4 h-4 text-[#a8c7fa]" />;
    }

    toast(t.protectedNavTitle(pageName), {
      description,
      icon,
      duration: 4000,
    });
  };

  return (
    <div className="min-h-screen bg-[#131314] flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 font-sans text-[#e3e3e3] selection:bg-[#a8c7fa]/30">
      {/* Centered Main Wrapper */}
      <div className="w-full max-w-[1040px] flex-1 flex flex-col justify-center my-auto py-6">
        
        {/* Google Modern 2-Column Dark Card */}
        <div className="bg-[#0e0e0e] sm:bg-[#1e1e1e] rounded-[28px] p-8 sm:p-9 lg:p-12 w-full transition-all duration-300 min-h-[420px] flex flex-col justify-between">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start">
            
            {/* Left Column: Branding, Title & Subtitle */}
            <div className={`flex flex-col items-start justify-start ${dir === 'rtl' ? 'text-right' : 'text-left'} space-y-4`}>
              {/* Google 4-Color G SVG Logo */}
              <svg className="w-[28px] h-[28px] sm:w-[32px] sm:h-[32px]" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>

              <h1 className="text-[32px] sm:text-[36px] font-normal leading-tight tracking-normal text-[#e3e3e3]">
                {t.signInTitle}
              </h1>
              <p className="text-base text-[#c4c7c5] font-normal">
                {t.continueTo} <span className="text-[#e3e3e3] font-medium">{t.wifiAccess}</span>
              </p>

              {/* Network Access Control Banner */}
              <div className="mt-2 p-3.5 rounded-xl bg-[#282a2d] border border-[#444746] flex items-start space-x-3 text-left w-full">
                <ShieldAlert className="w-5 h-5 text-[#a8c7fa] shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs sm:text-sm">
                  <p className="font-medium text-[#e3e3e3]">{t.networkAccessTitle}</p>
                  <p className="text-[#c4c7c5] leading-relaxed">
                    {t.networkAccessDesc(wifiName)}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Form Controls */}
            <div className="flex flex-col justify-between w-full space-y-6">
              
              {/* Server Error Alert */}
              {serverError && (
                <div className="p-3 rounded-lg bg-[#3c1718] border border-[#8c2a2c] text-[#f2b8b5] text-sm font-medium">
                  {serverError}
                </div>
              )}

              <form onSubmit={step === 'email' ? handleEmailNext : loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                
                {/* Step 1: Email or Phone */}
                {step === 'email' && (
                  <div className="space-y-3">
                    <div className="relative group">
                      <input
                        type="text"
                        id="email"
                        inputMode="email"
                        autoFocus
                        {...loginForm.register('email')}
                        className={`w-full h-[56px] px-4 pt-4 pb-1 text-base text-[#e3e3e3] bg-transparent border border-[#8e918f] rounded-[4px] outline-none focus:border-[#a8c7fa] focus:ring-1 focus:ring-[#a8c7fa] peer transition-all duration-150 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                        placeholder=" "
                      />
                      <label
                        htmlFor="email"
                        className={`absolute ${dir === 'rtl' ? 'right-3 origin-top-right' : 'left-3 origin-top-left'} top-4 text-base text-[#c4c7c5] pointer-events-none transition-all duration-150 transform -translate-y-3 scale-75 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-[#a8c7fa] bg-[#0e0e0e] sm:bg-[#1e1e1e] px-1`}
                      >
                        {t.emailLabel}
                      </label>
                    </div>
                    {loginForm.formState.errors.email && (
                      <p className="text-xs text-[#f2b8b5] px-1">{loginForm.formState.errors.email.message}</p>
                    )}

                    <div className={`${dir === 'rtl' ? 'text-right' : 'text-left'} pt-1`}>
                      <button
                        type="button"
                        onClick={() => handleDisabledFeature('ForgotEmail')}
                        className="text-sm font-medium text-[#a8c7fa] hover:underline focus:outline-none"
                      >
                        {t.forgotEmail}
                      </button>
                    </div>

                    <p className="text-xs text-[#c4c7c5] pt-6 leading-relaxed">
                      {t.guestModeNotice}{' '}
                      <button
                        type="button"
                        onClick={() => handleProtectedNavigation('Guest')}
                        className="text-[#a8c7fa] hover:underline font-medium inline-block"
                      >
                        {t.learnMoreGuest}
                      </button>
                    </p>
                  </div>
                )}

                {/* Step 2: Password */}
                {step === 'password' && (
                  <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
                    <div className="flex items-center gap-2 p-1.5 px-3 rounded-full border border-[#444746] w-fit">
                      <span className="text-sm text-[#e3e3e3] font-medium">{loginForm.getValues('email')}</span>
                      <button
                        type="button"
                        onClick={() => setStep('email')}
                        className="text-xs text-[#a8c7fa] font-medium hover:underline ml-1"
                      >
                        {t.changeEmail}
                      </button>
                    </div>

                    <div className="relative group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        autoFocus
                        {...loginForm.register('password')}
                        className={`w-full h-[56px] px-4 pt-4 pb-1 ${dir === 'rtl' ? 'pl-12 pr-4 text-right' : 'pr-12 pl-4 text-left'} text-base text-[#e3e3e3] bg-transparent border border-[#8e918f] rounded-[4px] outline-none focus:border-[#a8c7fa] focus:ring-1 focus:ring-[#a8c7fa] peer transition-all duration-150`}
                        placeholder=" "
                      />
                      <label
                        htmlFor="password"
                        className={`absolute ${dir === 'rtl' ? 'right-3 origin-top-right' : 'left-3 origin-top-left'} top-4 text-base text-[#c4c7c5] pointer-events-none transition-all duration-150 transform -translate-y-3 scale-75 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-[#a8c7fa] bg-[#0e0e0e] sm:bg-[#1e1e1e] px-1`}
                      >
                        {t.passwordLabel}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute ${dir === 'rtl' ? 'left-3' : 'right-3'} top-4 text-[#c4c7c5] hover:text-[#e3e3e3] p-1`}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-xs text-[#f2b8b5] px-1">{loginForm.formState.errors.password.message}</p>
                    )}

                    <div className={`${dir === 'rtl' ? 'text-right' : 'text-left'} pt-1`}>
                      <button
                        type="button"
                        onClick={() => handleDisabledFeature('ForgotPassword')}
                        className="text-sm font-medium text-[#a8c7fa] hover:underline focus:outline-none"
                      >
                        {t.forgotPassword}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-8">
                  <button
                    type="button"
                    onClick={() => handleDisabledFeature('CreateAccount')}
                    className="text-sm font-medium text-[#a8c7fa] hover:bg-[#a8c7fa]/10 px-4 py-2 rounded-full transition-colors"
                  >
                    {t.createAccount}
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-[#a8c7fa] hover:bg-[#c2e7ff] active:bg-[#8ab4f8] text-[#040e17] font-medium text-sm px-6 h-10 rounded-full transition-all duration-150 flex items-center justify-center min-w-[90px] disabled:opacity-70"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-[#040e17]" /> : step === 'email' ? t.nextButton : t.signInButton}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      </div>

      {/* Footer matching screenshot with Language Selector */}
      <footer className="w-full max-w-[1040px] flex flex-row items-center justify-between text-xs text-[#c4c7c5] py-4 px-2 font-normal relative">
        
        {/* Language Selector Dropdown Container */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
            className="flex items-center gap-2 hover:bg-white/5 px-3 py-2 rounded transition-colors text-[#c4c7c5] hover:text-[#e3e3e3] focus:outline-none"
          >
            <span>{languages[lang].name}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-[#c4c7c5] transition-transform duration-200 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Language Options Popover Menu */}
          {isLangMenuOpen && (
            <div className={`absolute bottom-full mb-2 ${dir === 'rtl' ? 'right-0' : 'left-0'} bg-[#282a2c] border border-[#444746] rounded-xl shadow-xl py-1.5 min-w-[200px] z-50 animate-in fade-in zoom-in-95 duration-150`}>
              {(Object.keys(languages) as Language[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setLang(key);
                    setIsLangMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-xs text-left hover:bg-white/10 transition-colors ${lang === key ? 'text-[#a8c7fa] font-medium bg-white/5' : 'text-[#e3e3e3]'}`}
                >
                  <span>{languages[key].name}</span>
                  {lang === key && <Check className="w-3.5 h-3.5 text-[#a8c7fa]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Nav Links */}
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => handleProtectedNavigation('Help')}
            className="hover:bg-white/5 px-2 py-1 rounded transition-colors text-[#c4c7c5] hover:text-[#e3e3e3]"
          >
            {t.help}
          </button>
          <button
            type="button"
            onClick={() => handleProtectedNavigation('Privacy')}
            className="hover:bg-white/5 px-2 py-1 rounded transition-colors text-[#c4c7c5] hover:text-[#e3e3e3]"
          >
            {t.privacy}
          </button>
          <button
            type="button"
            onClick={() => handleProtectedNavigation('Terms')}
            className="hover:bg-white/5 px-2 py-1 rounded transition-colors text-[#c4c7c5] hover:text-[#e3e3e3]"
          >
            {t.terms}
          </button>
        </div>
      </footer>
    </div>
  );
}
