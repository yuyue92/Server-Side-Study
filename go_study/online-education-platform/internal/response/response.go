package response

import "github.com/gin-gonic/gin"

// Success returns a unified successful JSON response.
func Success(c *gin.Context, status int, message string, data any) {
	c.JSON(status, gin.H{
		"code":    status,
		"message": message,
		"data":    data,
	})
}

// Error returns a unified error JSON response.
func Error(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{
		"code":    status,
		"message": message,
		"data":    nil,
	})
}
