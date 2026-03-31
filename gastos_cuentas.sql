-- ============================================
-- BASE DE DATOS: GESTIÓN DE GASTOS Y CUENTAS
-- ============================================

CREATE DATABASE IF NOT EXISTS gastos_cuentas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gastos_cuentas;

-- ----------------------
-- CATEGORÍAS DE GASTOS
-- ----------------------
CREATE TABLE categorias (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100)  NOT NULL,
  descripcion VARCHAR(255),
  color       VARCHAR(7)    DEFAULT '#CCCCCC',  -- HEX para UI
  creado_en   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------
-- CUENTAS / SERVICIOS
-- ----------------------
CREATE TABLE cuentas (
  id               INT            AUTO_INCREMENT PRIMARY KEY,
  nombre           VARCHAR(150)   NOT NULL,           -- Ej: "Arriendo", "Internet", "Luz"
  categoria_id     INT,
  monto_estimado   DECIMAL(10,2)  DEFAULT 0.00,       -- Monto habitual
  dia_vencimiento  TINYINT        CHECK (dia_vencimiento BETWEEN 1 AND 31),
  frecuencia       ENUM('mensual','bimestral','trimestral','anual') DEFAULT 'mensual',
  activa           BOOLEAN        DEFAULT TRUE,
  notas            TEXT,
  creado_en        TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
);

-- ----------------------
-- PAGOS REALIZADOS
-- ----------------------
CREATE TABLE pagos (
  id             INT            AUTO_INCREMENT PRIMARY KEY,
  cuenta_id      INT            NOT NULL,
  monto_pagado   DECIMAL(10,2)  NOT NULL,
  fecha_pago     DATE           NOT NULL,
  fecha_vence    DATE,                               -- Fecha límite del período
  metodo_pago    ENUM('efectivo','débito','crédito','transferencia','otro') DEFAULT 'transferencia',
  comprobante    VARCHAR(255),                       -- Número o referencia
  estado         ENUM('pagado','pendiente','vencido') DEFAULT 'pagado',
  notas          TEXT,
  creado_en      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE CASCADE
);

-- ----------------------
-- ÍNDICES ÚTILES
-- ----------------------
CREATE INDEX idx_pagos_fecha     ON pagos (fecha_pago);
CREATE INDEX idx_pagos_estado    ON pagos (estado);
CREATE INDEX idx_cuentas_activa  ON cuentas (activa);

-- ----------------------
-- VISTA: RESUMEN DE PAGOS
-- ----------------------
CREATE VIEW vista_pagos_resumen AS
SELECT
  p.id,
  c.nombre                          AS cuenta,
  cat.nombre                        AS categoria,
  p.monto_pagado,
  p.fecha_pago,
  p.fecha_vence,
  p.estado,
  p.metodo_pago
FROM pagos p
JOIN cuentas c    ON p.cuenta_id   = c.id
LEFT JOIN categorias cat ON c.categoria_id = cat.id
ORDER BY p.fecha_pago DESC;
