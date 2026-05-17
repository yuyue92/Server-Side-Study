package handler

import (
	"errors"
	"net/http"

	"online-education-platform/internal/middleware"
	"online-education-platform/internal/response"
	"online-education-platform/internal/service"

	"github.com/gin-gonic/gin"
)

// EnrollmentHandler provides student enrollment APIs.
type EnrollmentHandler struct {
	service *service.EnrollmentService
}

func NewEnrollmentHandler(service *service.EnrollmentService) *EnrollmentHandler {
	return &EnrollmentHandler{service: service}
}

func (h *EnrollmentHandler) Enroll(c *gin.Context) {
	courseID, err := parseUintParam(c, "courseID")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid course id")
		return
	}

	enrollment, err := h.service.Enroll(middleware.CurrentUserID(c), courseID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "published course not found")
		case errors.Is(err, service.ErrAlreadyEnrolled):
			response.Error(c, http.StatusConflict, err.Error())
		default:
			response.Error(c, http.StatusInternalServerError, err.Error())
		}
		return
	}

	response.Success(c, http.StatusCreated, "enroll success", enrollment)
}
