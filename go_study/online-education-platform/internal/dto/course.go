package dto

// CreateCourseRequest is used by teachers to create a course.
type CreateCourseRequest struct {
	Title       string `json:"title" binding:"required,min=2,max=160"`
	Description string `json:"description" binding:"max=5000"`
	Category    string `json:"category" binding:"max=64"`
	Level       string `json:"level" binding:"max=32"`
	CoverURL    string `json:"cover_url" binding:"omitempty,url,max=255"`
	Status      string `json:"status" binding:"omitempty,oneof=published draft"`
}

// CreateChapterRequest is used by teachers to append a chapter to an owned course.
type CreateChapterRequest struct {
	Title           string `json:"title" binding:"required,min=2,max=160"`
	Content         string `json:"content" binding:"max=20000"`
	VideoURL        string `json:"video_url" binding:"omitempty,url,max=255"`
	DurationSeconds int    `json:"duration_seconds" binding:"gte=0"`
	SortOrder       int    `json:"sort_order" binding:"gte=0"`
	IsPreview       bool   `json:"is_preview"`
}
