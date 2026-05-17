package service

import "errors"

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailExists        = errors.New("email already exists")
	ErrUsernameExists     = errors.New("username already exists")
	ErrForbidden          = errors.New("forbidden")
	ErrNotFound           = errors.New("resource not found")
	ErrAlreadyEnrolled    = errors.New("student already enrolled in this course")
	ErrNotEnrolled        = errors.New("student is not enrolled in this course")
	ErrChapterCourse      = errors.New("chapter does not belong to course")
)
