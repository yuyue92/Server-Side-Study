package model

// Chapter belongs to one course and is the minimum learning unit tracked by progress.
type Chapter struct {
	BaseModel
	CourseID uint   `gorm:"not null;index" json:"course_id"`
	Course   Course `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"-"`

	Title           string `gorm:"type:varchar(160);not null" json:"title"`
	Content         string `gorm:"type:text" json:"content"`
	VideoURL        string `gorm:"type:varchar(255)" json:"video_url"`
	DurationSeconds int    `gorm:"not null;default:0" json:"duration_seconds"`
	SortOrder       int    `gorm:"not null;default:0;index" json:"sort_order"`
	IsPreview       bool   `gorm:"not null;default:false" json:"is_preview"`

	Progresses []LearningProgress `gorm:"foreignKey:ChapterID" json:"-"`
}
