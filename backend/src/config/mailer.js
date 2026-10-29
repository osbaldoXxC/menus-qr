const axios = require('axios');

/**
 * Función para enviar correos electrónicos con Resend
 * @param {string} to - Destinatario del correo
 * @param {string} subject - Asunto del correo
 * @param {string} htmlContent - Contenido en formato HTML
 * @returns {Promise<object>} - Respuesta de la API de Resend o Mock
 */
const enviarCorreoResend = async (to, subject, htmlContent) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('------------------------------------------------------------');
    console.warn(`[OTP MOCK] Correo para: ${to}`);
    console.warn(`[OTP MOCK] Asunto: ${subject}`);
    console.warn(`[OTP MOCK] Contenido HTML:\n${htmlContent}`);
    console.warn('------------------------------------------------------------');
    return { mock: true };
  }

  try {
    const response = await axios.post('https://api.resend.com/emails', {
      from: "MexxicanMX <soporte@oamdevsol.site>",
      to: [to],
      subject: subject,
      html: htmlContent
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error enviando correo con Resend:', error.response?.data || error.message);
    throw new Error('Error al enviar el correo electrónico de verificación.');
  }
};

module.exports = {
  enviarCorreoResend
};
