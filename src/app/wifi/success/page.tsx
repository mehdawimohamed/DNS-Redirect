'use client';

import React from 'react';
import { CheckCircle2, Wifi, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function WifiSuccessPage() {
  const { t, dir } = useLanguage();

  return (
    <div className="min-h-screen bg-[#131314] flex flex-col justify-between items-center p-4 sm:p-6 font-sans text-[#e3e3e3]" dir={dir}>
      <div className="w-full max-w-[450px] flex-1 flex flex-col justify-center my-auto">
        <div className="bg-[#1e1e1e] rounded-[28px] border border-[#3c4043] p-8 sm:p-10 shadow-sm w-full text-center space-y-6">
          
          <div className="w-16 h-16 bg-[#137333]/20 rounded-full flex items-center justify-center mx-auto text-[#81c995]">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-normal text-[#e3e3e3]">{t.accessGranted}</h1>
            <p className="text-sm text-[#c4c7c5]">
              {t.connectedTo} <span className="font-medium text-[#e3e3e3]">{t.guestWifiAccess}</span>.
            </p>
          </div>

          <div className="bg-[#0e0e0e] border border-[#444746] rounded-xl p-4 flex items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <Wifi className="w-5 h-5 text-[#a8c7fa]" />
              <div>
                <p className="text-xs text-[#9aa0a6]">{t.sessionDuration}</p>
                <p className="text-sm font-semibold text-[#e3e3e3]">{t.hoursAuthorized}</p>
              </div>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#137333]/30 text-[#81c995] border border-[#137333]/50">
              {t.activeStatus}
            </span>
          </div>

          <p className="text-xs text-[#9aa0a6] leading-relaxed">
            {t.closeWindowNotice}
          </p>

          <a
            href="https://www.google.com"
            className="w-full inline-flex items-center justify-center gap-2 bg-[#a8c7fa] hover:bg-[#c2e7ff] text-[#040e17] font-medium text-sm px-6 h-11 rounded-full transition-all duration-150"
          >
            <span>{t.startBrowsing}</span>
            <ArrowRight className={`w-4 h-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
          </a>
        </div>
      </div>

      <footer className="w-full max-w-[450px] text-center text-xs text-[#9aa0a6] py-4">
        {t.wifiAccess} Platform
      </footer>
    </div>
  );
}
