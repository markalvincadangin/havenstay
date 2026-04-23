-- HavenStay Boarding House Management System (BHMS)
-- Canonical Master Schema v4.7
-- 15 Core Entities | 45 Forensic Triggers | 6 Reporting Views

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── DROP ALL OBJECTS ──

DROP TRIGGER IF EXISTS trg_roles_ai; DROP TRIGGER IF EXISTS trg_roles_au; DROP TRIGGER IF EXISTS trg_roles_ad;
DROP TRIGGER IF EXISTS trg_users_ai; DROP TRIGGER IF EXISTS trg_users_au; DROP TRIGGER IF EXISTS trg_users_ad;
DROP TRIGGER IF EXISTS trg_tenants_ai; DROP TRIGGER IF EXISTS trg_tenants_au; DROP TRIGGER IF EXISTS trg_tenants_ad;
DROP TRIGGER IF EXISTS trg_rooms_ai; DROP TRIGGER IF EXISTS trg_rooms_au; DROP TRIGGER IF EXISTS trg_rooms_ad;
DROP TRIGGER IF EXISTS trg_bed_spaces_ai; DROP TRIGGER IF EXISTS trg_bed_spaces_au; DROP TRIGGER IF EXISTS trg_bed_spaces_ad;
DROP TRIGGER IF EXISTS trg_contracts_ai; DROP TRIGGER IF EXISTS trg_contracts_au; DROP TRIGGER IF EXISTS trg_contracts_ad;
DROP TRIGGER IF EXISTS trg_utilities_ai; DROP TRIGGER IF EXISTS trg_utilities_au; DROP TRIGGER IF EXISTS trg_utilities_ad;
DROP TRIGGER IF EXISTS trg_meters_ai; DROP TRIGGER IF EXISTS trg_meters_au; DROP TRIGGER IF EXISTS trg_meters_ad;
DROP TRIGGER IF EXISTS trg_meter_assignments_bi; DROP TRIGGER IF EXISTS trg_meter_assignments_ai; DROP TRIGGER IF EXISTS trg_meter_assignments_au; DROP TRIGGER IF EXISTS trg_meter_assignments_ad;
DROP TRIGGER IF EXISTS trg_meter_readings_ai; DROP TRIGGER IF EXISTS trg_meter_readings_au; DROP TRIGGER IF EXISTS trg_meter_readings_ad;
DROP TRIGGER IF EXISTS trg_utility_rates_ai; DROP TRIGGER IF EXISTS trg_utility_rates_au; DROP TRIGGER IF EXISTS trg_utility_rates_ad;
DROP TRIGGER IF EXISTS trg_billing_ai; DROP TRIGGER IF EXISTS trg_billing_au; DROP TRIGGER IF EXISTS trg_billing_ad;
DROP TRIGGER IF EXISTS trg_billing_line_items_ai; DROP TRIGGER IF EXISTS trg_billing_line_items_au; DROP TRIGGER IF EXISTS trg_billing_line_items_ad;
DROP TRIGGER IF EXISTS trg_payments_ai; DROP TRIGGER IF EXISTS trg_payments_au; DROP TRIGGER IF EXISTS trg_payments_ad;
DROP TRIGGER IF EXISTS trg_audit_logs_protect_bu;
DROP TRIGGER IF EXISTS trg_audit_logs_protect_bd;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS billing_line_items;
DROP TABLE IF EXISTS billing;
DROP TABLE IF EXISTS utility_rates;
DROP TABLE IF EXISTS meter_readings;
DROP TABLE IF EXISTS meter_assignments;
DROP TABLE IF EXISTS meters;
DROP TABLE IF EXISTS utilities;
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

-- ── SECTION 1: CORE OPERATIONAL ENTITIES (14 TABLES) ──

CREATE TABLE roles (
    role_id     INT AUTO_INCREMENT PRIMARY KEY,
    role_name   VARCHAR(50)  NOT NULL,
    description VARCHAR(255) NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_role_name (role_name)
) ENGINE=InnoDB;

CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    role_id       INT          NOT NULL,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    username      VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active     TINYINT(1)   DEFAULT 1,
    last_login_at DATETIME     NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at    DATETIME NULL,
    -- Forensic Uniqueness (allows re-registration after soft-delete)
    active_username VARCHAR(100) GENERATED ALWAYS AS (CASE WHEN deleted_at IS NULL THEN username ELSE NULL END) VIRTUAL,
    active_email    VARCHAR(150) GENERATED ALWAYS AS (CASE WHEN deleted_at IS NULL THEN email    ELSE NULL END) VIRTUAL,
    UNIQUE KEY uq_active_username (active_username),
    UNIQUE KEY uq_active_email    (active_email),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (role_id)
) ENGINE=InnoDB;

CREATE TABLE tenants (
    tenant_id                INT AUTO_INCREMENT PRIMARY KEY,
    first_name               VARCHAR(100) NOT NULL,
    last_name                VARCHAR(100) NOT NULL,
    contact_number           VARCHAR(20)  NOT NULL,
    email                    VARCHAR(150) NOT NULL,
    emergency_contact_name   VARCHAR(200) NOT NULL,
    emergency_contact_number VARCHAR(20)  NOT NULL,
    address                  TEXT         NOT NULL,
    status                   ENUM('active','moved_out','archived') DEFAULT 'active',
    created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at               DATETIME NULL,
    -- Forensic Uniqueness (allows re-registration after soft-delete)
    active_email VARCHAR(150) GENERATED ALWAYS AS (CASE WHEN deleted_at IS NULL THEN email ELSE NULL END) VIRTUAL,
    UNIQUE KEY uq_active_tenant_email (active_email),
    INDEX idx_tenant_lookup (last_name, first_name)
) ENGINE=InnoDB;

CREATE TABLE rooms (
    room_id      INT AUTO_INCREMENT PRIMARY KEY,
    room_code    VARCHAR(20)   NOT NULL,
    room_type    ENUM('private','shared') DEFAULT 'private',
    capacity     INT           DEFAULT 1,
    monthly_rate DECIMAL(10,2) NOT NULL,
    status       ENUM('available','unavailable','maintenance') DEFAULT 'available',
    amenities    TEXT          NULL,
    description  TEXT          NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL,
    UNIQUE KEY uq_room_code (room_code),
    CONSTRAINT chk_room_capacity CHECK (capacity >= 1),
    CONSTRAINT chk_room_rate     CHECK (monthly_rate >= 0)
) ENGINE=InnoDB;

