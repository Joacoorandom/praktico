export const storeConfig = {
  // Datos básicos de la tienda
  storeName: "Praktico",
  storeTagline: "Simplicidad a tu alcance",

  // Canales para recibir pedidos (manual)
  orderEmail: "info@praktico.shop",
  whatsappPhoneE164: "56967225944", // sin "+" y sin espacios. Ej: Chile +56 9 1234 5678 => 56912345678

  // Datos de transferencia (edítalos a tu gusto)
  bankTransfer: {
    bankName: "Banco De Chile",
    accountType: "Cuenta Vista",
    accountNumber: "123456789",
    rut: "23.858.874-K",
    accountHolder: "Joaquìn Silva",
    email: "info@praktico.shop",
    note: "En el asunto/comentario indica tu nombre y número de telefono"
  },

  // Pago en efectivo (solo válido para casos específicos)
  cashPayment: {
    enabled: true,
    allowedInstitutions: [
      "Scuola Italiana Vittorio Montiglio (Chile)",
      "Instituto de Humanidades Luis Campino (Chile)"
    ],
    note:
      "El pago en efectivo es válido solo para personas de la Scuola Italiana Vittorio Montiglio o del Instituto Luis Campino (Chile). El retiro se coordina en el colegio y se entrega al momento de recibir el dinero."
  },

  // Envíos (Starken)
  shipping: {
    enabled: true,
    originComuna: "Providencia" // Ajusta a la comuna donde se despacha/retira
  }
} as const;

