package models

import (
	"database/sql"
	"fmt"
	"strings"

	"student-system/internal/db"
)

type Student struct {
	ID        int64  `json:"id"`
	StudentID string `json:"student_id"`
	Name      string `json:"name"`
	Grade     string `json:"grade"`
	Class     string `json:"class"`
	Major     string `json:"major"`
	Phone     string `json:"phone"`
	Email     string `json:"email"`
	Address   string `json:"address"`
	Gender    string `json:"gender"`
	BirthDate string `json:"birth_date"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type SearchParams struct {
	StudentID string
	Name      string
	Class     string
	Major     string
	Grade     string
	Status    string
	Page      int
	PageSize  int
}

type PagedResult struct {
	Students []*Student `json:"students"`
	Total    int        `json:"total"`
	Page     int        `json:"page"`
	PageSize int        `json:"page_size"`
}

func CreateStudent(s *Student) error {
	query := `INSERT INTO students
		(student_id, name, grade, class, major, phone, email, address, gender, birth_date, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	res, err := db.DB.Exec(query,
		s.StudentID, s.Name, s.Grade, s.Class, s.Major,
		s.Phone, s.Email, s.Address, s.Gender, s.BirthDate, s.Status)
	if err != nil {
		return fmt.Errorf("create student: %w", err)
	}
	s.ID, _ = res.LastInsertId()
	return nil
}

func GetStudentByStudentID(studentID string) (*Student, error) {
	s := &Student{}
	query := `SELECT id, student_id, name, grade, class, major,
		COALESCE(phone,''), COALESCE(email,''), COALESCE(address,''),
		gender, COALESCE(birth_date,''), status, created_at, updated_at
		FROM students WHERE student_id = ?`
	err := db.DB.QueryRow(query, studentID).Scan(
		&s.ID, &s.StudentID, &s.Name, &s.Grade, &s.Class, &s.Major,
		&s.Phone, &s.Email, &s.Address, &s.Gender, &s.BirthDate,
		&s.Status, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get student: %w", err)
	}
	return s, nil
}

func SearchStudents(p SearchParams) (*PagedResult, error) {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.Page <= 0 {
		p.Page = 1
	}
	offset := (p.Page - 1) * p.PageSize

	where := []string{"1=1"}
	args := []interface{}{}

	if p.StudentID != "" {
		where = append(where, "student_id = ?")
		args = append(args, p.StudentID)
	}
	if p.Name != "" {
		where = append(where, "name LIKE ?")
		args = append(args, "%"+p.Name+"%")
	}
	if p.Class != "" {
		where = append(where, "class LIKE ?")
		args = append(args, "%"+p.Class+"%")
	}
	if p.Major != "" {
		where = append(where, "major LIKE ?")
		args = append(args, "%"+p.Major+"%")
	}
	if p.Grade != "" {
		where = append(where, "grade = ?")
		args = append(args, p.Grade)
	}
	if p.Status != "" {
		where = append(where, "status = ?")
		args = append(args, p.Status)
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	countQuery := "SELECT COUNT(*) FROM students WHERE " + whereClause
	if err := db.DB.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("count students: %w", err)
	}

	query := fmt.Sprintf(`SELECT id, student_id, name, grade, class, major,
		COALESCE(phone,''), COALESCE(email,''), COALESCE(address,''),
		gender, COALESCE(birth_date,''), status, created_at, updated_at
		FROM students WHERE %s
		ORDER BY created_at DESC LIMIT ? OFFSET ?`, whereClause)

	args = append(args, p.PageSize, offset)
	rows, err := db.DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("search students: %w", err)
	}
	defer rows.Close()

	students := []*Student{}
	for rows.Next() {
		s := &Student{}
		if err := rows.Scan(
			&s.ID, &s.StudentID, &s.Name, &s.Grade, &s.Class, &s.Major,
			&s.Phone, &s.Email, &s.Address, &s.Gender, &s.BirthDate,
			&s.Status, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		students = append(students, s)
	}

	return &PagedResult{
		Students: students,
		Total:    total,
		Page:     p.Page,
		PageSize: p.PageSize,
	}, nil
}

func UpdateStudent(s *Student) error {
	query := `UPDATE students SET
		name=?, grade=?, class=?, major=?, phone=?, email=?, address=?,
		gender=?, birth_date=?, status=?
		WHERE student_id=?`
	res, err := db.DB.Exec(query,
		s.Name, s.Grade, s.Class, s.Major, s.Phone, s.Email,
		s.Address, s.Gender, s.BirthDate, s.Status, s.StudentID)
	if err != nil {
		return fmt.Errorf("update student: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("student not found: %s", s.StudentID)
	}
	return nil
}

func DeleteStudent(studentID string) error {
	res, err := db.DB.Exec("DELETE FROM students WHERE student_id=?", studentID)
	if err != nil {
		return fmt.Errorf("delete student: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("student not found: %s", studentID)
	}
	return nil
}

func GetStats() (map[string]interface{}, error) {
	stats := map[string]interface{}{}

	var total int
	db.DB.QueryRow("SELECT COUNT(*) FROM students").Scan(&total)
	stats["total"] = total

	var active int
	db.DB.QueryRow("SELECT COUNT(*) FROM students WHERE status='active'").Scan(&active)
	stats["active"] = active

	rows, err := db.DB.Query("SELECT grade, COUNT(*) FROM students GROUP BY grade ORDER BY grade")
	if err == nil {
		defer rows.Close()
		byGrade := []map[string]interface{}{}
		for rows.Next() {
			var grade string
			var count int
			rows.Scan(&grade, &count)
			byGrade = append(byGrade, map[string]interface{}{"grade": grade, "count": count})
		}
		stats["by_grade"] = byGrade
	}

	rows2, err := db.DB.Query("SELECT major, COUNT(*) FROM students GROUP BY major ORDER BY COUNT(*) DESC LIMIT 5")
	if err == nil {
		defer rows2.Close()
		byMajor := []map[string]interface{}{}
		for rows2.Next() {
			var major string
			var count int
			rows2.Scan(&major, &count)
			byMajor = append(byMajor, map[string]interface{}{"major": major, "count": count})
		}
		stats["by_major"] = byMajor
	}

	return stats, nil
}
