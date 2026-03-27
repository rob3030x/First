# Cuentas por Pagar

Aplicación web para gestionar tus facturas y pagos pendientes.

## Configuración local

### Opción 1 — Abrir directamente

Abre `index.html` en tu navegador. No requiere instalación.

### Opción 2 — Servidor local (recomendado)

Requiere [Node.js](https://nodejs.org) instalado.

```bash
# Instalar dependencias (opcional, solo primera vez)
npm install

# Iniciar servidor
npm start
```

La app estará disponible en: http://localhost:3000

### Opción 3 — Python

```bash
# Python 3
python3 -m http.server 3000
```

## PIN de acceso

El PIN por defecto es **1234**.

## Funcionalidades

- Registro de cuentas por pagar con fecha de vencimiento
- Alertas visuales para cuentas vencidas y próximas
- Vista de calendario mensual
- Exportación a calendario (.ics) con alertas 3 días antes
- Soporte de monedas: MXN, CLP, USD, EUR
- Bloqueo por PIN
- Datos guardados en localStorage (sin servidor)
