export type Language = 'en' | 'fr' | 'ar';

export interface Translations {
  signInTitle: string;
  continueTo: string;
  wifiAccess: string;
  emailLabel: string;
  passwordLabel: string;
  forgotEmail: string;
  forgotPassword: string;
  guestModeNotice: string;
  learnMoreGuest: string;
  createAccount: string;
  nextButton: string;
  signInButton: string;
  changeEmail: string;
  help: string;
  privacy: string;
  terms: string;
  
  // Toast notifications
  registrationDisabledTitle: string;
  registrationDisabledDesc: string;
  recoveryDisabledTitle: string;
  recoveryDisabledDesc: string;
  protectedNavTitle: (name: string) => string;
  protectedHelpDesc: string;
  protectedPrivacyDesc: string;
  protectedTermsDesc: string;
  guestUnavailableTitle: string;
  guestUnavailableDesc: string;
  
  // Network Access Control Notice
  networkAccessTitle: string;
  networkAccessDesc: (wifiName: string) => string;

  // Success Page
  accessGranted: string;
  connectedTo: string;
  guestWifiAccess: string;
  sessionDuration: string;
  hoursAuthorized: string;
  activeStatus: string;
  closeWindowNotice: string;
  startBrowsing: string;
}

export const languages: Record<Language, { name: string; nativeName: string; dir: 'ltr' | 'rtl' }> = {
  en: { name: 'English (United States)', nativeName: 'English', dir: 'ltr' },
  fr: { name: 'Français (France)', nativeName: 'Français', dir: 'ltr' },
  ar: { name: 'العربية (تونس)', nativeName: 'العربية', dir: 'rtl' },
};