CREATE TABLE bed_spaces (
    bed_space_id INT AUTO_INCREMENT PRIMARY KEY,
    room_id      INT         NOT NULL,
    bed_label    VARCHAR(20) NOT NULL,
    status       ENUM('vacant','occupied','maintenance') DEFAULT 'vacant',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL,
    UNIQUE KEY uq_bed_per_room (room_id, bed_label),
    CONSTRAINT fk_bed_room FOREIGN KEY (room_id) REFERENCES rooms (room_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE contracts (
    contract_id            INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id              INT          NOT NULL,
    bed_space_id           INT          NOT NULL,
    created_by             INT          NOT NULL,
    contract_type          ENUM('fixed_term','month_to_month') NOT NULL,
    move_in_date           DATE         NOT NULL,
    expected_move_out_date DATE         NULL,
    actual_move_out_date   DATE         NULL,
    monthly_rate           DECIMAL(10,2) NOT NULL,
    monthly_rate_override  DECIMAL(10,2) NULL,
    deposit_amount         DECIMAL(10,2) DEFAULT 0.00,
    is_cleared             BOOLEAN      DEFAULT FALSE,
    status                 ENUM('pending_payment','active','completed','terminated','voided') DEFAULT 'pending_payment',
    notes                  TEXT         NULL,
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at             DATETIME NULL,
    CONSTRAINT fk_contract_tenant FOREIGN KEY (tenant_id)    REFERENCES tenants    (tenant_id),
    CONSTRAINT fk_contract_bed    FOREIGN KEY (bed_space_id) REFERENCES bed_spaces (bed_space_id),
    CONSTRAINT fk_contract_owner  FOREIGN KEY (created_by)   REFERENCES users      (user_id),
    CONSTRAINT chk_contract_dates CHECK (move_in_date < expected_move_out_date OR expected_move_out_date IS NULL)
) ENGINE=InnoDB;

CREATE TABLE utilities (
    utility_id   INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    unit_of_measurement VARCHAR(20) NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL
) ENGINE=InnoDB;

CREATE TABLE meters (
    meter_id      INT AUTO_INCREMENT PRIMARY KEY,
    utility_id    INT          NOT NULL,
    serial_number VARCHAR(100) NOT NULL,
    status        ENUM('active','maintenance','replaced') DEFAULT 'active',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_meter_serial (serial_number),
    CONSTRAINT fk_meter_utility FOREIGN KEY (utility_id) REFERENCES utilities (utility_id)
) ENGINE=InnoDB;

CREATE TABLE meter_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    meter_id      INT  NOT NULL,
    room_id       INT  NOT NULL,
    valid_from    DATE NOT NULL,
    valid_to      DATE NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ma_meter FOREIGN KEY (meter_id) REFERENCES meters (meter_id),
    CONSTRAINT fk_ma_room  FOREIGN KEY (room_id)  REFERENCES rooms  (room_id)
) ENGINE=InnoDB;

CREATE TABLE meter_readings (
    reading_id    INT AUTO_INCREMENT PRIMARY KEY,
    meter_id      INT           NOT NULL,
    reading_date  DATE          NOT NULL,
    reading_value DECIMAL(12,4) NOT NULL,
    is_rollover   TINYINT(1)    DEFAULT 0,
    recorded_by   INT           NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mr_meter FOREIGN KEY (meter_id) REFERENCES meters (meter_id),
    CONSTRAINT fk_mr_actor FOREIGN KEY (recorded_by) REFERENCES users (user_id)
) ENGINE=InnoDB;

CREATE TABLE utility_rates (
    rate_id        INT AUTO_INCREMENT PRIMARY KEY,
    utility_id     INT           NOT NULL,
    base_rate      DECIMAL(10,2) NOT NULL,
    effective_from DATE          NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ur_utility FOREIGN KEY (utility_id) REFERENCES utilities (utility_id),
    UNIQUE KEY uq_rate_effective (utility_id, effective_from)
) ENGINE=InnoDB;

CREATE TABLE billing (
    billing_id          INT AUTO_INCREMENT PRIMARY KEY,
    contract_id         INT  NOT NULL,
    billing_period_from DATE NOT NULL,
    billing_period_to   DATE NOT NULL,
    due_date            DATE NOT NULL,
    status              ENUM('unpaid','partial','paid','overdue') DEFAULT 'unpaid',
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_billing_cycle (contract_id, billing_period_from, billing_period_to),
    CONSTRAINT fk_billing_contract FOREIGN KEY (contract_id) REFERENCES contracts (contract_id)
) ENGINE=InnoDB;

CREATE TABLE billing_line_items (
    line_item_id     INT AUTO_INCREMENT PRIMARY KEY,
    billing_id       INT           NOT NULL,
    utility_id       INT           NULL, 
    reading_id       INT           NULL, 
    item_type        ENUM('base_rent','utility','penalty','adjustment') NOT NULL,
    item_description VARCHAR(255)  NOT NULL,
    amount           DECIMAL(10,2) NOT NULL,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_bli_billing FOREIGN KEY (billing_id) REFERENCES billing (billing_id),
    CONSTRAINT fk_bli_utility FOREIGN KEY (utility_id) REFERENCES utilities (utility_id),
    CONSTRAINT fk_bli_reading FOREIGN KEY (reading_id) REFERENCES meter_readings (reading_id),
    CONSTRAINT chk_bli_amount   CHECK (amount <> 0),
    CONSTRAINT chk_bli_polarity CHECK ( (item_type = 'adjustment') OR (amount > 0) ),
    -- Forensic Utility Linkage: Mandates references for 'utility' types (Level 5 Hardening)
    CONSTRAINT chk_bli_utility_link CHECK ( (item_type <> 'utility') OR (utility_id IS NOT NULL AND reading_id IS NOT NULL) )
) ENGINE=InnoDB;

CREATE TABLE payments (
    payment_id       INT AUTO_INCREMENT PRIMARY KEY,
    billing_id       INT           NULL, 
    contract_id      INT           NULL, 
    payment_category ENUM('billing','deposit','refund','rollover') DEFAULT 'billing',
    amount_paid      DECIMAL(10,2) NOT NULL,
    payment_date     DATE          NOT NULL,
    payment_method   ENUM('cash','gcash','bank_transfer','other') NOT NULL,
    reference_number VARCHAR(100)  NULL, -- For 'rollover', this stores the Source Contract ID
    processed_by     INT           NOT NULL,
    voided_at        DATETIME      NULL,
    voided_by        INT           NULL,
    void_reason      VARCHAR(255)  NULL,
    created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pay_billing  FOREIGN KEY (billing_id)   REFERENCES billing (billing_id),
    CONSTRAINT fk_pay_contract FOREIGN KEY (contract_id)  REFERENCES contracts (contract_id),
    CONSTRAINT fk_pay_actor    FOREIGN KEY (processed_by) REFERENCES users   (user_id),
    CONSTRAINT fk_pay_voider   FOREIGN KEY (voided_by)    REFERENCES users   (user_id),
    CONSTRAINT chk_pay_amount       CHECK (amount_paid > 0),
    CONSTRAINT chk_pay_target       CHECK (
        (billing_id IS NOT NULL AND contract_id IS NULL) OR
        (billing_id IS NULL AND contract_id IS NOT NULL)
    ),
    -- BR-PAY-002: Reference number is mandatory for traceable payment methods
    CONSTRAINT chk_pay_ref_required CHECK (
        payment_method NOT IN ('gcash', 'bank_transfer') OR reference_number IS NOT NULL
    )
) ENGINE=InnoDB;

-- ── SECTION 2: FORENSIC TABLES (1 TABLE) ──

CREATE TABLE audit_logs (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    action         VARCHAR(32)     NOT NULL,
    target_table   VARCHAR(64)     NOT NULL,
    record_id      BIGINT UNSIGNED NOT NULL,
    old_value      JSON            NULL,
    new_value      JSON            NULL,
    changed_by     INT             NULL,
    correlation_id VARCHAR(64)     NULL,
    changed_at     DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── SECTION 3: REFERENCE DATA ──

INSERT INTO roles (role_id, role_name, description) VALUES
(1, 'admin',  'System Administrator'),
(2, 'staff',  'Operator'),
(3, 'viewer', 'Read-Only');

INSERT INTO users (role_id, first_name, last_name, username, email, password_hash) VALUES
(1, 'System', 'Administrator', 'admin', 'admin@havenstay.com', '$2y$12$V.vR9pW5zEq.6vD.JvR7v.XvXvXvXvXvXvXvXvXvXvXvXvXvXvXvX');

INSERT INTO utilities (utility_id, name, unit_of_measurement) VALUES
(1, 'Electricity', 'kWh'),
(2, 'Water', 'm3');

-- ── SECTION 4: FORENSIC AUDIT ENGINE (42 TRIGGERS) ──

DELIMITER //

-- Roles
CREATE TRIGGER trg_roles_ai AFTER INSERT ON roles FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'roles', NEW.role_id, JSON_OBJECT('name', NEW.role_name), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_roles_au AFTER UPDATE ON roles FOR EACH ROW 
BEGIN
    IF NOT (OLD.role_name <=> NEW.role_name) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'roles', NEW.role_id, JSON_OBJECT('name', OLD.role_name), JSON_OBJECT('name', NEW.role_name), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_roles_ad AFTER DELETE ON roles FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'roles', OLD.role_id, JSON_OBJECT('name', OLD.role_name), @current_user_id, @current_correlation_id)//

-- Users
CREATE TRIGGER trg_users_ai AFTER INSERT ON users FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'users', NEW.user_id, JSON_OBJECT('user', NEW.username, 'role', NEW.role_id, 'active', NEW.is_active), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_users_au AFTER UPDATE ON users FOR EACH ROW 
BEGIN
    IF NOT (OLD.username <=> NEW.username) OR NOT (OLD.role_id <=> NEW.role_id) OR NOT (OLD.is_active <=> NEW.is_active) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'users', NEW.user_id, JSON_OBJECT('user', OLD.username, 'role', OLD.role_id, 'active', OLD.is_active), JSON_OBJECT('user', NEW.username, 'role', NEW.role_id, 'active', NEW.is_active), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_users_ad AFTER DELETE ON users FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'users', OLD.user_id, JSON_OBJECT('user', OLD.username), @current_user_id, @current_correlation_id)//

