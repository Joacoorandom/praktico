export const storeConfig = {
  // Datos básicos de la tienda
  storeName: "Praktico",
  storeTagline: "Simplicidad a tu alcance",

  // Canales para recibir pedidos (manual)
  orderEmail: "info@praktico.shop",
  whatsappPhoneE164: "56968615377", // +56 9 6861 5377 - WhatsApp para abrir conversación con el pedido

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
    allowedInstitutions: ["Instituto de Humanidades Luis Campino"],
    note:
      "El pago en efectivo es válido solo para colegios. El retiro se coordina en el establecimiento y se entrega al momento de recibir el dinero."
  },

  // Envíos (ChileExpress)
  shipping: {
    enabled: true,
    originComuna: "Providencia"
  },

  /** Donaciones para apoyar la reapertura de PixelPlay */
  donations: {
    enabled: true,
    title: "¡Donanos para apoyar!",
    subtitle:
      "PixelPlay está en cierre temporal renovándose. Tu aporte ayuda a cubrir el hosting (~25 USD/mes) y a volver con una versión más sólida.",
    minAmount: 1000,
    gifts: [
      {
        id: "apoyo",
        label: "Apoyo",
        minAmount: 1000,
        reward: "Agradecimiento público en Discord + mención en el anuncio de reapertura."
      },
      {
        id: "impulsor",
        label: "Impulsor",
        minAmount: 3000,
        reward: "Todo lo de Apoyo + rol especial Impulsor en Discord al reabrir."
      },
      {
        id: "fundador",
        label: "Fundador",
        minAmount: 5000,
        reward: "Todo lo anterior + kit de bienvenida al reabrir el servidor."
      },
      {
        id: "patron",
        label: "Patrón",
        minAmount: 10000,
        reward: "Todo lo anterior + prioridad en ranks/eventos de la nueva temporada."
      }
    ]
  }
} as const;

