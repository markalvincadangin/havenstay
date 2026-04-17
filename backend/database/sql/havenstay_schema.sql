-- ============================================================
-- HavenStay Boarding House Management System (BHMS)
-- Master Schema
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing objects for clean initialization
DROP TABLE IF EXISTS transaction_logs;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS billing_line_items;
DROP TABLE IF EXISTS billing;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS bed_spaces;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS tenants;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

DROP VIEW IF EXISTS vw_billing_summary;
DROP VIEW IF EXISTS vw_active_contracts;
DROP VIEW IF EXISTS vw_room_occupancy;
DROP VIEW IF EXISTS vw_occupancy_status;
DROP VIEW IF EXISTS vw_collections_summary;
DROP VIEW IF EXISTS vw_tenant_contract_history;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- 1. CORE ENTITIES
-- ------------------------------------------------------------

CREATE TABLE roles (
    role_id      INT AUTO_INCREMENT PRIMARY KEY,
    role_name    VARCHAR(50) NOT NULL,
    description  VARCHAR(255) NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_role_name (role_name)
) ENGINE=InnoDB;

CREATE TABLE users (
    user_id        INT AUTO_INCREMENT PRIMARY KEY,
    role_id        INT NOT NULL,
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    username       VARCHAR(100) NOT NULL,
    email          VARCHAR(150) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    is_active      TINYINT(1) DEFAULT 1,
    last_login_at  DATETIME NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at     DATETIME NULL,
    UNIQUE KEY uq_username (username),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (role_id),
    INDEX idx_user_role (role_id),
    INDEX idx_user_name (last_name, first_name)
) ENGINE=InnoDB;

CREATE TABLE tenants (
    tenant_id                  INT AUTO_INCREMENT PRIMARY KEY,
    first_name                 VARCHAR(100) NOT NULL,
    last_name                  VARCHAR(100) NOT NULL,
    contact_number             VARCHAR(20) NOT NULL,
    email                      VARCHAR(150) NOT NULL,
    emergency_contact_name     VARCHAR(200) NOT NULL,
    emergency_contact_number   VARCHAR(20) NOT NULL,
    address                    TEXT NOT NULL,
    status                     ENUM('active','moved_out','archived') DEFAULT 'active',
    created_at                 DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at                 DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at                 DATETIME NULL,
    INDEX idx_tenant_name (last_name, first_name),
    INDEX idx_tenant_status (status)
) ENGINE=InnoDB;

CREATE TABLE rooms (
    room_id            INT AUTO_INCREMENT PRIMARY KEY,
    room_code          VARCHAR(20) NOT NULL,
    room_type          ENUM('solo','shared') DEFAULT 'solo',
    capacity           INT DEFAULT 1,
    monthly_rate       DECIMAL(10,2) NOT NULL,
    status             ENUM('vacant','partially_occupied','fully_occupied','maintenance') DEFAULT 'vacant',
    amenities          TEXT NULL,
    description        TEXT NULL,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at         DATETIME NULL,
    UNIQUE KEY uq_room_code (room_code),
    CONSTRAINT chk_room_capacity CHECK (capacity >= 1),
    CONSTRAINT chk_room_rate CHECK (monthly_rate >= 0),
    INDEX idx_room_status (status)
) ENGINE=InnoDB;

CREATE TABLE bed_spaces (
    bed_space_id       INT AUTO_INCREMENT PRIMARY KEY,
    room_id            INT NOT NULL,
    bed_label          VARCHAR(20) NOT NULL,
    status             ENUM('vacant','occupied','maintenance') DEFAULT 'vacant',
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_bed_per_room (room_id, bed_label),
    CONSTRAINT fk_bed_room FOREIGN KEY (room_id) REFERENCES rooms (room_id) ON DELETE RESTRICT,
    INDEX idx_bed_status (room_id, status)
) ENGINE=InnoDB;

CREATE TABLE contracts (
    contract_id            INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id              INT NOT NULL,
    bed_space_id           INT NOT NULL,
    created_by             INT NOT NULL,
    move_in_date           DATE NOT NULL,
    expected_move_out_date DATE NULL,
    actual_move_out_date   DATE NULL,
    deposit_amount         DECIMAL(10,2) DEFAULT 0.00,
    monthly_rate_override  DECIMAL(10,2) NULL,
    status                 ENUM('active','completed','terminated') DEFAULT 'active',
    notes                  TEXT NULL,
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at             DATETIME NULL,
    CONSTRAINT fk_contract_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (tenant_id) ON DELETE RESTRICT,
    CONSTRAINT fk_contract_bed FOREIGN KEY (bed_space_id) REFERENCES bed_spaces (bed_space_id) ON DELETE RESTRICT,
    CONSTRAINT fk_contract_owner FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE RESTRICT,
    CONSTRAINT chk_contract_rate_override CHECK (monthly_rate_override IS NULL OR monthly_rate_override >= 0),
    CONSTRAINT chk_contract_deposit CHECK (deposit_amount >= 0),
    INDEX idx_contract_tenant (tenant_id, status),
    INDEX idx_contract_bed (bed_space_id, status),
    INDEX idx_contract_owner (created_by)
) ENGINE=InnoDB;

