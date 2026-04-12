-- =============================================================
-- HavenStay Boarding House Management System (BHMS)
-- =============================================================
--
-- **Laravel master DDL:** Loaded by `database/migrations/2026_04_09_092954_create_havenstay_master_schema.php`
-- on MySQL (`DB::unprepared`). The file at repo root `db/havenstay_schema.sql` must stay identical to this copy.
--
-- =============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

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

-- -------------------------------------------------------------
-- CORE ENTITIES (CCR-001: 11 tables — see docs/SDD.md §4.2)
-- -------------------------------------------------------------

CREATE TABLE roles (
    role_id      INT           NOT NULL AUTO_INCREMENT,
    role_name    VARCHAR(50)   NOT NULL,
    description  VARCHAR(255),
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id),
    UNIQUE KEY uq_roles_name (role_name)
) ENGINE=InnoDB;

CREATE TABLE users (
    user_id        INT           NOT NULL AUTO_INCREMENT,
    role_id        INT           NOT NULL,
    first_name     VARCHAR(100)  NOT NULL,
    last_name      VARCHAR(100)  NOT NULL,
    username       VARCHAR(100)  NOT NULL,
    email          VARCHAR(150),
    password_hash  VARCHAR(255)  NOT NULL,
    is_active      TINYINT(1)    NOT NULL DEFAULT 1,
    last_login_at  DATETIME,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY uq_users_username (username),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (role_id),
    INDEX idx_users_role (role_id)
) ENGINE=InnoDB;

CREATE TABLE tenants (
    tenant_id                  INT           NOT NULL AUTO_INCREMENT,
    first_name                 VARCHAR(100)  NOT NULL,
    last_name                  VARCHAR(100)  NOT NULL,
    contact_number             VARCHAR(20)   NOT NULL,
    email                      VARCHAR(150),
    emergency_contact_name     VARCHAR(200)  NOT NULL,
    emergency_contact_number   VARCHAR(20)   NOT NULL,
    address                    TEXT          NOT NULL,
    status                     ENUM('active','moved_out','archived') NOT NULL DEFAULT 'active',
    created_at                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id),
    INDEX idx_tenants_name (last_name, first_name),
    INDEX idx_tenants_status (status)
) ENGINE=InnoDB;

CREATE TABLE rooms (
    room_id            INT           NOT NULL AUTO_INCREMENT,
    room_code          VARCHAR(20)   NOT NULL,
    room_type          ENUM('solo','shared') NOT NULL DEFAULT 'solo',
    capacity           INT           NOT NULL DEFAULT 1,
    monthly_rate       DECIMAL(10,2) NOT NULL,
    status             ENUM('available','unavailable','maintenance') NOT NULL DEFAULT 'available',
    amenities          TEXT,
    description        TEXT,
    created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id),
    UNIQUE KEY uq_rooms_code (room_code),
    CONSTRAINT chk_rooms_capacity CHECK (capacity >= 1),
    CONSTRAINT chk_rooms_rate CHECK (monthly_rate >= 0),
    INDEX idx_rooms_status (status)
) ENGINE=InnoDB;

CREATE TABLE bed_spaces (
    bed_space_id       INT           NOT NULL AUTO_INCREMENT,
    room_id            INT           NOT NULL,
    bed_label          VARCHAR(20)   NOT NULL,
    status             ENUM('vacant','occupied','maintenance') NOT NULL DEFAULT 'vacant',
    created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (bed_space_id),
    UNIQUE KEY uq_bed_space_per_room (room_id, bed_label),
    CONSTRAINT fk_bed_spaces_room FOREIGN KEY (room_id) REFERENCES rooms (room_id),
    INDEX idx_bed_spaces_room_status (room_id, status)
) ENGINE=InnoDB;

CREATE TABLE contracts (
    contract_id            INT           NOT NULL AUTO_INCREMENT,
    tenant_id              INT           NOT NULL,
    bed_space_id           INT           NOT NULL,
    created_by             INT           NOT NULL,
    move_in_date           DATE          NOT NULL,
    expected_move_out_date DATE          NULL,
    actual_move_out_date   DATE          NULL,
    deposit_amount         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    monthly_rate           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status                 ENUM('active','completed','terminated') NOT NULL DEFAULT 'active',
    notes                  TEXT,
    created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (contract_id),
    CONSTRAINT fk_contracts_tenant     FOREIGN KEY (tenant_id)    REFERENCES tenants (tenant_id),
    CONSTRAINT fk_contracts_bed        FOREIGN KEY (bed_space_id) REFERENCES bed_spaces (bed_space_id),
    CONSTRAINT fk_contracts_created_by FOREIGN KEY (created_by)   REFERENCES users (user_id),
    CONSTRAINT chk_contracts_rate      CHECK (monthly_rate >= 0),
    CONSTRAINT chk_contracts_deposit   CHECK (deposit_amount >= 0),
    INDEX idx_contracts_tenant_status (tenant_id, status),
    INDEX idx_contracts_bed_status (bed_space_id, status)
) ENGINE=InnoDB;