-- Tenants
CREATE TRIGGER trg_tenants_ai AFTER INSERT ON tenants FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'tenants', NEW.tenant_id, JSON_OBJECT('first', NEW.first_name, 'last', NEW.last_name, 'email', NEW.email), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_tenants_au AFTER UPDATE ON tenants FOR EACH ROW 
BEGIN
    IF NOT (OLD.first_name <=> NEW.first_name) OR NOT (OLD.last_name <=> NEW.last_name) OR NOT (OLD.email <=> NEW.email) OR NOT (OLD.status <=> NEW.status) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'tenants', NEW.tenant_id, JSON_OBJECT('first', OLD.first_name, 'last', OLD.last_name, 'email', OLD.email, 'status', OLD.status), JSON_OBJECT('first', NEW.first_name, 'last', NEW.last_name, 'email', NEW.email, 'status', NEW.status), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_tenants_ad AFTER DELETE ON tenants FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'tenants', OLD.tenant_id, JSON_OBJECT('first', OLD.first_name, 'last', OLD.last_name), @current_user_id, @current_correlation_id)//

-- Rooms
CREATE TRIGGER trg_rooms_ai AFTER INSERT ON rooms FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'rooms', NEW.room_id, JSON_OBJECT('code', NEW.room_code, 'type', NEW.room_type, 'cap', NEW.capacity), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_rooms_au AFTER UPDATE ON rooms FOR EACH ROW 
BEGIN
    IF NOT (OLD.room_code <=> NEW.room_code) OR NOT (OLD.room_type <=> NEW.room_type) OR NOT (OLD.status <=> NEW.status) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'rooms', NEW.room_id, JSON_OBJECT('code', OLD.room_code, 'type', OLD.room_type, 'status', OLD.status), JSON_OBJECT('code', NEW.room_code, 'type', NEW.room_type, 'status', NEW.status), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_rooms_ad AFTER DELETE ON rooms FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'rooms', OLD.room_id, JSON_OBJECT('code', OLD.room_code), @current_user_id, @current_correlation_id)//

