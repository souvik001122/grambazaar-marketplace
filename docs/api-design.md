# API and Service Design

## Service Layers
- authService
- productService
- sellerService
- orderService
- reviewService
- notificationService
- adminService

## Design Principles
- Keep validation close to service boundaries
- Handle Appwrite schema constraints explicitly
- Return predictable typed payloads for UI layers

## Future Startup Readiness
- Add API gateway layer if backend expands
- Introduce observability metrics and error traces
- Prepare versioned contracts for external integrations