CREATE TABLE billing (
    billing_id          INT           NOT NULL AUTO_INCREMENT,
    contract_id         INT           NOT NULL,
    billing_period_from DATE          NOT NULL,
    billing_period_to   DATE          NOT NULL,
    due_date            DATE          NOT NULL,
    status              ENUM('unpaid','partial','paid','overdue') NOT NULL DEFAULT 'unpaid',
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (billing_id),
    UNIQUE KEY uq_billing_cycle (contract_id, billing_period_from, billing_period_to),
    CONSTRAINT fk_billing_contract FOREIGN KEY (contract_id) REFERENCES contracts (contract_id),
    INDEX idx_billing_contract_status (contract_id, status),
    INDEX idx_billing_due_date (due_date)
) ENGINE=InnoDB;

CREATE TABLE billing_line_items (
    billing_line_item_id INT           NOT NULL AUTO_INCREMENT,
    billing_id           INT           NOT NULL,
    item_type            ENUM('base_rent','utility','add_on','penalty','adjustment') NOT NULL,
    item_description     VARCHAR(255),
    amount               DECIMAL(10,2) NOT NULL,
    created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (billing_line_item_id),
    CONSTRAINT fk_line_items_billing  FOREIGN KEY (billing_id) REFERENCES billing (billing_id),
    CONSTRAINT chk_line_item_amount   CHECK (amount <> 0),
    INDEX idx_line_items_billing (billing_id)
) ENGINE=InnoDB;

CREATE TABLE payments (
    payment_id          INT           NOT NULL AUTO_INCREMENT,
    billing_id          INT           NOT NULL,
    processed_by        INT           NOT NULL,
    amount_paid         DECIMAL(10,2) NOT NULL,
    payment_date        DATE          NOT NULL,
    payment_method      ENUM('cash','gcash','bank_transfer','other') NOT NULL DEFAULT 'cash',
    reference_number    VARCHAR(100),
    remarks             TEXT,
    voided_at           DATETIME      NULL,
    voided_by           INT           NULL,
    void_reason         VARCHAR(255)  NULL,
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (payment_id),
    CONSTRAINT fk_payments_billing   FOREIGN KEY (billing_id)    REFERENCES billing (billing_id),
    CONSTRAINT fk_payments_user      FOREIGN KEY (processed_by)  REFERENCES users (user_id),
    CONSTRAINT fk_payments_voided_by FOREIGN KEY (voided_by)     REFERENCES users (user_id),
    CONSTRAINT chk_payments_amount   CHECK (amount_paid > 0),
    INDEX idx_payments_billing_date (billing_id, payment_date),
    INDEX idx_payments_processed_by (processed_by)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- AUDIT TABLES (CCR-007, CCR-008)
-- -------------------------------------------------------------

CREATE TABLE audit_logs (
    audit_log_id    BIGINT        NOT NULL AUTO_INCREMENT,
    user_id         INT           NULL,
    entity_name     VARCHAR(100)  NOT NULL,
    entity_id       VARCHAR(100)  NOT NULL,
    action          ENUM('create','update','delete','login','logout','access_denied','status_change') NOT NULL,
    old_values_json JSON          NULL,
    new_values_json JSON          NULL,
    correlation_id  CHAR(36)      NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_log_id),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL,
    INDEX idx_audit_entity (entity_name, entity_id),
    INDEX idx_audit_timestamp (created_at),
    INDEX idx_audit_correlation (correlation_id)
) ENGINE=InnoDB;

