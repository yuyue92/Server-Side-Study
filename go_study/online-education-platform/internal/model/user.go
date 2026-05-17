package model

const (
	RoleStudent = "student"
	RoleTeacher = "teacher"
)

const (
	UserStatusActive  = "active"
	UserStatusBlocked = "blocked"
)

// User stores platform accounts for both students and teachers.
type User struct {
	BaseModel
	Username     string `gorm:"type:varchar(64);not null;uniqueIndex" json:"username"`
	Email        string `gorm:"type:varchar(128);not null;uniqueIndex" json:"email"`
	PasswordHash string `gorm:"type:varchar(255);not null" json:"-"`
	Role         string `gorm:"type:varchar(16);not null;index" json:"role"`
	AvatarURL    string `gorm:"type:varchar(255)" json:"avatar_url"`
	Bio          string `gorm:"type:text" json:"bio"`
	Status       string `gorm:"type:varchar(16);not null;default:active;index" json:"status"`

	Courses     []Course           `gorm:"foreignKey:TeacherID" json:"-"`
	Enrollments []CourseEnrollment `gorm:"foreignKey:StudentID" json:"-"`
	Progresses  []LearningProgress `gorm:"foreignKey:StudentID" json:"-"`
}
