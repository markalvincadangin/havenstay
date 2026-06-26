-- HavenStay Boarding House Management System

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- DROP ALL OBJECTS

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

-- CORE OPERATIONAL ENTITIES (14 TABLES)

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
    google_id     VARCHAR(255) NULL,
    avatar_url    VARCHAR(255) NULL,
    oauth_provider VARCHAR(50) NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at    DATETIME NULL,
    -- Uniqueness (allows re-registration after soft-delete)
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
    status                   ENUM('onboarded','active','moved_out','archived') DEFAULT 'onboarded',
    created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at               DATETIME NULL,
    -- Uniqueness (allows re-registration after soft-delete)
    active_email VARCHAR(150) GENERATED ALWAYS AS (CASE WHEN deleted_at IS NULL THEN email ELSE NULL END) VIRTUAL,
    UNIQUE KEY uq_active_tenant_email (active_email),
    INDEX idx_tenant_name (last_name, first_name),
    INDEX idx_tenant_status (status)
) ENGINE=InnoDB;

CREATE TABLE rooms (
    room_id      INT AUTO_INCREMENT PRIMARY KEY,
    room_code    VARCHAR(20)   NOT NULL,
    room_type    ENUM('private','shared') DEFAULT 'private',
    capacity     INT           DEFAULT 1,
    monthly_rate DECIMAL(10,2) NOT NULL,
    status       ENUM('available','unavailable','maintenance','decommissioned') DEFAULT 'available',
    amenities    TEXT          NULL,
    description  TEXT          NULL,
    is_metered   TINYINT(1)    DEFAULT 1,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL,
    UNIQUE KEY uq_room_code (room_code),
    CONSTRAINT chk_room_capacity CHECK (capacity >= 1),
    CONSTRAINT chk_room_rate     CHECK (monthly_rate >= 0),
    INDEX idx_room_status (status),
    INDEX idx_room_type (room_type)
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
    idempotency_key        VARCHAR(255) NULL,
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at             DATETIME NULL,
    UNIQUE KEY uq_contracts_idempotency (idempotency_key),
    CONSTRAINT fk_contract_tenant FOREIGN KEY (tenant_id)    REFERENCES tenants    (tenant_id),
    CONSTRAINT fk_contract_bed    FOREIGN KEY (bed_space_id) REFERENCES bed_spaces (bed_space_id),
    CONSTRAINT fk_contract_owner  FOREIGN KEY (created_by)   REFERENCES users      (user_id),
    CONSTRAINT chk_contract_dates CHECK (move_in_date < expected_move_out_date OR expected_move_out_date IS NULL),
    INDEX idx_contract_status (status),
    INDEX idx_contract_dates (move_in_date),
    INDEX idx_contract_expiry (expected_move_out_date)
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
    UNIQUE KEY uq_meter_reading_forensic (meter_id, reading_date, reading_value),
    INDEX idx_reading_forensic (meter_id, reading_date DESC),
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
    idempotency_key     VARCHAR(255) NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_billing_cycle (contract_id, billing_period_from, billing_period_to),
    UNIQUE KEY uq_billing_idempotency (idempotency_key),
    INDEX idx_billing_status_due (status, due_date),
    INDEX idx_billing_due (due_date),
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
    idempotency_key  VARCHAR(255)  NULL,
    created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_payments_idempotency (idempotency_key),
    INDEX idx_payment_date (payment_date),
    INDEX idx_payment_category (payment_category),
    INDEX idx_payment_method (payment_method),
    CONSTRAINT fk_pay_billing  FOREIGN KEY (billing_id)   REFERENCES billing (billing_id),
    CONSTRAINT fk_pay_contract FOREIGN KEY (contract_id)  REFERENCES contracts (contract_id),
    CONSTRAINT fk_pay_actor    FOREIGN KEY (processed_by) REFERENCES users   (user_id),
    CONSTRAINT fk_pay_voider   FOREIGN KEY (voided_by)    REFERENCES users   (user_id),
    CONSTRAINT chk_pay_amount       CHECK (amount_paid > 0),
    CONSTRAINT chk_pay_target       CHECK (
        (billing_id IS NOT NULL AND contract_id IS NULL) OR
        (billing_id IS NULL AND contract_id IS NOT NULL)
    ),
    CONSTRAINT chk_pay_ref_required CHECK (
        payment_method NOT IN ('gcash', 'bank_transfer') OR reference_number IS NOT NULL
    )
) ENGINE=InnoDB;

