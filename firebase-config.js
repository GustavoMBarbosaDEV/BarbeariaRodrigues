// =====================================================================
//  CONFIGURAÇÃO DO FIREBASE — Barbearia Rodrigues
//  Enquanto estiver com "COLE_AQUI", o app abre em MODO DEMONSTRAÇÃO
//  (dados de exemplo guardados só no aparelho).
//  Veja o passo a passo em DESENVOLVIMENTO.md.
//  Estes valores NÃO são senha: vão para o navegador de todo mundo. Quem protege os dados são
//  as regras do Firestore (firestore.rules), a restrição da chave no Google Cloud e o App Check.
// =====================================================================
window.FIREBASE_CONFIG = {
  apiKey: "COLE_AQUI",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
// App Check (reCAPTCHA Enterprise): chave de site. Vazio = desligado.
window.APPCHECK_SITE_KEY = "";
// Avisos com o app fechado: chave pública de Web Push (Firebase → Configurações do projeto → Cloud Messaging
// → Certificados push da Web). Vazio = os avisos chegam só com o app aberto ou em segundo plano.
window.PUSH_VAPID_KEY = "";
