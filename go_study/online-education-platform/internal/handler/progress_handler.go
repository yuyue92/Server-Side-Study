package handler

import (
	"errors"
	"net/http"

	"online-education-platform/internal/dto"
	"online-education-platform/internal/middleware"
	"online-education-platform/internal/response"
	"online-education-platform/internal/service"

	"github.com/gin-gonic/gin"
)

// ProgressHandler provides student-side progress APIs.
type ProgressHandler struct {
	service *service.ProgressService
}

func NewProgressHandler(service *service.ProgressService) *ProgressHandler {
	return &ProgressHandler{service: service}
}

func (h *ProgressHandler) Update(c *gin.Context) {
	var req dto.UpdateProgressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	progress, err := h.service.Update(middleware.CurrentUserID(c), req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotEnrolled):
			response.Error(c, http.StatusForbidden, err.Error())
		case errors.Is(err, service.ErrChapterCourse):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	response.Success(c, http.StatusOK, "progress updated", progress)
}

func (h *ProgressHandler) QueryCourseProgress(c *gin.Context) {
	courseID, err := parseUintParam(c, "courseID")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid course id")
		return
	}

	summary, err := h.service.QueryCourseProgress(middleware.CurrentUserID(c), courseID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotEnrolled):
			response.Error(c, http.StatusForbidden, err.Error())
		default:
			response.Error(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	response.Success(c, http.StatusOK, "course progress", summary)
}
