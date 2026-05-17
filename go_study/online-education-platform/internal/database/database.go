package database

import (
	"fmt"
	"os"
	"path/filepath"

	"online-education-platform/internal/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Init opens the SQLite database, enables foreign keys, and runs AutoMigrate.
func Init(databasePath string) (*gorm.DB, error) {
	if err := ensureParentDir(databasePath); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}

	db, err := gorm.Open(sqlite.Open(databasePath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("open sqlite database: %w", err)
	}

	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		return nil, fmt.Errorf("enable sqlite foreign keys: %w", err)
	}

	if err := AutoMigrate(db); err != nil {
		return nil, err
	}

	return db, nil
}

// AutoMigrate creates or updates all application tables required by the service.
func AutoMigrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&model.User{},
		&model.Course{},
		&model.Chapter{},
		&model.CourseEnrollment{},
		&model.LearningProgress{},
	); err != nil {
		return fmt.Errorf("auto migrate database schema: %w", err)
	}
	return nil
}

func ensureParentDir(databasePath string) error {
	dir := filepath.Dir(databasePath)
	if dir == "." || dir == "" {
		return nil
	}
	return os.MkdirAll(dir, 0o755)
}