CREATE TABLE billing (
    billing_id          INT AUTO_INCREMENT PRIMARY KEY,
    contract_id         INT NOT NULL,
    billing_period_from DATE NOT NULL,
    billing_period_to   DATE NOT NULL,
    due_date            DATE NOT NULL,
    status              ENUM('unpaid','partial','paid','overdue') DEFAULT 'unpaid',
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_billing_cycle (contract_id, billing_period_from, billing_period_to),
    CONSTRAINT fk_billing_contract FOREIGN KEY (contract_id) REFERENCES contracts (contract_id),
    INDEX idx_billing_status (contract_id, status),
    INDEX idx_billing_due (due_date)
) ENGINE=InnoDB;

CREATE TABLE billing_line_items (
    billing_line_item_id INT AUTO_INCREMENT PRIMARY KEY,
    billing_id           INT NOT NULL,
    item_type            ENUM('base_rent','utility','add_on','penalty','adjustment') NOT NULL,
    item_description     VARCHAR(255) NOT NULL,
    amount               DECIMAL(10,2) NOT NULL,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_line_billing FOREIGN KEY (billing_id) REFERENCES billing (billing_id),
    CONSTRAINT chk_line_amount CHECK (amount <> 0),
    INDEX idx_line_billing (billing_id)
) ENGINE=InnoDB;

CREATE TABLE payments (
    payment_id          INT AUTO_INCREMENT PRIMARY KEY,
    billing_id          INT NOT NULL,
    processed_by        INT NOT NULL,
    amount_paid         DECIMAL(10,2) NOT NULL,
    payment_date        DATE NOT NULL,
    payment_method      ENUM('cash','gcash','bank_transfer','other') DEFAULT 'cash',
    reference_number    VARCHAR(100) NULL,
    remarks             TEXT NULL,
    voided_at           DATETIME NULL,
    voided_by           INT NULL,
    void_reason         VARCHAR(255) NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_billing FOREIGN KEY (billing_id) REFERENCES billing (billing_id),
    CONSTRAINT fk_payment_actor FOREIGN KEY (processed_by) REFERENCES users (user_id),
    CONSTRAINT fk_payment_voider FOREIGN KEY (voided_by) REFERENCES users (user_id),
    CONSTRAINT chk_payment_amount CHECK (amount_paid > 0),
    INDEX idx_payment_date (billing_id, payment_date)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. FORENSIC INFRASTRUCTURE
-- ------------------------------------------------------------

CREATE TABLE audit_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    action          VARCHAR(32) NOT NULL,
    target_table    VARCHAR(64) NOT NULL,
    record_id       BIGINT UNSIGNED NOT NULL,
    old_value       JSON NULL,
    new_value       JSON NULL,
    changed_by      INT NULL,
    correlation_id  VARCHAR(64) NULL,
    changed_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_actor FOREIGN KEY (changed_by) REFERENCES users (user_id) ON DELETE SET NULL,
    INDEX idx_audit_target (target_table, record_id),
    INDEX idx_audit_time (changed_at),
    INDEX idx_audit_correlation (correlation_id)
) ENGINE=InnoDB;