CREATE TABLE transaction_logs (
    tx_log_id        BIGINT        NOT NULL AUTO_INCREMENT,
    tx_name          VARCHAR(150)  NOT NULL,
    started_at       DATETIME      NOT NULL,
    completed_at     DATETIME      NULL,
    status           ENUM('started','committed','rolled_back','failed') NOT NULL DEFAULT 'started',
    initiated_by     INT           NULL,
    reference_entity VARCHAR(100),
    reference_id     VARCHAR(100),
    details_json     JSON          NULL,
    correlation_id   CHAR(36)      NULL,
    PRIMARY KEY (tx_log_id),
    CONSTRAINT fk_tx_user FOREIGN KEY (initiated_by) REFERENCES users (user_id) ON DELETE SET NULL,
    INDEX idx_tx_status_started (status, started_at),
    INDEX idx_tx_correlation (correlation_id)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- SEED DATA
-- -------------------------------------------------------------

INSERT INTO roles (role_name, description) VALUES
    ('admin',  'Full system access'),
    ('staff',  'Operational access for daily management'),
    ('viewer', 'Read-only reporting access');

-- -------------------------------------------------------------
-- MINIMAL TRIGGERS (CCR-008: Required for Compliance)
-- Only audit logging - NO business logic here
-- Backend handles validation, status updates, etc.
-- -------------------------------------------------------------

-- Users audit triggers
CREATE TRIGGER trg_users_ai AFTER INSERT ON users FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'users', CAST(NEW.user_id AS CHAR), 'create', 
            JSON_OBJECT('username', NEW.username, 'role_id', NEW.role_id, 'first_name', NEW.first_name, 'last_name', NEW.last_name, 'email', NEW.email), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_users_au AFTER UPDATE ON users FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'users', CAST(NEW.user_id AS CHAR), 'update',
            JSON_OBJECT('role_id', OLD.role_id, 'is_active', OLD.is_active, 'first_name', OLD.first_name, 'last_name', OLD.last_name, 'email', OLD.email),
            JSON_OBJECT('role_id', NEW.role_id, 'is_active', NEW.is_active, 'first_name', NEW.first_name, 'last_name', NEW.last_name, 'email', NEW.email), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_users_ad AFTER DELETE ON users FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'users', CAST(OLD.user_id AS CHAR), 'delete',
            JSON_OBJECT('username', OLD.username), NULLIF(TRIM(@app_correlation_id), ''));
END;

-- Contracts audit triggers (example for other tables)
CREATE TRIGGER trg_contracts_ai AFTER INSERT ON contracts FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, new_values_json, correlation_id)
    VALUES (NEW.created_by, 'contracts', CAST(NEW.contract_id AS CHAR), 'create', 
            JSON_OBJECT('tenant_id', NEW.tenant_id, 'bed_space_id', NEW.bed_space_id, 'monthly_rate', NEW.monthly_rate, 'move_in_date', NEW.move_in_date), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_contracts_au AFTER UPDATE ON contracts FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'contracts', CAST(NEW.contract_id AS CHAR), 'update',
            JSON_OBJECT('status', OLD.status, 'monthly_rate', OLD.monthly_rate, 'expected_move_out_date', OLD.expected_move_out_date),
            JSON_OBJECT('status', NEW.status, 'monthly_rate', NEW.monthly_rate, 'expected_move_out_date', NEW.expected_move_out_date), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_contracts_ad AFTER DELETE ON contracts FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'contracts', CAST(OLD.contract_id AS CHAR), 'delete',
            JSON_OBJECT('tenant_id', OLD.tenant_id), NULLIF(TRIM(@app_correlation_id), ''));
END;

-- Payments audit triggers
CREATE TRIGGER trg_payments_ai AFTER INSERT ON payments FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, new_values_json, correlation_id)
    VALUES (NEW.processed_by, 'payments', CAST(NEW.payment_id AS CHAR), 'create', 
            JSON_OBJECT('billing_id', NEW.billing_id, 'amount', NEW.amount_paid), NULLIF(TRIM(@app_correlation_id), ''));
END;

-- Finish Payments audit triggers (UPDATE and DELETE)
CREATE TRIGGER trg_payments_au AFTER UPDATE ON payments FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'payments', CAST(NEW.payment_id AS CHAR), 'update',
            JSON_OBJECT('amount_paid', OLD.amount_paid, 'payment_method', OLD.payment_method),
            JSON_OBJECT('amount_paid', NEW.amount_paid, 'payment_method', NEW.payment_method), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_payments_ad AFTER DELETE ON payments FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'payments', CAST(OLD.payment_id AS CHAR), 'delete',
            JSON_OBJECT('billing_id', OLD.billing_id, 'amount_paid', OLD.amount_paid), NULLIF(TRIM(@app_correlation_id), ''));
END;

