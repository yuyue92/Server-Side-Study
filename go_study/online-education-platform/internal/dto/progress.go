package dto

// UpdateProgressRequest updates one student's progress on a single chapter.
type UpdateProgressRequest struct {
	CourseID            uint    `json:"course_id" binding:"required"`
	ChapterID           uint    `json:"chapter_id" binding:"required"`
	ProgressPercent     float64 `json:"progress_percent" binding:"gte=0,lte=100"`
	WatchedSeconds      int     `json:"watched_seconds" binding:"gte=0"`
	LastPositionSeconds int     `json:"last_position_seconds" binding:"gte=0"`
	IsCompleted         bool    `json:"is_completed"`
}
