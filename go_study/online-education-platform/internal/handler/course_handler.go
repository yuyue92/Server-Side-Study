package handler

import (
	"errors"
	"net/http"
	"strconv"

	"online-education-platform/internal/dto"
	"online-education-platform/internal/middleware"
	"online-education-platform/internal/response"
	"online-education-platform/internal/service"

	"github.com/gin-gonic/gin"
)

// CourseHandler provides public and teacher-side course APIs.
type CourseHandler struct {
	service *service.CourseService
}

func NewCourseHandler(service *service.CourseService) *CourseHandler {
	return &CourseHandler{service: service}
}

func (h *CourseHandler) CreateCourse(c *gin.Context) {
	var req dto.CreateCourseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	course, err := h.service.CreateCourse(middleware.CurrentUserID(c), req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, http.StatusCreated, "course created", course)
}

func (h *CourseHandler) CreateChapter(c *gin.Context) {
	courseID, err := parseUintParam(c, "courseID")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid course id")
		return
	}

	var req dto.CreateChapterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	chapter, err := h.service.CreateChapter(middleware.CurrentUserID(c), courseID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrForbidden):
			response.Error(c, http.StatusForbidden, "course not found or not owned by current teacher")
		default:
			response.Error(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	response.Success(c, http.StatusCreated, "chapter created", chapter)
}

func (h *CourseHandler) ListPublishedCourses(c *gin.Context) {
	courses, err := h.service.ListPublishedCourses()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.Success(c, http.StatusOK, "course list", courses)
}

func (h *CourseHandler) GetCourseDetail(c *gin.Context) {
	courseID, err := parseUintParam(c, "courseID")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid course id")
		return
	}

	course, err := h.service.GetCourseDetail(courseID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "course not found")
		default:
			response.Error(c, http.StatusInternalServerError, err.Error())
		}
		return
	}
	response.Success(c, http.StatusOK, "course detail", course)
}

func parseUintParam(c *gin.Context, name string) (uint, error) {
	value, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(value), nil
}
