export const storeConfig = {
  // Datos básicos de la tienda
  storeName: "Praktico",
  storeTagline: "Simplicidad a tu alcance",

  // Canales para recibir pedidos (manual)
  orderEmail: "info@praktico.shop",
  whatsappPhoneE164: "56967225944", // sin "+" y sin espacios. Ej: Chile +56 9 1234 5678 => 56912345678

  // Datos de transferencia
  bankTransfer: {
    bankName: "Banco de Chile",
    accountType: "Cuenta vista",
    accountNumber: "00-029-15260-33",
    rut: "23.858.874-k",
    accountHolder: "Joaquin Silva",
    email: "joaco@joacoorandom.site",
    note: "En el asunto/comentario indica tu nombre y número de teléfono."
  },

  // Pago en efectivo (solo válido para colegios)
  cashPayment: {
    enabled: true,
    allowedInstitutions: ["Instituto de Humanidades Luis Campino (IHLC)"],
    note:
      "El pago en efectivo es válido solo para colegios. El retiro se coordina en el establecimiento y se entrega al momento de recibir el dinero."
  },

  // Envíos (ChileExpress)
  shipping: {
    enabled: true,
    originComuna: "Providencia"
  }
} as const;