-- Bed Spaces
CREATE TRIGGER trg_bed_spaces_ai AFTER INSERT ON bed_spaces FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'bed_spaces', NEW.bed_space_id, JSON_OBJECT('label', NEW.bed_label), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_bed_spaces_au AFTER UPDATE ON bed_spaces FOR EACH ROW 
BEGIN
    IF NOT (OLD.status <=> NEW.status) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'bed_spaces', NEW.bed_space_id, JSON_OBJECT('status', OLD.status), JSON_OBJECT('status', NEW.status), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_bed_spaces_ad AFTER DELETE ON bed_spaces FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'bed_spaces', OLD.bed_space_id, JSON_OBJECT('label', OLD.bed_label), @current_user_id, @current_correlation_id)//

-- Contracts
CREATE TRIGGER trg_contracts_ai AFTER INSERT ON contracts FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'contracts', NEW.contract_id, JSON_OBJECT('tenant', NEW.tenant_id, 'bed', NEW.bed_space_id, 'rate', NEW.monthly_rate), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_contracts_au AFTER UPDATE ON contracts FOR EACH ROW 
BEGIN
    IF NOT (OLD.status <=> NEW.status) OR NOT (OLD.monthly_rate <=> NEW.monthly_rate) OR NOT (OLD.monthly_rate_override <=> NEW.monthly_rate_override) OR NOT (OLD.is_cleared <=> NEW.is_cleared) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'contracts', NEW.contract_id, JSON_OBJECT('status', OLD.status, 'rate', OLD.monthly_rate, 'override', OLD.monthly_rate_override, 'cleared', OLD.is_cleared), JSON_OBJECT('status', NEW.status, 'rate', NEW.monthly_rate, 'override', NEW.monthly_rate_override, 'cleared', NEW.is_cleared), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_contracts_ad AFTER DELETE ON contracts FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'contracts', OLD.contract_id, JSON_OBJECT('tenant', OLD.tenant_id), @current_user_id, @current_correlation_id)//

