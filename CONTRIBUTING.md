# Contributing to HavenStay BHMS

First off, thank you for considering contributing to HavenStay! It's people like you that make HavenStay such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md) (Standard Contributor Covenant).

## Getting Started

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally:
    ```bash
    git clone https://github.com/your-username/havenstay.git
    cd havenstay
    ```
3.  **Set up the environment**:
    - Follow the **Quickstart** guide in the [README.md](README.md).
    - Ensure you have PHP 8.3+ and Node.js 20+ installed.
4.  **Create a new branch** for your feature or bugfix:
    ```bash
    git checkout -b feature/your-feature-name
    # OR
    git checkout -b bugfix/issue-description
    ```

## Coding Standards

### Backend (Laravel)
- Follow [PSR-12](https://www.php-fig.org/psr/psr-12/) coding standards.
- Use strict typing where possible (`declare(strict_types=1);`).
- Business logic should reside in **Services**, keeping **Controllers** thin.
- All transactional writes must include audit context via `AuditService::setAuditUserContext()`.
- Follow `docs/BACKEND_CODING_BLUEPRINT.md` as the backend implementation standard.
- For authorization deny responses, use `HandlesAuthorization` helpers in API controllers:
  - `forbidden(...)` for JSON endpoints.
  - `forbiddenExport(...)` for export endpoints.
- Avoid direct `AuditService::logAccessDenied(...)` in controllers that already use the helper trait.

### Frontend (Next.js)
- Use functional components and React Hooks.
- Follow the existing component structure in `frontend/src/app/_components/`.
- Use Tailwind CSS for styling.
- **Forensic UX**: All loading states must use structural Skeletons instead of generic Spinners.
- Ensure all components are responsive and accessible.

## Git Workflow

- **Small PRs**: Keeping pull requests small makes them easier to review and less likely to introduce bugs.
- **Commit Messages**: Use clear, descriptive commit messages (e.g., `feat: add tenant search filtering` or `fix: resolve billing rounding error`).
- **Sync with Upstream**: Regularly pull the latest changes from the main repository to avoid complex merge conflicts.

## Testing

Before submitting a pull request, ensure all tests pass:

### Backend
```bash
cd backend
php artisan test
```

Recommended targeted quality gates for backend convention compliance:

```bash
cd backend
php artisan test --filter=ControllerAuthorizationConsistencyTest
php artisan test --filter=TenantArchitectureConventionTest
php artisan test --filter=RoomArchitectureConventionTest
php artisan test --filter=ContractArchitectureConventionTest
php artisan test --filter=BillingPaymentArchitectureConventionTest
php artisan test --filter=ReportingSecurityConventionTest
```

### Frontend
```bash
cd frontend
npm run lint
npm run build
```

## Submitting a Pull Request

1.  Push your changes to your fork.
2.  Submit a Pull Request to the `main` branch of the official repository.
3.  Provide a clear description of the changes and link any related issues.
4.  Wait for review and address any feedback.

---

Thank you for your contribution!
