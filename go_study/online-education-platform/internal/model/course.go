package model

const (
	CourseStatusPublished = "published"
	CourseStatusDraft     = "draft"
)

// Course is created by a teacher and contains multiple chapters.
type Course struct {
	BaseModel
	Title       string `gorm:"type:varchar(160);not null;index" json:"title"`
	Description string `gorm:"type:text" json:"description"`
	Category    string `gorm:"type:varchar(64);index" json:"category"`
	Level       string `gorm:"type:varchar(32);index" json:"level"`
	CoverURL    string `gorm:"type:varchar(255)" json:"cover_url"`
	Status      string `gorm:"type:varchar(16);not null;default:published;index" json:"status"`

	TeacherID uint `gorm:"not null;index" json:"teacher_id"`
	Teacher   User `gorm:"constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;" json:"teacher,omitempty"`

	Chapters    []Chapter          `gorm:"foreignKey:CourseID" json:"chapters,omitempty"`
	Enrollments []CourseEnrollment `gorm:"foreignKey:CourseID" json:"-"`
	Progresses  []LearningProgress `gorm:"foreignKey:CourseID" json:"-"`
}