-- Billing audit triggers (Crucial for transactional compliance)
CREATE TRIGGER trg_billing_ai AFTER INSERT ON billing FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'billing', CAST(NEW.billing_id AS CHAR), 'create', 
            JSON_OBJECT('contract_id', NEW.contract_id, 'status', NEW.status, 'due_date', NEW.due_date), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_billing_au AFTER UPDATE ON billing FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'billing', CAST(NEW.billing_id AS CHAR), 'update',
            JSON_OBJECT('status', OLD.status, 'due_date', OLD.due_date),
            JSON_OBJECT('status', NEW.status, 'due_date', NEW.due_date), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_billing_ad AFTER DELETE ON billing FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'billing', CAST(OLD.billing_id AS CHAR), 'delete',
            JSON_OBJECT('contract_id', OLD.contract_id, 'status', OLD.status), NULLIF(TRIM(@app_correlation_id), ''));
END;

-- Billing Line Items audit triggers
CREATE TRIGGER trg_billing_line_items_ai AFTER INSERT ON billing_line_items FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'billing_line_items', CAST(NEW.billing_line_item_id AS CHAR), 'create', 
            JSON_OBJECT('billing_id', NEW.billing_id, 'type', NEW.item_type, 'amount', NEW.amount, 'description', NEW.item_description), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_billing_line_items_au AFTER UPDATE ON billing_line_items FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'billing_line_items', CAST(NEW.billing_line_item_id AS CHAR), 'update',
            JSON_OBJECT('amount', OLD.amount, 'item_description', OLD.item_description),
            JSON_OBJECT('amount', NEW.amount, 'item_description', NEW.item_description), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_billing_line_items_ad AFTER DELETE ON billing_line_items FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'billing_line_items', CAST(OLD.billing_line_item_id AS CHAR), 'delete',
            JSON_OBJECT('billing_id', OLD.billing_id, 'amount', OLD.amount), NULLIF(TRIM(@app_correlation_id), ''));
END;

-- Tenants audit triggers
CREATE TRIGGER trg_tenants_ai AFTER INSERT ON tenants FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'tenants', CAST(NEW.tenant_id AS CHAR), 'create', 
            JSON_OBJECT('name', CONCAT(NEW.first_name, ' ', NEW.last_name), 'status', NEW.status, 'email', NEW.email), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_tenants_au AFTER UPDATE ON tenants FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'tenants', CAST(NEW.tenant_id AS CHAR), 'update',
            JSON_OBJECT('status', OLD.status, 'first_name', OLD.first_name, 'last_name', OLD.last_name, 'contact_number', OLD.contact_number, 'email', OLD.email),
            JSON_OBJECT('status', NEW.status, 'first_name', NEW.first_name, 'last_name', NEW.last_name, 'contact_number', NEW.contact_number, 'email', NEW.email), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_tenants_ad AFTER DELETE ON tenants FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'tenants', CAST(OLD.tenant_id AS CHAR), 'delete',
            JSON_OBJECT('name', CONCAT(OLD.first_name, ' ', OLD.last_name)), NULLIF(TRIM(@app_correlation_id), ''));
END;

-- Rooms audit triggers
CREATE TRIGGER trg_rooms_ai AFTER INSERT ON rooms FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'rooms', CAST(NEW.room_id AS CHAR), 'create', 
            JSON_OBJECT('room_code', NEW.room_code, 'status', NEW.status), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_rooms_au AFTER UPDATE ON rooms FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'rooms', CAST(NEW.room_id AS CHAR), 'update',
            JSON_OBJECT('status', OLD.status, 'monthly_rate', OLD.monthly_rate, 'room_code', OLD.room_code),
            JSON_OBJECT('status', NEW.status, 'monthly_rate', NEW.monthly_rate, 'room_code', NEW.room_code), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_rooms_ad AFTER DELETE ON rooms FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'rooms', CAST(OLD.room_id AS CHAR), 'delete',
            JSON_OBJECT('room_code', OLD.room_code), NULLIF(TRIM(@app_correlation_id), ''));
END;

-- Bed Spaces audit triggers
CREATE TRIGGER trg_bed_spaces_ai AFTER INSERT ON bed_spaces FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'bed_spaces', CAST(NEW.bed_space_id AS CHAR), 'create', 
            JSON_OBJECT('bed_label', NEW.bed_label, 'status', NEW.status), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_bed_spaces_au AFTER UPDATE ON bed_spaces FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, new_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'bed_spaces', CAST(NEW.bed_space_id AS CHAR), 'update',
            JSON_OBJECT('status', OLD.status, 'bed_label', OLD.bed_label),
            JSON_OBJECT('status', NEW.status, 'bed_label', NEW.bed_label), NULLIF(TRIM(@app_correlation_id), ''));
