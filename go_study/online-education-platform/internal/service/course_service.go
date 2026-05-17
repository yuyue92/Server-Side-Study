package service

import (
	"errors"
	"fmt"

	"online-education-platform/internal/dto"
	"online-education-platform/internal/model"

	"gorm.io/gorm"
)

// CourseService owns teacher-side course and chapter operations.
type CourseService struct {
	db *gorm.DB
}

func NewCourseService(db *gorm.DB) *CourseService {
	return &CourseService{db: db}
}

func (s *CourseService) CreateCourse(teacherID uint, req dto.CreateCourseRequest) (*model.Course, error) {
	status := req.Status
	if status == "" {
		status = model.CourseStatusPublished
	}

	course := model.Course{
		TeacherID:   teacherID,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		Level:       req.Level,
		CoverURL:    req.CoverURL,
		Status:      status,
	}

	if err := s.db.Create(&course).Error; err != nil {
		return nil, fmt.Errorf("create course: %w", err)
	}
	return &course, nil
}

func (s *CourseService) CreateChapter(teacherID, courseID uint, req dto.CreateChapterRequest) (*model.Chapter, error) {
	var course model.Course
	if err := s.db.Where("id = ? AND teacher_id = ?", courseID, teacherID).First(&course).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrForbidden
		}
		return nil, fmt.Errorf("find owned course: %w", err)
	}

	chapter := model.Chapter{
		CourseID:        courseID,
		Title:           req.Title,
		Content:         req.Content,
		VideoURL:        req.VideoURL,
		DurationSeconds: req.DurationSeconds,
		SortOrder:       req.SortOrder,
		IsPreview:       req.IsPreview,
	}

	if err := s.db.Create(&chapter).Error; err != nil {
		return nil, fmt.Errorf("create chapter: %w", err)
	}
	return &chapter, nil
}

func (s *CourseService) ListPublishedCourses() ([]model.Course, error) {
	var courses []model.Course
	if err := s.db.
		Preload("Teacher").
		Where("status = ?", model.CourseStatusPublished).
		Order("id DESC").
		Find(&courses).Error; err != nil {
		return nil, fmt.Errorf("list published courses: %w", err)
	}
	return courses, nil
}

func (s *CourseService) GetCourseDetail(courseID uint) (*model.Course, error) {
	var course model.Course
	if err := s.db.
		Preload("Teacher").
		Preload("Chapters", func(db *gorm.DB) *gorm.DB {
			return db.Order("sort_order ASC, id ASC")
		}).
		Where("id = ? AND status = ?", courseID, model.CourseStatusPublished).
		First(&course).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get course detail: %w", err)
	}
	return &course, nil
}
