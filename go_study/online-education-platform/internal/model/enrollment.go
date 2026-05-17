package model

import "time"

const (
	EnrollmentStatusActive    = "active"
	EnrollmentStatusCompleted = "completed"
)

// CourseEnrollment represents the many-to-many relation between students and courses.
type CourseEnrollment struct {
	BaseModel
	StudentID uint `gorm:"not null;uniqueIndex:idx_student_course;index" json:"student_id"`
	Student   User `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`

	CourseID uint   `gorm:"not null;uniqueIndex:idx_student_course;index" json:"course_id"`
	Course   Course `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`

	Status     string    `gorm:"type:varchar(16);not null;default:active;index" json:"status"`
	EnrolledAt time.Time `gorm:"not null" json:"enrolled_at"`
}