CREATE TABLE transaction_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    action          VARCHAR(64) NOT NULL,
    txn_reference   VARCHAR(100) NOT NULL,
    status          ENUM('started','committed','rolled_back','failed') DEFAULT 'started',
    initiated_by     INT NULL,
    details         JSON NULL,
    error_message   TEXT NULL,
    correlation_id  VARCHAR(64) NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_txn_actor FOREIGN KEY (initiated_by) REFERENCES users (user_id) ON DELETE SET NULL,
    INDEX idx_txn_status (status, created_at),
    INDEX idx_txn_ref (txn_reference),
    INDEX idx_txn_correlation (correlation_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. REFERENCE DATA
-- ------------------------------------------------------------

INSERT INTO roles (role_id, role_name, description) VALUES
(1, 'admin', 'System Administrator with full access'),
(2, 'staff', 'Property Manager with operational access'),
(3, 'viewer', 'Read-only access for reporting and audit review');

-- Default Administrator (Password: 'HavenStay123!')
INSERT INTO users (user_id, role_id, first_name, last_name, username, email, password_hash) VALUES
(1, 1, 'System', 'Admin', 'admin', 'admin@havenstay.local', '$2y$12$V.vR9pW5zEq.6vD.JvR7v.XvXvXvXvXvXvXvXvXvXvXvXvXvXvXvX');

-- ------------------------------------------------------------
-- 4. REPORTING VIEWS
-- ------------------------------------------------------------

CREATE VIEW vw_billing_summary AS
SELECT 
    b.billing_id,
    b.billing_period_from,
    b.billing_period_to,
    b.due_date,
    b.status AS billing_status,
    c.contract_id,
    t.tenant_id,
    CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
    t.email,
    r.room_id,
    r.room_code,
    bs.bed_space_id,
    bs.bed_label,
    COALESCE((SELECT SUM(amount) FROM billing_line_items WHERE billing_id = b.billing_id), 0.00) AS total_amount,
    COALESCE((SELECT SUM(amount_paid) FROM payments WHERE billing_id = b.billing_id AND voided_at IS NULL), 0.00) AS total_paid
FROM billing b
INNER JOIN contracts c ON b.contract_id = c.contract_id
INNER JOIN tenants t ON c.tenant_id = t.tenant_id
INNER JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
INNER JOIN rooms r ON bs.room_id = r.room_id;

CREATE VIEW vw_active_contracts AS
SELECT 
    c.contract_id,
    c.move_in_date,
    t.tenant_id,
    CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
    t.contact_number,
    t.email,
    r.room_id,
    r.room_code,
    COALESCE(c.monthly_rate_override, r.monthly_rate) as monthly_rate,
    bs.bed_space_id,
    bs.bed_label,
    bs.status AS bed_status,
    c.deposit_amount
FROM contracts c
INNER JOIN tenants t ON c.tenant_id = t.tenant_id
INNER JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
INNER JOIN rooms r ON bs.room_id = r.room_id
WHERE c.status = 'active' AND c.deleted_at IS NULL;

CREATE VIEW vw_room_occupancy AS
SELECT 
    r.room_id,
    r.room_code,
    r.room_type,
    r.monthly_rate,
    r.status AS room_status,
    r.capacity,
    COUNT(bs.bed_space_id) AS total_beds,
    SUM(CASE WHEN bs.status = 'occupied' THEN 1 ELSE 0 END) AS occupied_beds,
    SUM(CASE WHEN bs.status = 'vacant' AND r.status IN ('vacant','partially_occupied') AND r.deleted_at IS NULL THEN 1 ELSE 0 END) AS vacant_beds
FROM rooms r
LEFT JOIN bed_spaces bs ON r.room_id = bs.room_id
WHERE r.deleted_at IS NULL
GROUP BY r.room_id, r.room_code, r.room_type, r.monthly_rate, r.status, r.capacity;

CREATE VIEW vw_occupancy_status AS
SELECT 
    bs.bed_space_id,
    bs.bed_label,
    bs.status AS bed_status,
    r.room_id,
    r.room_code,
    t.tenant_id,
    CONCAT(t.last_name, ', ', t.first_name) as tenant_name,
    c.contract_id
FROM bed_spaces bs
INNER JOIN rooms r ON bs.room_id = r.room_id
LEFT JOIN contracts c ON bs.bed_space_id = c.bed_space_id AND c.status = 'active' AND c.deleted_at IS NULL
LEFT JOIN tenants t ON c.tenant_id = t.tenant_id;

CREATE VIEW vw_collections_summary AS
SELECT 
    p.payment_id,
    p.payment_date,
    p.amount_paid,
    p.payment_method,
    p.reference_number,
    t.tenant_id,
    CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
    b.billing_id,
    r.room_code
FROM payments p
INNER JOIN billing b ON p.billing_id = b.billing_id
INNER JOIN contracts c ON b.contract_id = c.contract_id
INNER JOIN tenants t ON c.tenant_id = t.tenant_id
INNER JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
INNER JOIN rooms r ON bs.room_id = r.room_id
WHERE p.voided_at IS NULL;

CREATE VIEW vw_tenant_contract_history AS
SELECT
    c.contract_id,
    c.tenant_id,
    CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
    t.email,
    c.move_in_date,
    c.expected_move_out_date,
    c.actual_move_out_date,
    c.status AS contract_status,
    r.room_code,
    bs.bed_label
FROM contracts c
INNER JOIN tenants t ON c.tenant_id = t.tenant_id
INNER JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
INNER JOIN rooms r ON bs.room_id = r.room_id;

-- ------------------------------------------------------------
-- 5. FORENSIC TRIGGERS (CCR-008)
-- ------------------------------------------------------------

-- Users
CREATE TRIGGER trg_users_ai AFTER INSERT ON users FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, new_value, changed_by, correlation_id)
    VALUES ('INSERT', 'users', NEW.user_id, JSON_OBJECT('username', NEW.username, 'role_id', NEW.role_id, 'email', NEW.email, 'first_name', NEW.first_name, 'last_name', NEW.last_name, 'is_active', NEW.is_active), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_users_au AFTER UPDATE ON users FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, new_value, changed_by, correlation_id)
    VALUES ('UPDATE', 'users', NEW.user_id, 
            JSON_OBJECT('username', OLD.username, 'role_id', OLD.role_id, 'email', OLD.email, 'first_name', OLD.first_name, 'last_name', OLD.last_name, 'is_active', OLD.is_active, 'deleted_at', OLD.deleted_at),
            JSON_OBJECT('username', NEW.username, 'role_id', NEW.role_id, 'email', NEW.email, 'first_name', NEW.first_name, 'last_name', NEW.last_name, 'is_active', NEW.is_active, 'deleted_at', NEW.deleted_at), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_users_ad AFTER DELETE ON users FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, changed_by, correlation_id)
    VALUES ('DELETE', 'users', OLD.user_id, JSON_OBJECT('username', OLD.username, 'email', OLD.email), @current_user_id, @current_correlation_id);
