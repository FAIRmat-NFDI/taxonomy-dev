export type SignInMode = 'signIn' | 'signUp';

interface SignInCopy {
  title: string;
  subtitle: string;
  /** Prefix for provider buttons: "<prefix> GitHub", "<prefix> Helmholtz ID". */
  providerPrefix: string;
  passwordSubmit: string;
  /** Optional hint under the email + password form. */
  passwordHint?: string;
  switchPrompt: string;
  switchAction: string;
}

/** All dialog text per mode (American English, per the FAIRmat guideline §5.1). */
export const signInCopy: Record<SignInMode, SignInCopy> = {
  signIn: {
    title: 'Sign in',
    subtitle: 'Welcome back! Sign in to comment on and edit the taxonomy.',
    providerPrefix: 'Sign in with',
    passwordSubmit: 'Sign in',
    switchPrompt: "Don't have an account?",
    switchAction: 'Register',
  },
  signUp: {
    title: 'Create account',
    subtitle: 'Use GitHub or your institution login, or create an account with your email.',
    providerPrefix: 'Continue with',
    passwordSubmit: 'Create account',
    passwordHint: 'At least 8 characters. You are signed in right away.',
    switchPrompt: 'Already have an account?',
    switchAction: 'Login',
  },
};

export const GITHUB_SIGNUP_URL = 'https://github.com/signup';
