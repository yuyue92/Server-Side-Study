package service

import (
	"errors"
	"fmt"
	"math"
	"time"

	"online-education-platform/internal/dto"
	"online-education-platform/internal/model"

	"gorm.io/gorm"
)

// ProgressService owns chapter-level learning progress.
type ProgressService struct {
	db         *gorm.DB
	enrollment *EnrollmentService
}

// CourseProgressSummary is returned by the student progress query API.
type CourseProgressSummary struct {
	CourseID          uint                     `json:"course_id"`
	TotalChapters     int64                    `json:"total_chapters"`
	CompletedChapters int64                    `json:"completed_chapters"`
	AveragePercent    float64                  `json:"average_percent"`
	Items             []model.LearningProgress `json:"items"`
}

func NewProgressService(db *gorm.DB, enrollment *EnrollmentService) *ProgressService {
	return &ProgressService{db: db, enrollment: enrollment}
}

func (s *ProgressService) Update(studentID uint, req dto.UpdateProgressRequest) (*model.LearningProgress, error) {
	enrolled, err := s.enrollment.IsEnrolled(studentID, req.CourseID)
	if err != nil {
		return nil, err
	}
	if !enrolled {
		return nil, ErrNotEnrolled
	}

	var chapter model.Chapter
	if err := s.db.Where("id = ? AND course_id = ?", req.ChapterID, req.CourseID).First(&chapter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrChapterCourse
		}
		return nil, fmt.Errorf("find chapter in course: %w", err)
	}

	now := time.Now()
	var progress model.LearningProgress
	queryErr := s.db.Where("student_id = ? AND chapter_id = ?", studentID, req.ChapterID).First(&progress).Error

	if errors.Is(queryErr, gorm.ErrRecordNotFound) {
		progress = model.LearningProgress{
			StudentID: studentID,
			CourseID:  req.CourseID,
			ChapterID: req.ChapterID,
		}
	} else if queryErr != nil {
		return nil, fmt.Errorf("find progress: %w", queryErr)
	}

	progress.ProgressPercent = clampPercent(req.ProgressPercent)
	progress.WatchedSeconds = req.WatchedSeconds
	progress.LastPositionSeconds = req.LastPositionSeconds
	progress.LastStudiedAt = &now
	progress.IsCompleted = req.IsCompleted || progress.ProgressPercent >= 100
	if progress.IsCompleted {
		progress.ProgressPercent = 100
		progress.CompletedAt = &now
	} else {
		progress.CompletedAt = nil
	}

	if progress.ID == 0 {
		if err := s.db.Create(&progress).Error; err != nil {
			return nil, fmt.Errorf("create progress: %w", err)
		}
	} else {
		if err := s.db.Save(&progress).Error; err != nil {
			return nil, fmt.Errorf("update progress: %w", err)
		}
	}

	if err := s.db.Preload("Chapter").First(&progress, progress.ID).Error; err != nil {
		return nil, fmt.Errorf("reload progress: %w", err)
	}

	return &progress, nil
}

func (s *ProgressService) QueryCourseProgress(studentID, courseID uint) (*CourseProgressSummary, error) {
	enrolled, err := s.enrollment.IsEnrolled(studentID, courseID)
	if err != nil {
		return nil, err
	}
	if !enrolled {
		return nil, ErrNotEnrolled
	}

	var totalChapters int64
	if err := s.db.Model(&model.Chapter{}).
		Where("course_id = ?", courseID).
		Count(&totalChapters).Error; err != nil {
		return nil, fmt.Errorf("count course chapters: %w", err)
	}

	var items []model.LearningProgress
	if err := s.db.
		Preload("Chapter").
		Where("student_id = ? AND course_id = ?", studentID, courseID).
		Order("chapter_id ASC").
		Find(&items).Error; err != nil {
		return nil, fmt.Errorf("list course progresses: %w", err)
	}

	var completed int64
	var totalPercent float64
	for _, item := range items {
		totalPercent += item.ProgressPercent
		if item.IsCompleted {
			completed++
		}
	}

	average := 0.0
	if totalChapters > 0 {
		average = totalPercent / float64(totalChapters)
		average = math.Round(average*100) / 100
	}

	return &CourseProgressSummary{
		CourseID:          courseID,
		TotalChapters:     totalChapters,
		CompletedChapters: completed,
		AveragePercent:    average,
		Items:             items,
	}, nil
}

func clampPercent(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return value
}
