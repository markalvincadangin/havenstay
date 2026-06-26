# HavenStay Testing Guide

This document outlines how to execute tests and verify functionality across the stack.

## Backend Tests (Laravel)

The backend relies heavily on automated PHPUnit tests, specifically testing business logic, audit constraints, and complex database transactions.

### Running Backend Tests

You can run the tests using standard artisan commands, or via the `Makefile` if using the Docker setup.

```bash
# Natively (Hybrid Dev Mode)
cd backend
php artisan test

# Via Docker Compose
make test-backend
```

### Key Test Areas
- **Metrology & Forensics:** Validates that the monotonic audit triggers prevent unauthorized record tampering.
- **Contract Management:** Validates complex start/end overlap logic for tenant contracts.
- **Reporting & Exports:** Validates the analytical SQL views.

## Frontend Tests (Next.js)

Frontend logic is verified using Vitest.

### Running Frontend Tests

```bash
# Natively (Hybrid Dev Mode)
cd frontend
npm test

# Via Docker Compose
make test-frontend
```

## End-to-End Validation

For full end-to-end verification, spin up the entire cluster (`make up`) and test the application manually via the browser (`http://localhost:3000`).

---

*Document Author: HavenStay Infrastructure*