-- Utilities
CREATE TRIGGER trg_utilities_ai AFTER INSERT ON utilities FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'utilities', NEW.utility_id, JSON_OBJECT('name', NEW.name), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_utilities_au AFTER UPDATE ON utilities FOR EACH ROW 
BEGIN
    IF NOT (OLD.name <=> NEW.name) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'utilities', NEW.utility_id, JSON_OBJECT('name', OLD.name), JSON_OBJECT('name', NEW.name), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_utilities_ad AFTER DELETE ON utilities FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'utilities', OLD.utility_id, JSON_OBJECT('name', OLD.name), @current_user_id, @current_correlation_id)//

-- Meters
CREATE TRIGGER trg_meters_ai AFTER INSERT ON meters FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'meters', NEW.meter_id, JSON_OBJECT('sn', NEW.serial_number, 'utility', NEW.utility_id), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_meters_au AFTER UPDATE ON meters FOR EACH ROW 
BEGIN
    IF NOT (OLD.serial_number <=> NEW.serial_number) OR NOT (OLD.status <=> NEW.status) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'meters', NEW.meter_id, JSON_OBJECT('sn', OLD.serial_number, 'status', OLD.status), JSON_OBJECT('sn', NEW.serial_number, 'status', NEW.status), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_meters_ad AFTER DELETE ON meters FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'meters', OLD.meter_id, JSON_OBJECT('sn', OLD.serial_number), @current_user_id, @current_correlation_id)//

-- Meter Assignments
CREATE TRIGGER trg_meter_assignments_ai AFTER INSERT ON meter_assignments FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'meter_assignments', NEW.assignment_id, JSON_OBJECT('room', NEW.room_id, 'mtr', NEW.meter_id), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_meter_assignments_au AFTER UPDATE ON meter_assignments FOR EACH ROW 
BEGIN
    IF NOT (OLD.room_id <=> NEW.room_id) OR NOT (OLD.meter_id <=> NEW.meter_id) OR NOT (OLD.valid_to <=> NEW.valid_to) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'meter_assignments', NEW.assignment_id, JSON_OBJECT('room', OLD.room_id, 'mtr', OLD.meter_id, 'to', OLD.valid_to), JSON_OBJECT('room', NEW.room_id, 'mtr', NEW.meter_id, 'to', NEW.valid_to), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_meter_assignments_ad AFTER DELETE ON meter_assignments FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'meter_assignments', OLD.assignment_id, JSON_OBJECT('room', OLD.room_id, 'mtr', OLD.meter_id), @current_user_id, @current_correlation_id)//
-- BR-MET-003: One active assignment per meter (valid_to IS NULL guard)
CREATE TRIGGER trg_meter_assignments_bi BEFORE INSERT ON meter_assignments FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1 FROM meter_assignments
        WHERE meter_id = NEW.meter_id AND valid_to IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Meter already has an active assignment. Close the existing assignment (set valid_to) before reassigning.';
    END IF;
END//

-- Meter Readings
CREATE TRIGGER trg_meter_readings_ai AFTER INSERT ON meter_readings FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'meter_readings', NEW.reading_id, JSON_OBJECT('val', NEW.reading_value, 'date', NEW.reading_date, 'mtr', NEW.meter_id), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_meter_readings_au AFTER UPDATE ON meter_readings FOR EACH ROW 
BEGIN
    IF NOT (OLD.reading_value <=> NEW.reading_value) OR NOT (OLD.reading_date <=> NEW.reading_date) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'meter_readings', NEW.reading_id, JSON_OBJECT('val', OLD.reading_value, 'date', OLD.reading_date), JSON_OBJECT('val', NEW.reading_value, 'date', NEW.reading_date), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_meter_readings_ad AFTER DELETE ON meter_readings FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'meter_readings', OLD.reading_id, JSON_OBJECT('date', OLD.reading_date, 'mtr', OLD.meter_id), @current_user_id, @current_correlation_id)//