END;

-- Tenants
CREATE TRIGGER trg_tenants_ai AFTER INSERT ON tenants FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, new_value, changed_by, correlation_id)
    VALUES ('INSERT', 'tenants', NEW.tenant_id, JSON_OBJECT('first_name', NEW.first_name, 'last_name', NEW.last_name, 'email', NEW.email, 'contact_number', NEW.contact_number, 'status', NEW.status), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_tenants_au AFTER UPDATE ON tenants FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, new_value, changed_by, correlation_id)
    VALUES ('UPDATE', 'tenants', NEW.tenant_id, 
            JSON_OBJECT('first_name', OLD.first_name, 'last_name', OLD.last_name, 'status', OLD.status, 'email', OLD.email, 'contact_number', OLD.contact_number, 'deleted_at', OLD.deleted_at), 
            JSON_OBJECT('first_name', NEW.first_name, 'last_name', NEW.last_name, 'status', NEW.status, 'email', NEW.email, 'contact_number', NEW.contact_number, 'deleted_at', NEW.deleted_at), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_tenants_ad AFTER DELETE ON tenants FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, changed_by, correlation_id)
    VALUES ('DELETE', 'tenants', OLD.tenant_id, JSON_OBJECT('last_name', OLD.last_name, 'email', OLD.email), @current_user_id, @current_correlation_id);
END;

-- Rooms
CREATE TRIGGER trg_rooms_ai AFTER INSERT ON rooms FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, new_value, changed_by, correlation_id)
    VALUES ('INSERT', 'rooms', NEW.room_id, JSON_OBJECT('room_code', NEW.room_code, 'status', NEW.status, 'monthly_rate', NEW.monthly_rate), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_rooms_au AFTER UPDATE ON rooms FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, new_value, changed_by, correlation_id)
    VALUES ('UPDATE', 'rooms', NEW.room_id, 
            JSON_OBJECT('status', OLD.status, 'room_code', OLD.room_code, 'monthly_rate', OLD.monthly_rate, 'capacity', OLD.capacity, 'deleted_at', OLD.deleted_at), 
            JSON_OBJECT('status', NEW.status, 'room_code', NEW.room_code, 'monthly_rate', NEW.monthly_rate, 'capacity', NEW.capacity, 'deleted_at', NEW.deleted_at), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_rooms_ad AFTER DELETE ON rooms FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, changed_by, correlation_id)
    VALUES ('DELETE', 'rooms', OLD.room_id, JSON_OBJECT('room_code', OLD.room_code), @current_user_id, @current_correlation_id);
END;

-- Bed Spaces
CREATE TRIGGER trg_bed_spaces_ai AFTER INSERT ON bed_spaces FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, new_value, changed_by, correlation_id)
    VALUES ('INSERT', 'bed_spaces', NEW.bed_space_id, JSON_OBJECT('bed_label', NEW.bed_label, 'status', NEW.status), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_bed_spaces_au AFTER UPDATE ON bed_spaces FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, new_value, changed_by, correlation_id)
    VALUES ('UPDATE', 'bed_spaces', NEW.bed_space_id, JSON_OBJECT('status', OLD.status), JSON_OBJECT('status', NEW.status), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_bed_spaces_ad AFTER DELETE ON bed_spaces FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, changed_by, correlation_id)
    VALUES ('DELETE', 'bed_spaces', OLD.bed_space_id, JSON_OBJECT('bed_label', OLD.bed_label), @current_user_id, @current_correlation_id);
