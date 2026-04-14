# Changelog

All notable changes to the Bloomberg Terminal project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Complete project architecture and monorepo scaffold
- CLAUDE.md — AI coding rules governing all code generation
- Docker Compose stack: PostgreSQL 16, ClickHouse, Redis 7 Stack
- FastAPI application factory with CORS, request ID middleware
- Celery worker with Beat schedule for all ingestion tasks
- Node.js WebSocket gateway (Fastify)
- React SPA shell (blank terminal screen, Phase 0)
- Shared TypeScript types package (`@terminal/types`)
- CI/CD pipeline (GitHub Actions): typecheck, lint, test, security audit
- Architecture Decision Records: ADR-001, ADR-002, ADR-003
- Runbooks: adding data source, adding UI panel, plugin development
- `.env.example` with all 40+ environment variables documented
- Base integration client with retry/backoff for all external APIs
- Centralized cache key constants

---

## [0.0.1] — 2026-04-13

### Added
- Initial repository with placeholder README
