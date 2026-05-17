package router

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"online-education-platform/internal/config"
	"online-education-platform/internal/database"

	"github.com/gin-gonic/gin"
)

type apiResponse struct {
	Code int             `json:"code"`
	Data json.RawMessage `json:"data"`
}

type authData struct {
	Token string `json:"token"`
	User  struct {
		ID uint `json:"id"`
	} `json:"user"`
}

type courseData struct {
	ID uint `json:"id"`
}

type chapterData struct {
	ID uint `json:"id"`
}

func TestFullEducationFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	dbPath := filepath.Join(t.TempDir(), "test.db")
	db, err := database.Init(dbPath)
	if err != nil {
		t.Fatalf("database init: %v", err)
	}

	cfg := &config.Config{
		ServerPort:     "0",
		DatabasePath:   dbPath,
		JWTSecret:      "test-secret",
		JWTExpireHours: 24,
	}
	engine := Setup(db, cfg)

	teacherToken := registerAndGetToken(t, engine, map[string]any{
		"username": "teacher_01",
		"email":    "teacher@example.com",
		"password": "secret123",
		"role":     "teacher",
	})

	studentToken := registerAndGetToken(t, engine, map[string]any{
		"username": "student_01",
		"email":    "student@example.com",
		"password": "secret123",
		"role":     "student",
	})

	course := postAuthorized[courseData](t, engine, "/api/v1/teacher/courses", teacherToken, map[string]any{
		"title":       "Go Backend Foundations",
		"description": "A course created by integration test",
		"category":    "programming",
		"level":       "beginner",
		"status":      "published",
	}, http.StatusCreated)

	chapter := postAuthorized[chapterData](t, engine, "/api/v1/teacher/courses/"+itoa(course.ID)+"/chapters", teacherToken, map[string]any{
		"title":            "Chapter 1 - HTTP Basics",
		"content":          "Request and response",
		"duration_seconds": 300,
		"sort_order":       1,
		"is_preview":       true,
	}, http.StatusCreated)

	postAuthorized[map[string]any](t, engine, "/api/v1/student/courses/"+itoa(course.ID)+"/enroll", studentToken, map[string]any{}, http.StatusCreated)

	putAuthorized[map[string]any](t, engine, "/api/v1/student/progress", studentToken, map[string]any{
		"course_id":             course.ID,
		"chapter_id":            chapter.ID,
		"progress_percent":      100,
		"watched_seconds":       300,
		"last_position_seconds": 300,
		"is_completed":          true,
	}, http.StatusOK)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/student/courses/"+itoa(course.ID)+"/progress", nil)
	req.Header.Set("Authorization", "Bearer "+studentToken)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("progress query status = %d, body=%s", rec.Code, rec.Body.String())
	}

	var response struct {
		Code int `json:"code"`
		Data struct {
			TotalChapters     int64   `json:"total_chapters"`
			CompletedChapters int64   `json:"completed_chapters"`
			AveragePercent    float64 `json:"average_percent"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode progress response: %v", err)
	}

	if response.Data.TotalChapters != 1 || response.Data.CompletedChapters != 1 || response.Data.AveragePercent != 100 {
		t.Fatalf("unexpected progress summary: %+v", response.Data)
	}
}

func registerAndGetToken(t *testing.T, engine http.Handler, body map[string]any) string {
	t.Helper()
	data := postJSON(t, engine, "/api/v1/auth/register", body, http.StatusCreated, "")
	var auth authData
	if err := json.Unmarshal(data, &auth); err != nil {
		t.Fatalf("decode auth data: %v", err)
	}
	if auth.Token == "" {
		t.Fatal("expected non-empty token")
	}
	return auth.Token
}

func postAuthorized[T any](t *testing.T, engine http.Handler, path, token string, body map[string]any, wantStatus int) T {
	t.Helper()
	data := postJSON(t, engine, path, body, wantStatus, token)
	var result T
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("decode POST response body: %v", err)
	}
	return result
}

func putAuthorized[T any](t *testing.T, engine http.Handler, path, token string, body map[string]any, wantStatus int) T {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPut, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != wantStatus {
		t.Fatalf("PUT %s status = %d want %d body=%s", path, rec.Code, wantStatus, rec.Body.String())
	}

	var response apiResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode common response: %v", err)
	}

	var result T
	if err := json.Unmarshal(response.Data, &result); err != nil {
		t.Fatalf("decode data field: %v", err)
	}
	return result
}

func postJSON(t *testing.T, engine http.Handler, path string, body map[string]any, wantStatus int, token string) json.RawMessage {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)

	if rec.Code != wantStatus {
		t.Fatalf("POST %s status = %d want %d body=%s", path, rec.Code, wantStatus, rec.Body.String())
	}

	var response apiResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode common response: %v", err)
	}
	return response.Data
}

func itoa(value uint) string {
	if value == 0 {
		return "0"
	}
	buf := make([]byte, 0, 20)
	for value > 0 {
		digit := value % 10
		buf = append([]byte{byte('0' + digit)}, buf...)
		value /= 10
	}
	return string(buf)
}
