import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // TODO: Replace with actual authentication logic
      // Simulating authentication for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use AuthContext login function
      const token = 'demo_token'; // Replace with actual token from API
      login(token);
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSSOLogin = (provider: 'google' | 'microsoft') => {
    setIsLoading(true);
    // TODO: Implement SSO authentication
    console.log(`SSO Login with ${provider}`);
    // For demo purposes, simulate successful login
    setTimeout(() => {
      const token = 'demo_sso_token'; // Replace with actual token from SSO provider
      login(token);
      navigate('/dashboard');
    }, 1000);
  };

  return (
    <div className="min-h-screen flex bg-[#F3F6F3]">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0F1110] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1BD183]/10 via-transparent to-transparent"></div>
        
        <div className="relative z-10 p-16 flex flex-col justify-between">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#1BD183] rounded-3xl flex items-center justify-center text-slate-900 font-black text-3xl shadow-2xl shadow-black/50">
              M
            </div>
            <div>
              <h1 className="font-black text-white tracking-tight text-3xl">MSAi®</h1>
              <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Educator Intelligence Suite</p>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-md">
            <h2 className="text-5xl font-black text-white mb-6 leading-tight">
              Transform Medical Education with AI
            </h2>
            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              Empower your institution with intelligent curriculum management, 
              real-time psychometrics, and AI-powered content authoring.
            </p>
            
            <div className="space-y-4 pt-8 border-t border-slate-800">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#1BD183]/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-3 h-3 rounded-full bg-[#1BD183]"></div>
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">USMLE Content Intelligence</h3>
                  <p className="text-sm text-slate-400">Fully mapped to official content outline</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#1BD183]/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-3 h-3 rounded-full bg-[#1BD183]"></div>
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">Real-Time Psychometrics</h3>
                  <p className="text-sm text-slate-400">Item-level analytics and quality assurance</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#1BD183]/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-3 h-3 rounded-full bg-[#1BD183]"></div>
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">AI Agent Fleet</h3>
                  <p className="text-sm text-slate-400">Automated content authoring and review</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-2xl">
            <div className="h-2 w-2 rounded-full bg-[#1BD183] animate-pulse"></div>
            <span className="text-xs font-black text-white uppercase tracking-widest">Sena: Online</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12 justify-center">
            <div className="w-12 h-12 bg-[#1BD183] rounded-2xl flex items-center justify-center text-slate-900 font-black text-2xl shadow-xl">
              M
            </div>
            <div>
              <h1 className="font-black text-slate-900 tracking-tight text-xl">MSAi®</h1>
              <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Educator Suite</p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-black text-slate-900 mb-3">Welcome Back</h2>
              <p className="text-slate-600 text-lg">Sign in to your educator account</p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600 font-medium">{error}</p>
              </div>
            )}

            {/* SSO Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => handleSSOLogin('google')}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <button
                onClick={() => handleSSOLogin('microsoft')}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M0 0h11v11H0z"/>
                  <path fill="#81bc06" d="M12 0h11v11H12z"/>
                  <path fill="#05a6f0" d="M0 12h11v11H0z"/>
                  <path fill="#ffba08" d="M12 12h11v11H12z"/>
                </svg>
                Continue with Microsoft
              </button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#F3F6F3] text-slate-500 font-bold">Or continue with email</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-slate-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="educator@institution.edu"
                  required
                  className="w-full px-5 py-4 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-[#1BD183] focus:ring-4 focus:ring-[#1BD183]/10 outline-none transition-all font-medium"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-bold text-slate-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-5 py-4 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:border-[#1BD183] focus:ring-4 focus:ring-[#1BD183]/10 outline-none transition-all font-medium"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-[#1BD183] focus:ring-[#1BD183]" />
                  <span className="text-sm text-slate-600 font-medium">Remember me</span>
                </label>
                <button type="button" className="text-sm text-[#1BD183] hover:text-[#15a36d] font-bold transition">
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-4 bg-gradient-to-r from-[#1bc697] to-[#1bb8b1] text-white font-black text-lg rounded-2xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#1BD183]/20 active:translate-y-1"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Footer Links */}
            <div className="text-center space-y-4 pt-6 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                Need access?{' '}
                <a href="#" className="text-[#1BD183] hover:text-[#15a36d] font-bold transition">
                  Contact your institution administrator
                </a>
              </p>
              <p className="text-xs text-slate-500">
                By signing in, you agree to our{' '}
                <a href="#" className="text-slate-700 hover:text-slate-900 font-semibold">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-slate-700 hover:text-slate-900 font-semibold">Privacy Policy</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