END;

-- Contracts
CREATE TRIGGER trg_contracts_ai AFTER INSERT ON contracts FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, new_value, changed_by, correlation_id)
    VALUES ('INSERT', 'contracts', NEW.contract_id, JSON_OBJECT('tenant_id', NEW.tenant_id, 'bed_space_id', NEW.bed_space_id, 'status', NEW.status), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_contracts_au AFTER UPDATE ON contracts FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, new_value, changed_by, correlation_id)
    VALUES ('UPDATE', 'contracts', NEW.contract_id, 
            JSON_OBJECT('status', OLD.status, 'actual_move_out_date', OLD.actual_move_out_date, 'deleted_at', OLD.deleted_at), 
            JSON_OBJECT('status', NEW.status, 'actual_move_out_date', NEW.actual_move_out_date, 'deleted_at', NEW.deleted_at), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_contracts_ad AFTER DELETE ON contracts FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, changed_by, correlation_id)
    VALUES ('DELETE', 'contracts', OLD.contract_id, JSON_OBJECT('tenant_id', OLD.tenant_id, 'bed_space_id', OLD.bed_space_id), @current_user_id, @current_correlation_id);
END;

-- Billing
CREATE TRIGGER trg_billing_ai AFTER INSERT ON billing FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, new_value, changed_by, correlation_id)
    VALUES ('INSERT', 'billing', NEW.billing_id, JSON_OBJECT('contract_id', NEW.contract_id, 'status', NEW.status, 'due_date', NEW.due_date), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_billing_au AFTER UPDATE ON billing FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, new_value, changed_by, correlation_id)
    VALUES ('UPDATE', 'billing', NEW.billing_id, 
            JSON_OBJECT('status', OLD.status, 'due_date', OLD.due_date), 
            JSON_OBJECT('status', NEW.status, 'due_date', NEW.due_date), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_billing_ad AFTER DELETE ON billing FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, changed_by, correlation_id)
    VALUES ('DELETE', 'billing', OLD.billing_id, JSON_OBJECT('contract_id', OLD.contract_id), @current_user_id, @current_correlation_id);
END;

-- Billing Line Items
CREATE TRIGGER trg_billing_line_items_ai AFTER INSERT ON billing_line_items FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, new_value, changed_by, correlation_id)
    VALUES ('INSERT', 'billing_line_items', NEW.billing_line_item_id, JSON_OBJECT('billing_id', NEW.billing_id, 'item_type', NEW.item_type, 'amount', NEW.amount), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_billing_line_items_au AFTER UPDATE ON billing_line_items FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, new_value, changed_by, correlation_id)
    VALUES ('UPDATE', 'billing_line_items', NEW.billing_line_item_id, 
            JSON_OBJECT('amount', OLD.amount, 'item_type', OLD.item_type), 
            JSON_OBJECT('amount', NEW.amount, 'item_type', NEW.item_type), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_billing_line_items_ad AFTER DELETE ON billing_line_items FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, changed_by, correlation_id)
    VALUES ('DELETE', 'billing_line_items', OLD.billing_line_item_id, JSON_OBJECT('billing_id', OLD.billing_id, 'amount', OLD.amount), @current_user_id, @current_correlation_id);
END;

-- Payments
CREATE TRIGGER trg_payments_ai AFTER INSERT ON payments FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, new_value, changed_by, correlation_id)
    VALUES ('INSERT', 'payments', NEW.payment_id, JSON_OBJECT('billing_id', NEW.billing_id, 'amount_paid', NEW.amount_paid, 'reference_number', NEW.reference_number), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_payments_au AFTER UPDATE ON payments FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, new_value, changed_by, correlation_id)
    VALUES ('UPDATE', 'payments', NEW.payment_id, 
            JSON_OBJECT('voided_at', OLD.voided_at, 'void_reason', OLD.void_reason), 
            JSON_OBJECT('voided_at', NEW.voided_at, 'void_reason', NEW.void_reason), @current_user_id, @current_correlation_id);
END;

CREATE TRIGGER trg_payments_ad AFTER DELETE ON payments FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (action, target_table, record_id, old_value, changed_by, correlation_id)
    VALUES ('DELETE', 'payments', OLD.payment_id, JSON_OBJECT('amount_paid', OLD.amount_paid, 'reference_number', OLD.reference_number), @current_user_id, @current_correlation_id);
END;