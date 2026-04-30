package db

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func Init(dataSourceName string) error {
	var err error
	DB, err = sql.Open("sqlite", dataSourceName)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	if err = createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	log.Println("Database initialized successfully")
	return nil
}

func createTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS students (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			student_id TEXT    NOT NULL UNIQUE,
			name       TEXT    NOT NULL,
			grade      TEXT    NOT NULL,
			class      TEXT    NOT NULL,
			major      TEXT    NOT NULL,
			phone      TEXT,
			email      TEXT,
			address    TEXT,
			gender     TEXT    CHECK(gender IN ('male','female','other')) DEFAULT 'other',
			birth_date TEXT,
			status     TEXT    CHECK(status IN ('active','inactive','graduated','suspended')) DEFAULT 'active',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// 成绩登记（预留）
		`CREATE TABLE IF NOT EXISTS grades (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			student_id TEXT    NOT NULL,
			course     TEXT    NOT NULL,
			semester   TEXT    NOT NULL,
			score      REAL,
			grade_type TEXT    DEFAULT 'regular',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (student_id) REFERENCES students(student_id)
		)`,

		// 课程绑定（预留）
		`CREATE TABLE IF NOT EXISTS courses (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			course_code TEXT    NOT NULL UNIQUE,
			course_name TEXT    NOT NULL,
			teacher     TEXT,
			credits     INTEGER DEFAULT 0,
			semester    TEXT,
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,

		// 健康档案（预留）
		`CREATE TABLE IF NOT EXISTS health_records (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			student_id   TEXT    NOT NULL,
			height       REAL,
			weight       REAL,
			blood_type   TEXT,
			vision_left  REAL,
			vision_right REAL,
			notes        TEXT,
			check_date   TEXT,
			created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY  (student_id) REFERENCES students(student_id)
		)`,

		// 触发器：更新时自动刷新 updated_at
		`CREATE TRIGGER IF NOT EXISTS update_students_timestamp
			AFTER UPDATE ON students
			FOR EACH ROW
		BEGIN
			UPDATE students SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
		END`,
	}

	for _, q := range queries {
		if _, err := DB.Exec(q); err != nil {
			return fmt.Errorf("query failed: %w\nSQL: %s", err, q)
		}
	}
	return nil
}
