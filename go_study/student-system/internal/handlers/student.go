package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"student-system/internal/models"
)

func respond(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(data)
}

func respondErr(w http.ResponseWriter, code int, msg string) {
	respond(w, code, map[string]string{"error": msg})
}

// POST /api/students
func CreateStudent(w http.ResponseWriter, r *http.Request) {
	var s models.Student
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if strings.TrimSpace(s.StudentID) == "" || strings.TrimSpace(s.Name) == "" {
		respondErr(w, http.StatusBadRequest, "student_id and name are required")
		return
	}
	if s.Status == "" {
		s.Status = "active"
	}
	if s.Gender == "" {
		s.Gender = "other"
	}
	if err := models.CreateStudent(&s); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			respondErr(w, http.StatusConflict, "student_id already exists")
			return
		}
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusCreated, s)
}

// GET /api/students?student_id=&name=&class=&major=&grade=&status=&page=&page_size=
func ListStudents(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	if pageSize == 0 {
		pageSize = 20
	}

	result, err := models.SearchStudents(models.SearchParams{
		StudentID: q.Get("student_id"),
		Name:      q.Get("name"),
		Class:     q.Get("class"),
		Major:     q.Get("major"),
		Grade:     q.Get("grade"),
		Status:    q.Get("status"),
		Page:      page,
		PageSize:  pageSize,
	})
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, result)
}

// GET /api/students/{student_id}
func GetStudent(w http.ResponseWriter, r *http.Request) {
	sid := strings.TrimPrefix(r.URL.Path, "/api/students/")
	sid = strings.TrimSpace(sid)
	if sid == "" {
		respondErr(w, http.StatusBadRequest, "student_id is required")
		return
	}
	s, err := models.GetStudentByStudentID(sid)
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if s == nil {
		respondErr(w, http.StatusNotFound, "student not found")
		return
	}
	respond(w, http.StatusOK, s)
}

// PUT /api/students/{student_id}
func UpdateStudent(w http.ResponseWriter, r *http.Request) {
	sid := strings.TrimPrefix(r.URL.Path, "/api/students/")
	sid = strings.TrimSpace(sid)

	var s models.Student
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		respondErr(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	s.StudentID = sid
	if err := models.UpdateStudent(&s); err != nil {
		if strings.Contains(err.Error(), "not found") {
			respondErr(w, http.StatusNotFound, err.Error())
			return
		}
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	updated, _ := models.GetStudentByStudentID(sid)
	respond(w, http.StatusOK, updated)
}

// DELETE /api/students/{student_id}
func DeleteStudent(w http.ResponseWriter, r *http.Request) {
	sid := strings.TrimPrefix(r.URL.Path, "/api/students/")
	sid = strings.TrimSpace(sid)
	if err := models.DeleteStudent(sid); err != nil {
		if strings.Contains(err.Error(), "not found") {
			respondErr(w, http.StatusNotFound, err.Error())
			return
		}
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, map[string]string{"message": "deleted successfully"})
}

// GET /api/stats
func GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := models.GetStats()
	if err != nil {
		respondErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	respond(w, http.StatusOK, stats)
}

// Router
func StudentRouter(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	// /api/students  or  /api/students/{id}
	isDetail := len(strings.TrimPrefix(path, "/api/students/")) > 0 && path != "/api/students" && path != "/api/students/"

	switch {
	case r.Method == http.MethodGet && !isDetail:
		ListStudents(w, r)
	case r.Method == http.MethodPost && !isDetail:
		CreateStudent(w, r)
	case r.Method == http.MethodGet && isDetail:
		GetStudent(w, r)
	case r.Method == http.MethodPut && isDetail:
		UpdateStudent(w, r)
	case r.Method == http.MethodDelete && isDetail:
		DeleteStudent(w, r)
	default:
		respondErr(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}