-- Utility Rates
CREATE TRIGGER trg_utility_rates_ai AFTER INSERT ON utility_rates FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'utility_rates', NEW.rate_id, JSON_OBJECT('rate', NEW.base_rate, 'util', NEW.utility_id), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_utility_rates_au AFTER UPDATE ON utility_rates FOR EACH ROW 
BEGIN
    IF NOT (OLD.base_rate <=> NEW.base_rate) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'utility_rates', NEW.rate_id, JSON_OBJECT('rate', OLD.base_rate), JSON_OBJECT('rate', NEW.base_rate), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_utility_rates_ad AFTER DELETE ON utility_rates FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'utility_rates', OLD.rate_id, JSON_OBJECT('utility', OLD.utility_id), @current_user_id, @current_correlation_id)//

-- Billing
CREATE TRIGGER trg_billing_ai AFTER INSERT ON billing FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'billing', NEW.billing_id, JSON_OBJECT('contract', NEW.contract_id, 'from', NEW.billing_period_from, 'to', NEW.billing_period_to, 'due', NEW.due_date), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_billing_au AFTER UPDATE ON billing FOR EACH ROW 
BEGIN
    IF NOT (OLD.status <=> NEW.status) OR NOT (OLD.due_date <=> NEW.due_date) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'billing', NEW.billing_id, JSON_OBJECT('status', OLD.status, 'due', OLD.due_date), JSON_OBJECT('status', NEW.status, 'due', NEW.due_date), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_billing_ad AFTER DELETE ON billing FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'billing', OLD.billing_id, JSON_OBJECT('contract', OLD.contract_id), @current_user_id, @current_correlation_id)//

-- Payments
CREATE TRIGGER trg_payments_ai AFTER INSERT ON payments FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'payments', NEW.payment_id, JSON_OBJECT('amt', NEW.amount_paid, 'meth', NEW.payment_method, 'ref', NEW.reference_number, 'bill', NEW.billing_id), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_payments_au AFTER UPDATE ON payments FOR EACH ROW 
BEGIN
    IF NOT (OLD.voided_at <=> NEW.voided_at) OR NOT (OLD.amount_paid <=> NEW.amount_paid) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'payments', NEW.payment_id, JSON_OBJECT('voided', OLD.voided_at, 'amt', OLD.amount_paid), JSON_OBJECT('voided', NEW.voided_at, 'amt', NEW.amount_paid), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_payments_ad AFTER DELETE ON payments FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'payments', OLD.payment_id, JSON_OBJECT('amt', OLD.amount_paid, 'ref', OLD.reference_number), @current_user_id, @current_correlation_id)//

-- Billing Line Items
CREATE TRIGGER trg_billing_line_items_ai AFTER INSERT ON billing_line_items FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, new_value, changed_by, correlation_id) VALUES ('INSERT', 'billing_line_items', NEW.line_item_id, JSON_OBJECT('bill', NEW.billing_id, 'type', NEW.item_type, 'amt', NEW.amount), @current_user_id, @current_correlation_id)//
CREATE TRIGGER trg_billing_line_items_au AFTER UPDATE ON billing_line_items FOR EACH ROW 
BEGIN
    IF NOT (OLD.item_type <=> NEW.item_type) OR NOT (OLD.amount <=> NEW.amount) THEN
        INSERT INTO audit_logs(action, target_table, record_id, old_value, new_value, changed_by, correlation_id) 
        VALUES ('UPDATE', 'billing_line_items', NEW.line_item_id, JSON_OBJECT('type', OLD.item_type, 'amt', OLD.amount), JSON_OBJECT('type', NEW.item_type, 'amt', NEW.amount), @current_user_id, @current_correlation_id);
    END IF;
END//
CREATE TRIGGER trg_billing_line_items_ad AFTER DELETE ON billing_line_items FOR EACH ROW INSERT INTO audit_logs(action, target_table, record_id, old_value, changed_by, correlation_id) VALUES ('DELETE', 'billing_line_items', OLD.line_item_id, JSON_OBJECT('type', OLD.item_type, 'amt', OLD.amount), @current_user_id, @current_correlation_id)//

-- Audit Log Immutability (BR-AUD-003)
CREATE TRIGGER trg_audit_logs_protect_bu BEFORE UPDATE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit logs are immutable and cannot be modified.'//
CREATE TRIGGER trg_audit_logs_protect_bd BEFORE DELETE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit logs are immutable and cannot be deleted.'//

