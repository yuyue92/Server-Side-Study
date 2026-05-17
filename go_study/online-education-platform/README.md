# Online Education Platform Backend

A directly runnable Go + Gin + GORM + SQLite backend skeleton for an online education platform.

## Implemented modules

- Configuration loading from environment variables
- SQLite database initialization
- GORM AutoMigrate for all core tables
- User registration and login
- JWT authentication and role-based authorization
- Teacher course creation
- Teacher chapter creation
- Student course enrollment
- Student learning progress update
- Student course progress query
- Public course listing and course detail query
- Integration test covering the full business flow

## Project start

```bash
go mod tidy
go run ./cmd/server
```

Default server address:

```text
http://127.0.0.1:8080
```

Health check:

```bash
curl http://127.0.0.1:8080/healthz
```

## Environment variables

| Variable | Default | Meaning |
|---|---:|---|
| APP_PORT | 8080 | HTTP server port |
| DB_PATH | data/education.db | SQLite database file |
| JWT_SECRET | change-me-in-production | JWT signing key |
| JWT_EXPIRE_HOURS | 24 | JWT expiration hours |

## Main APIs

### 1. Register teacher

```bash
curl -X POST http://127.0.0.1:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username":"teacher01",
    "email":"teacher01@example.com",
    "password":"secret123",
    "role":"teacher"
  }'
```

### 2. Register student

```bash
curl -X POST http://127.0.0.1:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username":"student01",
    "email":"student01@example.com",
    "password":"secret123",
    "role":"student"
  }'
```

### 3. Login

```bash
curl -X POST http://127.0.0.1:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"teacher01@example.com",
    "password":"secret123"
  }'
```

Copy the returned token for authenticated requests.

### 4. Teacher creates a course

```bash
curl -X POST http://127.0.0.1:8080/api/v1/teacher/courses \
  -H "Authorization: Bearer YOUR_TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Go Backend Foundations",
    "description":"Build RESTful services with Gin and GORM.",
    "category":"programming",
    "level":"beginner",
    "status":"published"
  }'
```

### 5. Teacher creates a chapter

```bash
curl -X POST http://127.0.0.1:8080/api/v1/teacher/courses/1/chapters \
  -H "Authorization: Bearer YOUR_TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Chapter 1 - HTTP Basics",
    "content":"Request and response lifecycle.",
    "duration_seconds":300,
    "sort_order":1,
    "is_preview":true
  }'
```

### 6. Student enrolls in a course

```bash
curl -X POST http://127.0.0.1:8080/api/v1/student/courses/1/enroll \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN"
```

### 7. Student updates learning progress

```bash
curl -X PUT http://127.0.0.1:8080/api/v1/student/progress \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "course_id":1,
    "chapter_id":1,
    "progress_percent":75,
    "watched_seconds":225,
    "last_position_seconds":225,
    "is_completed":false
  }'
```

### 8. Student queries course progress

```bash
curl http://127.0.0.1:8080/api/v1/student/courses/1/progress \
  -H "Authorization: Bearer YOUR_STUDENT_TOKEN"
```

## Verification

```bash
go test ./...
go build ./cmd/server
```

The integration test checks the full path:

1. Register teacher
2. Register student
3. Teacher creates course
4. Teacher creates chapter
5. Student enrolls
6. Student updates progress
7. Student queries progress summary
