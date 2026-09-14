'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  return (
    <div className="animate-slide-up">
      <div className="text-center mb-8">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 items-center justify-center mb-4 shadow-lg shadow-cyan-500/25">
          <span className="text-white font-bold text-2xl">J</span>
        </div>
        <h1 className="text-2xl font-bold text-white">
          Jornada<span className="text-cyan-400">360</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">Auditoria de Jornada</p>
      </div>

      <Card className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            placeholder="seu@email.com"
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
            Senha
          </label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-colors"
          />
        </div>
        <Button className="w-full" size="lg">
          Entrar
        </Button>
        <p className="text-center text-xs text-slate-500">
          Autenticação será implementada com Firebase Auth
        </p>
      </Card>
    </div>
  );
}