-- AUDIT LOGS TABLE

CREATE TABLE audit_logs (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    action         ENUM('CREATE','UPDATE','DELETE','SOFT_DELETE','RESTORE','LOGIN','LOGOUT','FAILED_LOGIN','VOID','SYSTEM','SECURITY','EXPORT','ACCESS_DENIED') NOT NULL,
    event_category ENUM('AUTH','DATA','FINANCIAL','SYSTEM','SECURITY') NOT NULL DEFAULT 'DATA',
    target_table   VARCHAR(64)     NOT NULL,
    record_id      BIGINT UNSIGNED NOT NULL,
    old_value      JSON            NULL,
    new_value      JSON            NULL,
    changed_fields JSON            NULL,
    is_success     BOOLEAN         DEFAULT TRUE,
    error_message  TEXT            NULL,
    changed_by     INT             NULL,
    actor_snapshot JSON            NULL,
    correlation_id VARCHAR(64)     NULL,
    request_id     VARCHAR(64)     NULL,
    ip_address     VARCHAR(45)     NULL,
    user_agent     TEXT            NULL,
    endpoint       TEXT            NULL,
    http_method    VARCHAR(10)     NULL,
    execution_time_ms INT          NULL,
    metadata          JSON         NULL,
    changed_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_resource_history (target_table, record_id, changed_at),
    INDEX idx_audit_timestamp (changed_at),
    INDEX idx_audit_resource  (target_table, record_id),
    INDEX idx_audit_action    (action),
    INDEX idx_audit_category  (event_category),
    INDEX idx_audit_correlation (correlation_id),
    INDEX idx_audit_request     (request_id)
) ENGINE=InnoDB;

-- REFERENCE DATA

INSERT INTO roles (role_id, role_name, description) VALUES
(1, 'admin',  'System Administrator'),
(2, 'staff',  'Operator'),
(3, 'viewer', 'Read-Only');

INSERT INTO utilities (utility_id, name, unit_of_measurement) VALUES
(1, 'Electricity', 'kWh'),
(2, 'Water', 'm3');

-- AUDIT TRIGGERS

DELIMITER //