END;

CREATE TRIGGER trg_bed_spaces_ad AFTER DELETE ON bed_spaces FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, entity_name, entity_id, action, old_values_json, correlation_id)
    VALUES (CAST(@app_user_id AS UNSIGNED), 'bed_spaces', CAST(OLD.bed_space_id AS CHAR), 'delete',
            JSON_OBJECT('bed_label', OLD.bed_label), NULLIF(TRIM(@app_correlation_id), ''));
END;


-- -------------------------------------------------------------
-- REPORTING VIEWS (CCR-005: Multi-table JOIN demonstrations)
-- -------------------------------------------------------------

-- View 1: Billing summary with logic to handle paymentVOID and avoid duplication
CREATE VIEW vw_billing_summary AS
SELECT 
    b.billing_id,
    b.billing_period_from,
    b.billing_period_to,
    b.due_date,
    b.status AS billing_status,
    c.contract_id,
    t.tenant_id,
    CONCAT(t.first_name, ' ', t.last_name) AS tenant_name,
    t.email,
    r.room_id,
    r.room_code,
    bs.bed_space_id,
    bs.bed_label,
    COALESCE((SELECT SUM(amount) FROM billing_line_items bli WHERE bli.billing_id = b.billing_id), 0) AS total_amount,
    COALESCE((SELECT SUM(p.amount_paid) FROM payments p WHERE p.billing_id = b.billing_id AND p.voided_at IS NULL), 0) AS total_paid
FROM billing b
INNER JOIN contracts c ON b.contract_id = c.contract_id
INNER JOIN tenants t ON c.tenant_id = t.tenant_id
INNER JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
INNER JOIN rooms r ON bs.room_id = r.room_id;

-- View 2: Active contracts with full entity IDs
CREATE VIEW vw_active_contracts AS
SELECT 
    c.contract_id,
    c.move_in_date,
    t.tenant_id,
    CONCAT(t.first_name, ' ', t.last_name) AS tenant_name,
    t.contact_number,
    t.email,
    r.room_id,
    r.room_code,
    COALESCE(c.monthly_rate, r.monthly_rate) as monthly_rate,
    bs.bed_space_id,
    bs.bed_label,
    bs.status AS bed_status
FROM contracts c
INNER JOIN tenants t ON c.tenant_id = t.tenant_id
INNER JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
INNER JOIN rooms r ON bs.room_id = r.room_id
WHERE c.status = 'active';

-- View 3: Room occupancy with aggregation
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
    SUM(CASE WHEN bs.status = 'vacant' AND r.status = 'available' THEN 1 ELSE 0 END) AS vacant_beds
FROM rooms r
LEFT JOIN bed_spaces bs ON r.room_id = bs.room_id
GROUP BY r.room_id, r.room_code, r.room_type, r.monthly_rate, r.status, r.capacity;

-- View 4: Detailed occupancy status (Added for completeness with migration)
CREATE VIEW vw_occupancy_status AS
SELECT 
    bs.bed_space_id,
    bs.bed_label,
    bs.status AS bed_status,
    r.room_id,
    r.room_code,
    t.tenant_id,
    CONCAT(t.first_name, ' ', t.last_name) AS tenant_name,
    c.contract_id
FROM bed_spaces bs
INNER JOIN rooms r ON bs.room_id = r.room_id
LEFT JOIN contracts c ON bs.bed_space_id = c.bed_space_id AND c.status = 'active'
LEFT JOIN tenants t ON c.tenant_id = t.tenant_id;

-- View 5: Collections Performance (FR-032b)
CREATE VIEW vw_collections_summary AS
SELECT 
    p.payment_id,
    p.payment_date,
    p.amount_paid,
    p.payment_method,
    p.reference_number,
    t.tenant_id,
    CONCAT(t.first_name, ' ', t.last_name) AS tenant_name,
    b.billing_id,
    r.room_code
FROM payments p
INNER JOIN billing b ON p.billing_id = b.billing_id
INNER JOIN contracts c ON b.contract_id = c.contract_id
INNER JOIN tenants t ON c.tenant_id = t.tenant_id
INNER JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
INNER JOIN rooms r ON bs.room_id = r.room_id
WHERE p.voided_at IS NULL;

-- View 6: Tenant contract history (all contract statuses; FR-031 tenant history report)
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