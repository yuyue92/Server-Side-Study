package router

import (
	"net/http"

	"online-education-platform/internal/config"
	"online-education-platform/internal/handler"
	"online-education-platform/internal/middleware"
	"online-education-platform/internal/model"
	"online-education-platform/internal/response"
	"online-education-platform/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Setup creates the full HTTP router tree and wires all dependencies.
func Setup(db *gorm.DB, cfg *config.Config) *gin.Engine {
	engine := gin.New()
	engine.Use(gin.Logger(), gin.Recovery(), middleware.CORS())

	authService := service.NewAuthService(db, cfg.JWTSecret, cfg.JWTExpireHours)
	courseService := service.NewCourseService(db)
	enrollmentService := service.NewEnrollmentService(db)
	progressService := service.NewProgressService(db, enrollmentService)

	authHandler := handler.NewAuthHandler(authService)
	courseHandler := handler.NewCourseHandler(courseService)
	enrollmentHandler := handler.NewEnrollmentHandler(enrollmentService)
	progressHandler := handler.NewProgressHandler(progressService)

	engine.GET("/healthz", func(c *gin.Context) {
		response.Success(c, http.StatusOK, "ok", gin.H{"service": "online-education-platform"})
	})

	api := engine.Group("/api/v1")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		courses := api.Group("/courses")
		{
			courses.GET("", courseHandler.ListPublishedCourses)
			courses.GET("/:courseID", courseHandler.GetCourseDetail)
		}

		protected := api.Group("")
		protected.Use(middleware.Auth(authService))

		teacher := protected.Group("/teacher")
		teacher.Use(middleware.RequireRole(model.RoleTeacher))
		{
			teacher.POST("/courses", courseHandler.CreateCourse)
			teacher.POST("/courses/:courseID/chapters", courseHandler.CreateChapter)
		}

		student := protected.Group("/student")
		student.Use(middleware.RequireRole(model.RoleStudent))
		{
			student.POST("/courses/:courseID/enroll", enrollmentHandler.Enroll)
			student.PUT("/progress", progressHandler.Update)
			student.GET("/courses/:courseID/progress", progressHandler.QueryCourseProgress)
		}
	}

	return engine
}
