package model

import "time"

// LearningProgress tracks one student's progress for one chapter in one course.
type LearningProgress struct {
	BaseModel
	StudentID uint `gorm:"not null;uniqueIndex:idx_student_chapter;index" json:"student_id"`
	Student   User `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`

	CourseID uint   `gorm:"not null;index" json:"course_id"`
	Course   Course `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`

	ChapterID uint    `gorm:"not null;uniqueIndex:idx_student_chapter;index" json:"chapter_id"`
	Chapter   Chapter `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"chapter,omitempty"`

	ProgressPercent     float64    `gorm:"not null;default:0" json:"progress_percent"`
	WatchedSeconds      int        `gorm:"not null;default:0" json:"watched_seconds"`
	LastPositionSeconds int        `gorm:"not null;default:0" json:"last_position_seconds"`
	IsCompleted         bool       `gorm:"not null;default:false;index" json:"is_completed"`
	LastStudiedAt       *time.Time `json:"last_studied_at"`
	CompletedAt         *time.Time `json:"completed_at"`
}
