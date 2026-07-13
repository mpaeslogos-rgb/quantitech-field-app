// Sinaliza um login real (evento SIGNED_IN do Supabase) entre App.tsx e
// Home.tsx, para distinguir de refresh de token/retomada de foco de aba —
// só um login de verdade deve contar para a política de troca de senha
// a cada 30 acessos.
let pendingLoginEvent = false;

export function markLoginEvent() {
  pendingLoginEvent = true;
}

export function consumeLoginEvent(): boolean {
  const value = pendingLoginEvent;
  pendingLoginEvent = false;
  return value;
}