export const dictionaries: Record<Language, Translations> = {
  en: {
    signInTitle: 'Sign in',
    continueTo: 'to continue to',
    wifiAccess: 'Google',
    emailLabel: 'Email or phone',
    passwordLabel: 'Enter your password',
    forgotEmail: 'Forgot email?',
    forgotPassword: 'Forgot password?',
    guestModeNotice: 'Not your computer? Use Guest mode to sign in privately.',
    learnMoreGuest: 'Learn more about using Guest mode',
    createAccount: 'Create account',
    nextButton: 'Next',
    signInButton: 'Sign in',
    changeEmail: 'Change',
    help: 'Help',
    privacy: 'Privacy',
    terms: 'Terms',
    
    registrationDisabledTitle: 'Registration Disabled',
    registrationDisabledDesc: 'New account creation is disabled for this network. Please sign in with assigned Wi-Fi credentials or contact the network administrator.',
    recoveryDisabledTitle: 'Account Recovery Disabled',
    recoveryDisabledDesc: 'Self-service password reset is disabled for Wi-Fi access. Please contact the network administrator for assistance.',
    protectedNavTitle: (name) => `Sign in required for ${name}`,
    protectedHelpDesc: 'Sign in first to access the Google Help Center.',
    protectedPrivacyDesc: 'Sign in first to review Privacy & Data protection policies.',
    protectedTermsDesc: 'Sign in first to view the Terms of Service.',
    guestUnavailableTitle: 'Guest Mode Unavailable',
    guestUnavailableDesc: 'Guest mode is not available for the moment.',

    networkAccessTitle: 'Network Access Control',
    networkAccessDesc: (wifiName) => `As a security measure for ${wifiName}, user authentication is required before internet access is granted.`,
    
    accessGranted: 'Wi-Fi Access Granted',
    connectedTo: 'You are now authorized and connected to',
    guestWifiAccess: 'Guest Wi-Fi Access',
    sessionDuration: 'Session Duration',
    hoursAuthorized: '4 Hours Authorized',
    activeStatus: 'Active',
    closeWindowNotice: 'You can close this window and start browsing the Internet normally.',
    startBrowsing: 'Start Browsing',
  },
  
  fr: {
    signInTitle: 'Se connecter',
    continueTo: 'pour continuer vers',
    wifiAccess: 'Google',
    emailLabel: 'E-mail ou téléphone',
    passwordLabel: 'Saisissez votre mot de passe',
    forgotEmail: 'Adresse e-mail oubliée ?',
    forgotPassword: 'Mot de passe oublié ?',
    guestModeNotice: "Ce n'est pas votre ordinateur ? Utilisez le mode Invité pour vous connecter en privé.",
    learnMoreGuest: "En savoir plus sur l'utilisation du mode Invité",
    createAccount: 'Créer un compte',
    nextButton: 'Suivant',
    signInButton: 'Se connecter',
    changeEmail: 'Modifier',
    help: 'Aide',
    privacy: 'Confidentialité',
    terms: 'Conditions',
    
    registrationDisabledTitle: 'Inscription désactivée',
    registrationDisabledDesc: "La création de nouveau compte est désactivée pour ce réseau. Veuillez vous connecter avec vos identifiants ou contacter l'administrateur.",
    recoveryDisabledTitle: 'Récupération désactivée',
    recoveryDisabledDesc: "La réinitialisation du mot de passe est désactivée. Veuillez contacter l'administrateur du réseau.",
    protectedNavTitle: (name) => `Connexion requise pour ${name}`,
    protectedHelpDesc: "Connectez-vous d'abord pour accéder au centre d'aide.",
    protectedPrivacyDesc: "Connectez-vous d'abord pour consulter les règles de confidentialité.",
    protectedTermsDesc: "Connectez-vous d'abord pour lire les conditions d'utilisation.",
    guestUnavailableTitle: 'Mode Invité non disponible',
    guestUnavailableDesc: "Le mode Invité n'est pas disponible pour le moment.",

    networkAccessTitle: "Contrôle d'accès réseau",
    networkAccessDesc: (wifiName) => `Par mesure de sécurité pour ${wifiName}, une authentification utilisateur est requise avant d'accéder à Internet.`,
    
    accessGranted: 'Accès Wi-Fi accordé',
    connectedTo: 'Vous êtes maintenant autorisé et connecté à',
    guestWifiAccess: 'Accès Wi-Fi Invité',
    sessionDuration: 'Durée de la session',
    hoursAuthorized: '4 Heures Autorisées',
    activeStatus: 'Actif',
    closeWindowNotice: 'Vous pouvez fermer cette fenêtre et naviguer normalement sur Internet.',
    startBrowsing: 'Démarrer la navigation',
  },
  
  ar: {
    signInTitle: 'تسجيل الدخول',
    continueTo: 'للمتابعة إلى',
    wifiAccess: 'Google',
    emailLabel: 'البريد الإلكتروني أو الهاتف',
    passwordLabel: 'أدخل كلمة المرور',
    forgotEmail: 'هل نسيت البريد الإلكتروني؟',
    forgotPassword: 'هل نسيت كلمة المرور؟',
    guestModeNotice: 'هل هذا ليس جهازك؟ استخدم وضع الضيف لتسجيل الدخول بشكل خاص.',
    learnMoreGuest: 'مزيد من المعلومات حول استخدام وضع الضيف',
    createAccount: 'إنشاء حساب',
    nextButton: 'التالي',
    signInButton: 'تسجيل الدخول',
    changeEmail: 'تغيير',
    help: 'مساعدة',
    privacy: 'الخصوصية',
    terms: 'البنود',
    
    registrationDisabledTitle: 'إنشاء الحسابات معطل',
    registrationDisabledDesc: 'إنشاء حساب جديد معطل على هذه الشبكة. يرجى تسجيل الدخول باستخدام بيانات الاعتماد المخصصة أو الاتصال بمسؤول الشبكة.',
    recoveryDisabledTitle: 'استعادة الحساب معطلة',
    recoveryDisabledDesc: 'إعادة تعيين كلمة المرور معطلة لوصول Wi-Fi. يرجى الاتصال بمسؤول الشبكة للمساعدة.',
    protectedNavTitle: (name) => `تسجيل الدخول مطلوب لـ ${name}`,
    protectedHelpDesc: 'يرجى تسجيل الدخول أولاً للوصول إلى مركز المساعدة.',
    protectedPrivacyDesc: 'يرجى تسجيل الدخول أولاً لمراجعة سياسات الخصوصية وحماية البيانات.',
    protectedTermsDesc: 'يرجى تسجيل الدخول أولاً لعرض شروط استخدام Wi-Fi.',
    guestUnavailableTitle: 'وضع الضيف غير متاح',
    guestUnavailableDesc: 'وضع الضيف غير متاح في الوقت الحالي.',

    networkAccessTitle: 'التحكم في الوصول إلى الشبكة',
    networkAccessDesc: (wifiName) => `كإجراء أمني لشبكة ${wifiName}، يلزم توثيق المستخدم قبل السماح بالوصول إلى الإنترنت.`,
    
    accessGranted: 'تم منح الوصول إلى Wi-Fi',
    connectedTo: 'أنت الآن مخول ومتصل بـ',
    guestWifiAccess: 'وصول Wi-Fi للضيوف',
    sessionDuration: 'مدة الجلسة',
    hoursAuthorized: '4 ساعات مخولة',
    activeStatus: 'نشط',
    closeWindowNotice: 'يمكنك إغلاق هذه النافذة والبدء في تصفح الإنترنت بشكل طبيعي.',
    startBrowsing: 'بدء التصفح',
  },
};
