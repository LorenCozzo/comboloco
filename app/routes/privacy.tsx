import React from "react";

const h2Style: React.CSSProperties = { fontSize: 18, fontWeight: 600, marginTop: 32, marginBottom: 8 };
const pStyle: React.CSSProperties = { marginBottom: 12 };
const liStyle: React.CSSProperties = { marginBottom: 4 };
const dividerStyle: React.CSSProperties = { border: "none", borderTop: "1px solid #E5E7EB", margin: "48px 0" };

export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px", fontFamily: "sans-serif", color: "#111827", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 4 }}>Privacy Policy / Política de Privacidad</h1>
      <p style={{ color: "#6B7280", marginBottom: 40 }}>Last updated / Última actualización: June 2025</p>

      {/* ── ENGLISH ── */}
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#374151" }}>English</h2>

      <h2 style={h2Style}>1. Who we are</h2>
      <p style={pStyle}>ComboLoco ("we", "our", "us") is a Shopify app that provides automatic quantity break discounts for online stores. The app is operated at <strong>comboloco.vercel.app</strong>.</p>

      <h2 style={h2Style}>2. What data we collect</h2>
      <p style={pStyle}>We collect only the minimum data necessary to operate the app:</p>
      <ul>
        <li style={liStyle}><strong>Shop data:</strong> your Shopify store domain and access token, required to authenticate API calls.</li>
        <li style={liStyle}><strong>Bundle configuration:</strong> the discount tiers and widget settings you create within the app.</li>
      </ul>
      <p style={pStyle}>We do <strong>not</strong> collect, store, or process any personal data from your customers, including names, emails, addresses, or payment information.</p>

      <h2 style={h2Style}>3. How we use your data</h2>
      <p style={pStyle}>Data collected is used solely to:</p>
      <ul>
        <li style={liStyle}>Display and apply your configured discount bundles in your storefront.</li>
        <li style={liStyle}>Maintain your authenticated session with the Shopify Admin API.</li>
        <li style={liStyle}>Ensure the app functions correctly across page loads and sessions.</li>
      </ul>
      <p style={pStyle}>We do not sell, rent, share, or use your data for any advertising or marketing purposes.</p>

      <h2 style={h2Style}>4. Data retention</h2>
      <p style={pStyle}>Your data is retained for as long as the app is installed in your Shopify store. When you uninstall the app, all associated data — including sessions and bundle configurations — is automatically deleted within 48 hours via Shopify's mandatory webhooks.</p>

      <h2 style={h2Style}>5. Third-party services</h2>
      <p style={pStyle}>We rely on the following third-party infrastructure providers:</p>
      <ul>
        <li style={liStyle}><strong>Shopify:</strong> authentication and API access — <a href="https://www.shopify.com/legal/privacy" target="_blank" rel="noreferrer">shopify.com/legal/privacy</a></li>
        <li style={liStyle}><strong>Vercel:</strong> app hosting and edge network — <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">vercel.com/legal/privacy-policy</a></li>
        <li style={liStyle}><strong>Supabase:</strong> database storage — <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">supabase.com/privacy</a></li>
      </ul>
      <p style={pStyle}>These providers process data on our behalf and are bound by their own privacy policies and data processing agreements.</p>

      <h2 style={h2Style}>6. GDPR &amp; Privacy compliance</h2>
      <p style={pStyle}>We handle all mandatory Shopify privacy webhooks:</p>
      <ul>
        <li style={liStyle}><strong>Customer data request (customers/data_request):</strong> we do not store any personal customer data, so no data export is available.</li>
        <li style={liStyle}><strong>Customer data erasure (customers/redact):</strong> we do not store any personal customer data, so no action is required.</li>
        <li style={liStyle}><strong>Shop data erasure (shop/redact):</strong> all shop data is permanently deleted within 48 hours of receiving this request.</li>
      </ul>

      <h2 style={h2Style}>7. Security</h2>
      <p style={pStyle}>All data is transmitted over HTTPS. Access tokens are stored securely and never exposed to the storefront. We follow Shopify's security guidelines for embedded app development.</p>

      <h2 style={h2Style}>8. Changes to this policy</h2>
      <p style={pStyle}>We may update this Privacy Policy from time to time. The date at the top of this page will reflect the most recent update. Continued use of the app after changes constitutes acceptance of the updated policy.</p>

      <h2 style={h2Style}>9. Contact</h2>
      <p style={pStyle}>For any questions or privacy-related requests, contact us at: <a href="mailto:lorenzoccv@gmail.com">lorenzoccv@gmail.com</a></p>

      <hr style={dividerStyle} />

      {/* ── ESPAÑOL ── */}
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: "#374151" }}>Español</h2>

      <h2 style={h2Style}>1. Quiénes somos</h2>
      <p style={pStyle}>ComboLoco ("nosotros") es una aplicación de Shopify que provee descuentos automáticos por cantidad para tiendas en línea. La app opera en <strong>comboloco.vercel.app</strong>.</p>

      <h2 style={h2Style}>2. Qué datos recopilamos</h2>
      <p style={pStyle}>Recopilamos únicamente los datos mínimos necesarios para operar la app:</p>
      <ul>
        <li style={liStyle}><strong>Datos de la tienda:</strong> el dominio de tu tienda Shopify y el token de acceso, necesarios para autenticar las llamadas a la API.</li>
        <li style={liStyle}><strong>Configuración de bundles:</strong> los tiers de descuento y ajustes del widget que creás dentro de la app.</li>
      </ul>
      <p style={pStyle}>No recopilamos, almacenamos ni procesamos ningún dato personal de tus clientes, incluyendo nombres, emails, direcciones ni información de pago.</p>

      <h2 style={h2Style}>3. Cómo usamos tus datos</h2>
      <p style={pStyle}>Los datos recopilados se utilizan exclusivamente para:</p>
      <ul>
        <li style={liStyle}>Mostrar y aplicar los bundles de descuento configurados en tu storefront.</li>
        <li style={liStyle}>Mantener tu sesión autenticada con la API de Shopify.</li>
        <li style={liStyle}>Garantizar el funcionamiento correcto de la app entre cargas de página y sesiones.</li>
      </ul>
      <p style={pStyle}>No vendemos, alquilamos, compartimos ni usamos tus datos con fines publicitarios o de marketing.</p>

      <h2 style={h2Style}>4. Retención de datos</h2>
      <p style={pStyle}>Tus datos se conservan mientras la app esté instalada en tu tienda. Al desinstalar la app, todos los datos asociados — sesiones y configuraciones de bundles — se eliminan automáticamente dentro de las 48 horas siguientes mediante los webhooks obligatorios de Shopify.</p>

      <h2 style={h2Style}>5. Servicios de terceros</h2>
      <p style={pStyle}>Utilizamos los siguientes proveedores de infraestructura:</p>
      <ul>
        <li style={liStyle}><strong>Shopify:</strong> autenticación y acceso a la API — <a href="https://www.shopify.com/legal/privacy" target="_blank" rel="noreferrer">shopify.com/legal/privacy</a></li>
        <li style={liStyle}><strong>Vercel:</strong> hosting y red edge — <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">vercel.com/legal/privacy-policy</a></li>
        <li style={liStyle}><strong>Supabase:</strong> almacenamiento de base de datos — <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">supabase.com/privacy</a></li>
      </ul>
      <p style={pStyle}>Estos proveedores procesan datos en nuestro nombre y están sujetos a sus propias políticas de privacidad.</p>

      <h2 style={h2Style}>6. Cumplimiento GDPR y privacidad</h2>
      <p style={pStyle}>Gestionamos todos los webhooks de privacidad obligatorios de Shopify:</p>
      <ul>
        <li style={liStyle}><strong>Solicitud de datos del cliente (customers/data_request):</strong> no almacenamos datos personales de clientes, por lo que no hay datos a exportar.</li>
        <li style={liStyle}><strong>Eliminación de datos del cliente (customers/redact):</strong> no almacenamos datos personales de clientes, por lo que no se requiere acción.</li>
        <li style={liStyle}><strong>Eliminación de datos de la tienda (shop/redact):</strong> todos los datos de la tienda se eliminan permanentemente dentro de las 48 horas de recibir esta solicitud.</li>
      </ul>

      <h2 style={h2Style}>7. Seguridad</h2>
      <p style={pStyle}>Todos los datos se transmiten mediante HTTPS. Los tokens de acceso se almacenan de forma segura y nunca se exponen al storefront. Seguimos las guías de seguridad de Shopify para desarrollo de apps embebidas.</p>

      <h2 style={h2Style}>8. Cambios en esta política</h2>
      <p style={pStyle}>Podemos actualizar esta Política de Privacidad ocasionalmente. La fecha al inicio de esta página reflejará la última actualización. El uso continuado de la app después de los cambios implica la aceptación de la política actualizada.</p>

      <h2 style={h2Style}>9. Contacto</h2>
      <p style={pStyle}>Para consultas o solicitudes relacionadas con privacidad, contactanos en: <a href="mailto:lorenzoccv@gmail.com">lorenzoccv@gmail.com</a></p>
    </div>
  );
}
