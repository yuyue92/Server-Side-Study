package service

import (
	"errors"
	"fmt"
	"time"

	"online-education-platform/internal/model"

	"gorm.io/gorm"
)

// EnrollmentService owns student course enrollment.
type EnrollmentService struct {
	db *gorm.DB
}

func NewEnrollmentService(db *gorm.DB) *EnrollmentService {
	return &EnrollmentService{db: db}
}

func (s *EnrollmentService) Enroll(studentID, courseID uint) (*model.CourseEnrollment, error) {
	var course model.Course
	if err := s.db.Where("id = ? AND status = ?", courseID, model.CourseStatusPublished).First(&course).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("find published course: %w", err)
	}

	var existing model.CourseEnrollment
	err := s.db.Where("student_id = ? AND course_id = ?", studentID, courseID).First(&existing).Error
	if err == nil {
		return nil, ErrAlreadyEnrolled
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("check existing enrollment: %w", err)
	}

	enrollment := model.CourseEnrollment{
		StudentID:  studentID,
		CourseID:   courseID,
		Status:     model.EnrollmentStatusActive,
		EnrolledAt: time.Now(),
	}
	if err := s.db.Create(&enrollment).Error; err != nil {
		return nil, fmt.Errorf("create enrollment: %w", err)
	}
	return &enrollment, nil
}

func (s *EnrollmentService) IsEnrolled(studentID, courseID uint) (bool, error) {
	var count int64
	if err := s.db.Model(&model.CourseEnrollment{}).
		Where("student_id = ? AND course_id = ?", studentID, courseID).
		Count(&count).Error; err != nil {
		return false, fmt.Errorf("count enrollment: %w", err)
	}
	return count > 0, nil
}