-- Roles
CREATE TRIGGER trg_roles_ai AFTER INSERT ON roles FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('CREATE', 'DATA', 'roles', NEW.role_id, JSON_OBJECT('name', NEW.role_name), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_roles_au AFTER UPDATE ON roles FOR EACH ROW 
BEGIN
    IF NOT (OLD.role_name <=> NEW.role_name) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'DATA', 'roles', NEW.role_id, JSON_OBJECT('name', OLD.role_name), JSON_OBJECT('name', NEW.role_name), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_roles_ad AFTER DELETE ON roles FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'DATA', 'roles', OLD.role_id, JSON_OBJECT('name', OLD.role_name), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Users
CREATE TRIGGER trg_users_ai AFTER INSERT ON users FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('CREATE', 'AUTH', 'users', NEW.user_id, JSON_OBJECT('user', NEW.username, 'first', NEW.first_name, 'last', NEW.last_name, 'email', NEW.email, 'role', NEW.role_id, 'active', NEW.is_active), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_users_au AFTER UPDATE ON users FOR EACH ROW 
BEGIN
    IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('SOFT_DELETE', 'AUTH', 'users', NEW.user_id, 
            JSON_OBJECT('user', OLD.username, 'first', OLD.first_name, 'last', OLD.last_name, 'email', OLD.email, 'role', OLD.role_id, 'active', OLD.is_active, 'deleted_at', OLD.deleted_at),
            JSON_OBJECT('user', NEW.username, 'deleted_at', NEW.deleted_at), 
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('RESTORE', 'AUTH', 'users', NEW.user_id, 
            JSON_OBJECT('user', OLD.username, 'deleted_at', OLD.deleted_at),
            JSON_OBJECT('user', NEW.username, 'first', NEW.first_name, 'last', NEW.last_name, 'email', NEW.email, 'role', NEW.role_id, 'active', NEW.is_active, 'deleted_at', NEW.deleted_at), 
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF NOT (OLD.username <=> NEW.username) OR NOT (OLD.role_id <=> NEW.role_id) OR NOT (OLD.is_active <=> NEW.is_active) OR NOT (OLD.first_name <=> NEW.first_name) OR NOT (OLD.last_name <=> NEW.last_name) OR NOT (OLD.email <=> NEW.email) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'AUTH', 'users', NEW.user_id, 
            JSON_OBJECT('user', OLD.username, 'first', OLD.first_name, 'last', OLD.last_name, 'email', OLD.email, 'role', OLD.role_id, 'active', OLD.is_active), 
            JSON_OBJECT('user', NEW.username, 'first', NEW.first_name, 'last', NEW.last_name, 'email', NEW.email, 'role', NEW.role_id, 'active', NEW.is_active), 
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_users_ad AFTER DELETE ON users FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'AUTH', 'users', OLD.user_id, JSON_OBJECT('user', OLD.username), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Tenants
CREATE TRIGGER trg_tenants_ai AFTER INSERT ON tenants FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('CREATE', 'DATA', 'tenants', NEW.tenant_id, JSON_OBJECT('first', NEW.first_name, 'last', NEW.last_name, 'email', NEW.email, 'phone', NEW.contact_number, 'status', NEW.status), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_tenants_au AFTER UPDATE ON tenants FOR EACH ROW 
BEGIN
    IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('SOFT_DELETE', 'DATA', 'tenants', NEW.tenant_id, 
            JSON_OBJECT('first', OLD.first_name, 'last', OLD.last_name, 'email', OLD.email, 'phone', OLD.contact_number, 'status', OLD.status, 'deleted_at', OLD.deleted_at),
            JSON_OBJECT('last', NEW.last_name, 'deleted_at', NEW.deleted_at),
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('RESTORE', 'DATA', 'tenants', NEW.tenant_id, 
            JSON_OBJECT('last', OLD.last_name, 'deleted_at', OLD.deleted_at),
            JSON_OBJECT('first', NEW.first_name, 'last', NEW.last_name, 'email', NEW.email, 'phone', NEW.contact_number, 'status', NEW.status, 'deleted_at', NEW.deleted_at),
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF NOT (OLD.first_name <=> NEW.first_name) OR NOT (OLD.last_name <=> NEW.last_name) OR NOT (OLD.email <=> NEW.email) OR NOT (OLD.status <=> NEW.status) OR NOT (OLD.contact_number <=> NEW.contact_number) OR NOT (OLD.emergency_contact_number <=> NEW.emergency_contact_number) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'DATA', 'tenants', NEW.tenant_id, 
            JSON_OBJECT('first', OLD.first_name, 'last', OLD.last_name, 'email', OLD.email, 'phone', OLD.contact_number, 'status', OLD.status), 
            JSON_OBJECT('first', NEW.first_name, 'last', NEW.last_name, 'email', NEW.email, 'phone', NEW.contact_number, 'status', NEW.status), 
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_tenants_ad AFTER DELETE ON tenants FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'DATA', 'tenants', OLD.tenant_id, JSON_OBJECT('first', OLD.first_name, 'last', OLD.last_name), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Rooms
CREATE TRIGGER trg_rooms_ai AFTER INSERT ON rooms FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('CREATE', 'DATA', 'rooms', NEW.room_id, JSON_OBJECT('code', NEW.room_code, 'type', NEW.room_type, 'cap', NEW.capacity, 'rate', NEW.monthly_rate, 'status', NEW.status, 'metered', NEW.is_metered), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_rooms_au AFTER UPDATE ON rooms FOR EACH ROW 
BEGIN
    IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('SOFT_DELETE', 'SYSTEM', 'rooms', NEW.room_id, 
            JSON_OBJECT('code', OLD.room_code, 'type', OLD.room_type, 'status', OLD.status, 'rate', OLD.monthly_rate, 'deleted_at', OLD.deleted_at),
            JSON_OBJECT('code', NEW.room_code, 'deleted_at', NEW.deleted_at),
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('RESTORE', 'SYSTEM', 'rooms', NEW.room_id, 
            JSON_OBJECT('code', OLD.room_code, 'deleted_at', OLD.deleted_at),
            JSON_OBJECT('code', NEW.room_code, 'type', NEW.room_type, 'status', NEW.status, 'rate', NEW.monthly_rate, 'deleted_at', NEW.deleted_at),
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF NOT (OLD.room_code <=> NEW.room_code) OR NOT (OLD.room_type <=> NEW.room_type) OR NOT (OLD.status <=> NEW.status) OR NOT (OLD.monthly_rate <=> NEW.monthly_rate) OR NOT (OLD.capacity <=> NEW.capacity) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'SYSTEM', 'rooms', NEW.room_id, 
            JSON_OBJECT('code', OLD.room_code, 'type', OLD.room_type, 'status', OLD.status, 'rate', OLD.monthly_rate), 
            JSON_OBJECT('code', NEW.room_code, 'type', NEW.room_type, 'status', NEW.status, 'rate', NEW.monthly_rate), 
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_rooms_ad AFTER DELETE ON rooms FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'DATA', 'rooms', OLD.room_id, JSON_OBJECT('code', OLD.room_code), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Bed Spaces
CREATE TRIGGER trg_bed_spaces_ai AFTER INSERT ON bed_spaces FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('CREATE', 'DATA', 'bed_spaces', NEW.bed_space_id, JSON_OBJECT('room_id', NEW.room_id, 'bed_label', NEW.bed_label, 'status', NEW.status), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_bed_spaces_au AFTER UPDATE ON bed_spaces FOR EACH ROW 
BEGIN
    IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('SOFT_DELETE', 'DATA', 'bed_spaces', NEW.bed_space_id, 
            JSON_OBJECT('room', OLD.room_id, 'label', OLD.bed_label, 'status', OLD.status, 'deleted_at', OLD.deleted_at),
            JSON_OBJECT('label', NEW.bed_label, 'deleted_at', NEW.deleted_at),
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('RESTORE', 'DATA', 'bed_spaces', NEW.bed_space_id, 
            JSON_OBJECT('label', OLD.bed_label, 'deleted_at', OLD.deleted_at),
            JSON_OBJECT('room', NEW.room_id, 'label', NEW.bed_label, 'status', NEW.status, 'deleted_at', NEW.deleted_at),
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF NOT (OLD.status <=> NEW.status) OR NOT (OLD.room_id <=> NEW.room_id) OR NOT (OLD.bed_label <=> NEW.bed_label) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'DATA', 'bed_spaces', NEW.bed_space_id, 
            JSON_OBJECT('room_id', OLD.room_id, 'bed_label', OLD.bed_label, 'status', OLD.status), 
            JSON_OBJECT('room_id', NEW.room_id, 'bed_label', NEW.bed_label, 'status', NEW.status), 
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_bed_spaces_ad AFTER DELETE ON bed_spaces FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'DATA', 'bed_spaces', OLD.bed_space_id, JSON_OBJECT('label', OLD.bed_label), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Contracts
CREATE TRIGGER trg_contracts_ai AFTER INSERT ON contracts FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, ip_address, request_id, endpoint, http_method) VALUES ('CREATE', 'DATA', 'contracts', NEW.contract_id, JSON_OBJECT('tenant_id', NEW.tenant_id, 'bed_space_id', NEW.bed_space_id, 'type', NEW.contract_type, 'rate', NEW.monthly_rate, 'status', NEW.status, 'move_in', NEW.move_in_date), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_contracts_au AFTER UPDATE ON contracts FOR EACH ROW 
BEGIN
    IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('SOFT_DELETE', 'DATA', 'contracts', NEW.contract_id, 
            JSON_OBJECT('tenant', OLD.tenant_id, 'bed', OLD.bed_space_id, 'status', OLD.status, 'deleted_at', OLD.deleted_at),
            JSON_OBJECT('contract', NEW.contract_id, 'deleted_at', NEW.deleted_at),
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('RESTORE', 'DATA', 'contracts', NEW.contract_id, 
            JSON_OBJECT('contract', OLD.contract_id, 'deleted_at', OLD.deleted_at),
            JSON_OBJECT('tenant', NEW.tenant_id, 'bed', NEW.bed_space_id, 'status', NEW.status, 'deleted_at', NEW.deleted_at),
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF NOT (OLD.status <=> NEW.status) OR NOT (OLD.monthly_rate <=> NEW.monthly_rate) OR NOT (OLD.monthly_rate_override <=> NEW.monthly_rate_override) OR NOT (OLD.is_cleared <=> NEW.is_cleared) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'DATA', 'contracts', NEW.contract_id, JSON_OBJECT('status', OLD.status, 'rate', OLD.monthly_rate, 'override', OLD.monthly_rate_override, 'cleared', OLD.is_cleared), JSON_OBJECT('status', NEW.status, 'rate', NEW.monthly_rate, 'override', NEW.monthly_rate_override, 'cleared', NEW.is_cleared), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_contracts_ad AFTER DELETE ON contracts FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'DATA', 'contracts', OLD.contract_id, JSON_OBJECT('tenant', OLD.tenant_id), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Utilities
CREATE TRIGGER trg_utilities_ai AFTER INSERT ON utilities FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('CREATE', 'DATA', 'utilities', NEW.utility_id, JSON_OBJECT('name', NEW.name), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_utilities_au AFTER UPDATE ON utilities FOR EACH ROW 
BEGIN
    IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('SOFT_DELETE', 'DATA', 'utilities', NEW.utility_id, JSON_OBJECT('name', OLD.name, 'deleted_at', OLD.deleted_at), JSON_OBJECT('name', NEW.name, 'deleted_at', NEW.deleted_at), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('RESTORE', 'DATA', 'utilities', NEW.utility_id, JSON_OBJECT('name', OLD.name, 'deleted_at', OLD.deleted_at), JSON_OBJECT('name', NEW.name, 'deleted_at', NEW.deleted_at), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF NOT (OLD.name <=> NEW.name) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'DATA', 'utilities', NEW.utility_id, JSON_OBJECT('name', OLD.name), JSON_OBJECT('name', NEW.name), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_utilities_ad AFTER DELETE ON utilities FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'DATA', 'utilities', OLD.utility_id, JSON_OBJECT('name', OLD.name), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Meters
CREATE TRIGGER trg_meters_ai AFTER INSERT ON meters FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('CREATE', 'DATA', 'meters', NEW.meter_id, JSON_OBJECT('serial_number', NEW.serial_number, 'utility_id', NEW.utility_id, 'status', NEW.status), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_meters_au AFTER UPDATE ON meters FOR EACH ROW 
BEGIN
    IF NOT (OLD.serial_number <=> NEW.serial_number) OR NOT (OLD.status <=> NEW.status) OR NOT (OLD.utility_id <=> NEW.utility_id) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'DATA', 'meters', NEW.meter_id, 
            JSON_OBJECT('serial_number', OLD.serial_number, 'utility_id', OLD.utility_id, 'status', OLD.status), 
            JSON_OBJECT('serial_number', NEW.serial_number, 'utility_id', NEW.utility_id, 'status', NEW.status), 
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_meters_ad AFTER DELETE ON meters FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'DATA', 'meters', OLD.meter_id, JSON_OBJECT('sn', OLD.serial_number), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Meter Assignments
CREATE TRIGGER trg_meter_assignments_ai AFTER INSERT ON meter_assignments FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('CREATE', 'DATA', 'meter_assignments', NEW.assignment_id, JSON_OBJECT('room_id', NEW.room_id, 'meter_id', NEW.meter_id, 'valid_from', NEW.valid_from), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_meter_assignments_au AFTER UPDATE ON meter_assignments FOR EACH ROW 
BEGIN
    IF NOT (OLD.room_id <=> NEW.room_id) OR NOT (OLD.meter_id <=> NEW.meter_id) OR NOT (OLD.valid_to <=> NEW.valid_to) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'DATA', 'meter_assignments', NEW.assignment_id, 
            JSON_OBJECT('room_id', OLD.room_id, 'meter_id', OLD.meter_id, 'valid_to', OLD.valid_to), 
            JSON_OBJECT('room_id', NEW.room_id, 'meter_id', NEW.meter_id, 'valid_to', NEW.valid_to), 
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_meter_assignments_ad AFTER DELETE ON meter_assignments FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'DATA', 'meter_assignments', OLD.assignment_id, JSON_OBJECT('room', OLD.room_id, 'mtr', OLD.meter_id), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
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
CREATE TRIGGER trg_meter_readings_ai AFTER INSERT ON meter_readings FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('CREATE', 'DATA', 'meter_readings', NEW.reading_id, JSON_OBJECT('val', NEW.reading_value, 'date', NEW.reading_date, 'mtr', NEW.meter_id), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_meter_readings_au AFTER UPDATE ON meter_readings FOR EACH ROW 
BEGIN
    IF NOT (OLD.reading_value <=> NEW.reading_value) OR NOT (OLD.reading_date <=> NEW.reading_date) OR NOT (OLD.is_rollover <=> NEW.is_rollover) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'DATA', 'meter_readings', NEW.reading_id, JSON_OBJECT('val', OLD.reading_value, 'date', OLD.reading_date, 'rollover', OLD.is_rollover), JSON_OBJECT('val', NEW.reading_value, 'date', NEW.reading_date, 'rollover', NEW.is_rollover), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_meter_readings_ad AFTER DELETE ON meter_readings FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'DATA', 'meter_readings', OLD.reading_id, JSON_OBJECT('date', OLD.reading_date, 'mtr', OLD.meter_id), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Utility Rates
CREATE TRIGGER trg_utility_rates_ai AFTER INSERT ON utility_rates FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('CREATE', 'FINANCIAL', 'utility_rates', NEW.rate_id, JSON_OBJECT('rate', NEW.base_rate, 'util', NEW.utility_id, 'from', NEW.effective_from), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_utility_rates_au AFTER UPDATE ON utility_rates FOR EACH ROW 
BEGIN
    IF NOT (OLD.base_rate <=> NEW.base_rate) OR NOT (OLD.effective_from <=> NEW.effective_from) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'FINANCIAL', 'utility_rates', NEW.rate_id, JSON_OBJECT('rate', OLD.base_rate, 'from', OLD.effective_from), JSON_OBJECT('rate', NEW.base_rate, 'from', NEW.effective_from), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_utility_rates_ad AFTER DELETE ON utility_rates FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'FINANCIAL', 'utility_rates', OLD.rate_id, JSON_OBJECT('utility', OLD.utility_id), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Billing
CREATE TRIGGER trg_billing_ai AFTER INSERT ON billing FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('CREATE', 'FINANCIAL', 'billing', NEW.billing_id, JSON_OBJECT('contract', NEW.contract_id, 'from', NEW.billing_period_from, 'to', NEW.billing_period_to, 'due', NEW.due_date, 'status', NEW.status), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_billing_au AFTER UPDATE ON billing FOR EACH ROW 
BEGIN
    IF NOT (OLD.status <=> NEW.status) OR NOT (OLD.due_date <=> NEW.due_date) OR NOT (OLD.billing_period_from <=> NEW.billing_period_from) OR NOT (OLD.billing_period_to <=> NEW.billing_period_to) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'FINANCIAL', 'billing', NEW.billing_id, JSON_OBJECT('status', OLD.status, 'due', OLD.due_date, 'from', OLD.billing_period_from, 'to', OLD.billing_period_to), JSON_OBJECT('status', NEW.status, 'due', NEW.due_date, 'from', NEW.billing_period_from, 'to', NEW.billing_period_to), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_billing_ad AFTER DELETE ON billing FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'FINANCIAL', 'billing', OLD.billing_id, JSON_OBJECT('contract', OLD.contract_id), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Payments
CREATE TRIGGER trg_payments_ai AFTER INSERT ON payments FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, ip_address, request_id, endpoint, http_method) VALUES ('CREATE', 'FINANCIAL', 'payments', NEW.payment_id, JSON_OBJECT('amt', NEW.amount_paid, 'meth', NEW.payment_method, 'ref', NEW.reference_number, 'bill', NEW.billing_id, 'contract', NEW.contract_id, 'date', NEW.payment_date, 'category', NEW.payment_category), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_payments_au AFTER UPDATE ON payments FOR EACH ROW 
BEGIN
    IF (OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('VOID', 'FINANCIAL', 'payments', NEW.payment_id, JSON_OBJECT('voided', OLD.voided_at), JSON_OBJECT('voided', NEW.voided_at, 'reason', NEW.void_reason, 'by', NEW.voided_by), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    ELSEIF NOT (OLD.amount_paid <=> NEW.amount_paid) OR NOT (OLD.payment_date <=> NEW.payment_date) OR NOT (OLD.payment_method <=> NEW.payment_method) OR NOT (OLD.reference_number <=> NEW.reference_number) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'FINANCIAL', 'payments', NEW.payment_id, 
            JSON_OBJECT('amt', OLD.amount_paid, 'date', OLD.payment_date, 'meth', OLD.payment_method, 'ref', OLD.reference_number), 
            JSON_OBJECT('amt', NEW.amount_paid, 'date', NEW.payment_date, 'meth', NEW.payment_method, 'ref', NEW.reference_number), 
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_payments_ad AFTER DELETE ON payments FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'FINANCIAL', 'payments', OLD.payment_id, JSON_OBJECT('amt', OLD.amount_paid, 'ref', OLD.reference_number), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Billing Line Items
CREATE TRIGGER trg_billing_line_items_ai AFTER INSERT ON billing_line_items FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('CREATE', 'FINANCIAL', 'billing_line_items', NEW.line_item_id, JSON_OBJECT('billing_id', NEW.billing_id, 'type', NEW.item_type, 'amount', NEW.amount, 'description', NEW.item_description), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//
CREATE TRIGGER trg_billing_line_items_au AFTER UPDATE ON billing_line_items FOR EACH ROW 
BEGIN
    IF NOT (OLD.item_type <=> NEW.item_type) OR NOT (OLD.amount <=> NEW.amount) OR NOT (OLD.item_description <=> NEW.item_description) THEN
        INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, new_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) 
        VALUES ('UPDATE', 'FINANCIAL', 'billing_line_items', NEW.line_item_id, 
            JSON_OBJECT('type', OLD.item_type, 'amount', OLD.amount, 'description', OLD.item_description), 
            JSON_OBJECT('type', NEW.item_type, 'amount', NEW.amount, 'description', NEW.item_description), 
            JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')));
    END IF;
END//
CREATE TRIGGER trg_billing_line_items_ad AFTER DELETE ON billing_line_items FOR EACH ROW INSERT INTO audit_logs(action, event_category, target_table, record_id, old_value, changed_by, correlation_id, request_id, ip_address, endpoint, http_method) VALUES ('DELETE', 'FINANCIAL', 'billing_line_items', OLD.line_item_id, JSON_OBJECT('type', OLD.item_type, 'amt', OLD.amount), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.u')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.c')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.r')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.i')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.e')), JSON_UNQUOTE(JSON_EXTRACT(@forensic_context, '$.m')))//

-- Audit Log Immutability (BR-AUD-003)
CREATE TRIGGER trg_audit_logs_protect_bu BEFORE UPDATE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit logs are immutable and cannot be modified.'//
CREATE TRIGGER trg_audit_logs_protect_bd BEFORE DELETE ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit logs are immutable and cannot be deleted.'//

DELIMITER ;

-- ANALYTICAL ENGINE

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
        agg_bli.total_amount,
        agg_pay.total_paid
    FROM billing b
    JOIN contracts  c  ON b.contract_id  = c.contract_id
    JOIN tenants    t  ON c.tenant_id    = t.tenant_id
    JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
    JOIN rooms      r  ON bs.room_id      = r.room_id
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount), 0) AS total_amount 
        FROM billing_line_items 
        WHERE billing_id = b.billing_id
    ) AS agg_bli ON TRUE
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount_paid), 0) AS total_paid 
        FROM payments 
        WHERE billing_id = b.billing_id AND voided_at IS NULL
    ) AS agg_pay ON TRUE;

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
    c.status AS contract_status,
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
    stats.total_beds,
    stats.occupied_beds,
    stats.vacant_beds,
    stats.maintenance_beds
FROM rooms r
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) AS total_beds,
        SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occupied_beds,
        SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) AS vacant_beds,
        SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance_beds
    FROM bed_spaces 
    WHERE room_id = r.room_id
) AS stats ON TRUE
WHERE r.deleted_at IS NULL AND r.status != 'decommissioned';

CREATE VIEW vw_occupancy_status AS
SELECT
    bs.bed_space_id,
    bs.bed_label,
    bs.status AS bed_status,
    r.room_id,
    r.room_code,
    t.tenant_id,
    CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
    c.contract_id,
    c.deposit_amount
FROM bed_spaces bs
JOIN rooms r ON bs.room_id = r.room_id
LEFT JOIN contracts c ON bs.bed_space_id = c.bed_space_id AND c.status IN ('active', 'pending_payment')
LEFT JOIN tenants t ON c.tenant_id = t.tenant_id
WHERE r.deleted_at IS NULL AND r.status != 'decommissioned';

CREATE VIEW vw_collections_summary AS
-- Path 1: Payments linked directly to a contract (e.g. Security Deposits)
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
    p.billing_id
FROM payments p
JOIN contracts c ON p.contract_id = c.contract_id
JOIN tenants t ON c.tenant_id = t.tenant_id
JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
JOIN rooms r ON bs.room_id = r.room_id
WHERE p.voided_at IS NULL AND p.contract_id IS NOT NULL

UNION ALL

-- Path 2: Payments linked to a billing cycle (e.g. Monthly Rent)
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
    p.billing_id
FROM payments p
JOIN billing b ON p.billing_id = b.billing_id
JOIN contracts c ON b.contract_id = c.contract_id
JOIN tenants t ON c.tenant_id = t.tenant_id
JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
JOIN rooms r ON bs.room_id = r.room_id
WHERE p.voided_at IS NULL AND p.contract_id IS NULL AND p.billing_id IS NOT NULL;

CREATE VIEW vw_tenant_contract_history AS
SELECT
    c.contract_id,
    t.tenant_id,
    t.email,
    CONCAT(t.last_name, ', ', t.first_name) AS tenant_name,
    c.move_in_date,
    c.actual_move_out_date AS move_out_date,
    c.status AS status,
    c.is_cleared,
    r.room_id,
    r.room_code AS room_label,
    bs.bed_space_id,
    bs.bed_label
FROM contracts c
JOIN tenants t ON c.tenant_id = t.tenant_id
JOIN bed_spaces bs ON c.bed_space_id = bs.bed_space_id
JOIN rooms r ON bs.room_id = r.room_id;

SET FOREIGN_KEY_CHECKS = 1;