DELIMITER ;

-- ── SECTION 5: ANALYTICAL ENGINE (6 VIEWS) ──

CREATE VIEW vw_billing_summary AS
SELECT
    b.billing_id,
    c.contract_id,
    b.billing_period_from,
    b.billing_period_to,
    b.due_date,
    b.status AS billing_status,
    t.tenant_id,
    CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
    r.room_code,
    bs.bed_label,
    (SELECT COALESCE(SUM(amount), 0) FROM billing_line_items WHERE billing_id = b.billing_id) AS total_amount,
    (SELECT COALESCE(SUM(amount_paid), 0) FROM payments WHERE billing_id = b.billing_id AND voided_at IS NULL AND payment_category = 'billing') AS total_paid
FROM billing b
JOIN contracts  c  ON b.contract_id  = c.contract_id
JOIN tenants    t  ON c.tenant_id    = t.tenant_id
JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
JOIN rooms      r  ON bs.room_id      = r.room_id;

CREATE VIEW vw_active_contracts AS
SELECT
    c.contract_id,
    t.tenant_id,
    CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
    t.contact_number,
    t.email,
    r.room_id,
    r.room_code,
    c.monthly_rate,
    c.deposit_amount,
    bs.bed_space_id,
    bs.bed_label,
    bs.status AS bed_status,
    c.move_in_date,
    c.expected_move_out_date
FROM contracts c
JOIN tenants    t  ON c.tenant_id    = t.tenant_id
JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
JOIN rooms      r  ON bs.room_id      = r.room_id
WHERE c.status     IN ('active', 'pending_payment') 
  AND c.deleted_at IS NULL;

CREATE VIEW vw_room_occupancy AS
SELECT
    r.room_id,
    r.room_code,
    r.capacity,
    r.room_type,
    r.status AS room_status,
    COUNT(bs.bed_space_id) AS total_beds,
    SUM(CASE WHEN bs.status = 'occupied' THEN 1 ELSE 0 END) AS occupied_beds,
    SUM(CASE WHEN bs.status = 'vacant' THEN 1 ELSE 0 END) AS vacant_beds
FROM rooms r
LEFT JOIN bed_spaces bs ON r.room_id = bs.room_id
WHERE r.deleted_at IS NULL
GROUP BY r.room_id, r.room_code, r.capacity, r.room_type, r.status;

CREATE VIEW vw_occupancy_status AS
SELECT
    bs.bed_space_id,
    bs.bed_label,
    bs.status AS bed_status,
    r.room_id,
    r.room_code,
    t.tenant_id,
    CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
    c.contract_id
FROM bed_spaces bs
JOIN rooms r ON bs.room_id = r.room_id
LEFT JOIN contracts c ON bs.bed_space_id = c.bed_space_id AND c.status IN ('active', 'pending_payment')
LEFT JOIN tenants t ON c.tenant_id = t.tenant_id
WHERE r.deleted_at IS NULL;

CREATE VIEW vw_collections_summary AS
SELECT
    p.payment_id,
    p.payment_date,
    p.amount_paid,
    p.payment_method,
    p.payment_category,
    p.reference_number,
    t.tenant_id,
    CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
    r.room_code,
    r.room_type,
    b.billing_id
FROM payments p
LEFT JOIN billing    b ON p.billing_id  = b.billing_id
LEFT JOIN contracts  c ON (p.billing_id = b.billing_id AND b.contract_id = c.contract_id) OR (p.contract_id = c.contract_id)
LEFT JOIN tenants    t ON c.tenant_id   = t.tenant_id
JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
JOIN rooms      r ON bs.room_id     = r.room_id
WHERE p.voided_at IS NULL;

CREATE VIEW vw_tenant_contract_history AS
SELECT
    c.contract_id,
    t.tenant_id,
    CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
    c.move_in_date,
    c.actual_move_out_date,
    c.status AS contract_status,
    r.room_code,
    bs.bed_label
FROM contracts c
JOIN tenants t ON c.tenant_id = t.tenant_id
JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
JOIN rooms r ON bs.room_id = r.room_id;

SET FOREIGN_KEY_CHECKS = 1;